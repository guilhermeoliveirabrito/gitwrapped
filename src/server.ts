import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LOCALES, isCardName, isThemeName, parseLocale, renderCard, renderErrorCard } from './cards/index.ts';
import type { CardName, Locale, ThemeName } from './cards/index.ts';
import { demoData } from './demo.ts';
import { GitWrappedError, httpStatusFor } from './errors.ts';
import { fetchYearData, isValidLogin } from './github.ts';
import { LANDING_HTML } from './landing.ts';
import { computeStats } from './stats.ts';
import type { RawYearData } from './types.ts';

export interface ServerOptions {
  /** GitHub token used for every lookup. Without it only the demo endpoints work. */
  token?: string | undefined;
  /** How long fetched GitHub data is reused. Default: 1 hour. */
  cacheTtlMs?: number;
  /** Maximum number of cached user/year entries. Default: 500. */
  cacheMaxEntries?: number;
  /** Requests per minute allowed from one client on /api routes. 0 disables. Default: 60. */
  rateLimitPerMinute?: number;
  /** Read the client address from X-Forwarded-For. Only enable behind a trusted proxy. */
  trustProxy?: boolean;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests. */
  now?: () => Date;
}

const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
const HTML_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'";
const CARD_CACHE = 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400';
const DEMO_CACHE = 'public, max-age=86400';

interface CardQuery {
  login: string;
  year: number;
  theme: ThemeName;
  locale: Locale;
  utcOffsetMinutes: number;
}

/** How an image or error card is drawn. */
interface Look {
  theme: ThemeName;
  locale: Locale;
}

function invalid(message: string): GitWrappedError {
  return new GitWrappedError('INVALID_INPUT', message);
}

function parseTheme(params: URLSearchParams): ThemeName {
  const theme = params.get('theme') ?? 'dark';
  if (!isThemeName(theme)) throw invalid('Unknown theme. Use dark or light.');
  return theme;
}

function parseLang(params: URLSearchParams): Locale {
  const raw = params.get('lang');
  if (raw === null || raw === '') return 'en';
  const locale = parseLocale(raw);
  if (!locale) throw invalid(`Unknown lang. Use ${LOCALES.join(' or ')}.`);
  return locale;
}

function parseCardName(value: string | undefined): CardName {
  if (!value || !isCardName(value)) throw invalid('Unknown card.');
  return value;
}

function parseTimezone(params: URLSearchParams): number {
  const raw = params.get('tz');
  if (raw === null || raw === '') return 0;
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours < -12 || hours > 14) throw invalid('tz must be a UTC offset in hours between -12 and 14.');
  return Math.round(hours * 60);
}

function parseQuery(params: URLSearchParams, now: Date): CardQuery {
  const login = params.get('user') ?? '';
  if (!login) throw invalid('Missing "user" parameter.');
  if (!isValidLogin(login)) throw invalid('Invalid GitHub username.');

  const rawYear = params.get('year');
  const year = rawYear === null || rawYear === '' ? now.getUTCFullYear() : Number(rawYear);
  if (!Number.isInteger(year) || year < 2008 || year > now.getUTCFullYear()) {
    throw invalid(`year must be between 2008 and ${now.getUTCFullYear()}.`);
  }

  return { login, year, theme: parseTheme(params), locale: parseLang(params), utcOffsetMinutes: parseTimezone(params) };
}

export function createServer(options: ServerOptions = {}): http.Server {
  const ttl = options.cacheTtlMs ?? 3_600_000;
  const maxEntries = options.cacheMaxEntries ?? 500;
  const limitPerMinute = options.rateLimitPerMinute ?? 60;
  const clock = options.now ?? (() => new Date());

  // --- cache of GitHub responses (with de-duplication of concurrent lookups) ---
  const cache = new Map<string, { expires: number; data: RawYearData }>();
  const inflight = new Map<string, Promise<RawYearData>>();

  async function loadYear(login: string, year: number): Promise<RawYearData> {
    const key = `${login.toLowerCase()}:${year}`;
    const hit = cache.get(key);
    if (hit && hit.expires > clock().getTime()) return hit.data;

    const pending = inflight.get(key);
    if (pending) return pending;

    const request = fetchYearData(login, {
      token: options.token ?? '',
      year,
      now: clock(),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    })
      .then((data) => {
        if (cache.size >= maxEntries) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(key, { expires: clock().getTime() + ttl, data });
        return data;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, request);
    return request;
  }

  // --- fixed window rate limiter ---
  const windows = new Map<string, { count: number; resetAt: number }>();

  function clientId(req: IncomingMessage): string {
    if (options.trustProxy) {
      const forwarded = req.headers['x-forwarded-for'];
      const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
      if (first) return first;
    }
    return req.socket.remoteAddress ?? 'unknown';
  }

  /** Returns seconds to wait when the client is over the limit, otherwise 0. */
  function throttle(req: IncomingMessage): number {
    if (limitPerMinute <= 0) return 0;
    const nowMs = clock().getTime();
    if (windows.size > 10_000) {
      for (const [id, w] of windows) if (w.resetAt <= nowMs) windows.delete(id);
    }
    const id = clientId(req);
    let w = windows.get(id);
    if (!w || w.resetAt <= nowMs) {
      w = { count: 0, resetAt: nowMs + 60_000 };
      windows.set(id, w);
    }
    w.count++;
    return w.count > limitPerMinute ? Math.max(1, Math.ceil((w.resetAt - nowMs) / 1000)) : 0;
  }

  // --- responses ---
  function send(res: ServerResponse, status: number, body: string, headers: Record<string, string>): void {
    res.writeHead(status, {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Length': Buffer.byteLength(body),
      ...headers,
    });
    res.end(body);
  }

  function sendSvg(res: ServerResponse, svg: string, cacheControl: string): void {
    send(res, 200, svg, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Security-Policy': SVG_CSP,
      'Cache-Control': cacheControl,
    });
  }

  function sendJson(res: ServerResponse, status: number, payload: unknown, cacheControl = 'no-store'): void {
    send(res, status, JSON.stringify(payload), {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
    });
  }

  /** Card endpoints answer errors with an SVG so `<img>` embeds show a readable message. */
  function sendError(
    res: ServerResponse,
    error: unknown,
    kind: 'svg' | 'json',
    look: Look = { theme: 'dark', locale: 'en' },
    extra: Record<string, string> = {},
  ): void {
    let code = 'API_ERROR';
    let message = 'Something went wrong.';
    let status = 500;
    if (error instanceof GitWrappedError) {
      code = error.code;
      message = error.message;
      status = httpStatusFor(error.code);
    } else {
      console.error(error);
    }

    if (kind === 'svg') {
      send(res, status, renderErrorCard(message, look.theme, look.locale), {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Content-Security-Policy': SVG_CSP,
        'Cache-Control': 'no-store',
        ...extra,
      });
    } else {
      send(res, status, JSON.stringify({ error: { code, message } }), {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...extra,
      });
    }
  }

  /** Error cards must always render, so unknown values quietly fall back to the defaults. */
  function safeLook(params: URLSearchParams): Look {
    const theme = params.get('theme');
    const lang = params.get('lang');
    return {
      theme: theme && isThemeName(theme) ? theme : 'dark',
      locale: (lang && parseLocale(lang)) || 'en',
    };
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const { pathname, searchParams } = url;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }

    if (pathname === '/') {
      send(res, 200, LANDING_HTML, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': HTML_CSP,
        'Cache-Control': 'public, max-age=300',
      });
      return;
    }

    if (pathname === '/healthz') {
      sendJson(res, 200, { ok: true });
      return;
    }

    const isApi = pathname.startsWith('/api/');
    if (!isApi) {
      send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }

    const kind = pathname === '/api/stats' ? 'json' : 'svg';
    const retryAfter = throttle(req);
    if (retryAfter > 0) {
      sendError(res, new GitWrappedError('RATE_LIMITED', 'Too many requests. Please slow down.'), kind, safeLook(searchParams), {
        'Retry-After': String(retryAfter),
      });
      return;
    }

    try {
      const demo = /^\/api\/demo\/([a-z]+)$/.exec(pathname);
      if (demo) {
        const card = parseCardName(demo[1]);
        const theme = parseTheme(searchParams);
        const locale = parseLang(searchParams);
        const stats = computeStats(demoData(clock().getUTCFullYear() - 1), { now: clock() });
        sendSvg(res, renderCard(card, stats, theme, locale), DEMO_CACHE);
        return;
      }

      const cardRoute = /^\/api\/card\/([a-z]+)$/.exec(pathname);
      if (cardRoute) {
        const card = parseCardName(cardRoute[1]);
        const query = parseQuery(searchParams, clock());
        const raw = await loadYear(query.login, query.year);
        const stats = computeStats(raw, { utcOffsetMinutes: query.utcOffsetMinutes, now: clock() });
        sendSvg(res, renderCard(card, stats, query.theme, query.locale), CARD_CACHE);
        return;
      }

      if (pathname === '/api/stats') {
        const query = parseQuery(searchParams, clock());
        const raw = await loadYear(query.login, query.year);
        const stats = computeStats(raw, { utcOffsetMinutes: query.utcOffsetMinutes, now: clock() });
        sendJson(res, 200, stats, CARD_CACHE);
        return;
      }

      send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
    } catch (error) {
      sendError(res, error, kind, safeLook(searchParams));
    }
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      console.error(error);
      if (!res.headersSent) sendError(res, error, 'json');
      else res.end();
    });
  });
}
