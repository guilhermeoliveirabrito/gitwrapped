import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createServer } from '../src/server.ts';
import type { ServerOptions } from '../src/server.ts';
import { githubFetchMock } from './helpers.ts';

const NOW = new Date('2026-03-10T12:00:00Z');

async function start(options: ServerOptions): Promise<{ server: Server; base: string }> {
  const server = createServer({ now: () => NOW, rateLimitPerMinute: 0, ...options });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { server, base: `http://127.0.0.1:${port}` };
}

const stop = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

describe('server', () => {
  const github = githubFetchMock();
  let server: Server;
  let base: string;

  before(async () => {
    ({ server, base } = await start({ token: 'test-token', fetchImpl: github.fetchImpl }));
  });
  after(async () => {
    server.closeAllConnections();
    await stop(server);
  });

  it('serves the landing page with a strict content security policy', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/);
    assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'none'/);
    assert.match(await res.text(), /Your year in code, wrapped/);
  });

  it('answers health checks', async () => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  it('serves demo cards without hitting GitHub', async () => {
    const before = github.calls.length;
    const res = await fetch(`${base}/api/demo/summary?theme=light`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /image\/svg\+xml/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('content-security-policy') ?? '', /sandbox/);
    const body = await res.text();
    assert.ok(body.startsWith('<svg'));
    assert.ok(body.includes('@sample-dev'));
    assert.equal(github.calls.length, before);
  });

  it('renders every card type for a user', async () => {
    for (const card of ['summary', 'languages', 'repos', 'rhythm', 'heatmap', 'personality']) {
      const res = await fetch(`${base}/api/card/${card}?user=octocat&year=2025`);
      assert.equal(res.status, 200, card);
      assert.ok((await res.text()).startsWith('<svg'), card);
    }
  });

  it('reuses cached GitHub data for repeated lookups', async () => {
    const fresh = githubFetchMock();
    const { server: s, base: b } = await start({ token: 't', fetchImpl: fresh.fetchImpl });
    try {
      for (let i = 0; i < 3; i++) {
        const res = await fetch(`${b}/api/card/summary?user=cached-user&year=2025`);
        assert.equal(res.status, 200);
        await res.text();
      }
      // A different card or theme of the same user and year must not trigger new requests either.
      await (await fetch(`${b}/api/card/heatmap?user=CACHED-USER&year=2025&theme=light`)).text();
      assert.equal(fresh.calls.length, 2); // one profile query + one history query, once
    } finally {
      s.closeAllConnections();
      await stop(s);
    }
  });

  it('renders cards in the requested language', async () => {
    const demo = await (await fetch(`${base}/api/demo/summary?lang=pt-BR`)).text();
    assert.ok(demo.includes('contribuições'));
    const real = await (await fetch(`${base}/api/card/summary?user=octocat&year=2025&lang=pt`)).text();
    assert.ok(real.includes('contribuições'));
    const english = await (await fetch(`${base}/api/card/summary?user=octocat&year=2025`)).text();
    assert.ok(english.includes('contributions'));
  });

  it('draws error cards in the requested language', async () => {
    const res = await fetch(`${base}/api/card/summary?user=ghost&year=2025&lang=pt-BR`);
    assert.equal(res.status, 404);
    assert.ok((await res.text()).includes('Não foi possível gerar este card'));
  });

  it('returns stats as JSON', async () => {
    const res = await fetch(`${base}/api/stats?user=octocat&year=2025`);
    assert.equal(res.status, 200);
    const stats = (await res.json()) as { login: string; totals: { commits: number }; activeDays: number };
    assert.equal(stats.login, 'octocat');
    assert.equal(stats.totals.commits, 8);
    assert.equal(stats.activeDays, 2);
  });

  it('answers errors with an SVG card on image endpoints', async () => {
    const res = await fetch(`${base}/api/card/summary?user=ghost&year=2025`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type') ?? '', /image\/svg\+xml/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok((await res.text()).includes('GitHub user not found.'));
  });

  it('answers errors as JSON on the stats endpoint', async () => {
    const res = await fetch(`${base}/api/stats?user=ghost&year=2025`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: { code: 'NOT_FOUND', message: 'GitHub user not found.' } });
  });

  it('validates query parameters', async () => {
    const cases: [string, string][] = [
      // Messages are XML-escaped inside the SVG error card.
      ['/api/card/summary', 'Missing &quot;user&quot; parameter.'],
      ['/api/card/summary?user=bad%20name', 'Invalid GitHub username.'],
      ['/api/card/summary?user=<script>', 'Invalid GitHub username.'],
      ['/api/card/summary?user=octocat&year=1999', 'year must be between'],
      ['/api/card/summary?user=octocat&year=abc', 'year must be between'],
      ['/api/card/summary?user=octocat&theme=neon', 'Unknown theme'],
      ['/api/card/summary?user=octocat&tz=99', 'tz must be'],
      ['/api/card/summary?user=octocat&lang=fr', 'Unknown lang'],
      ['/api/demo/summary?lang=xx', 'Unknown lang'],
      ['/api/card/nope?user=octocat', 'Unknown card.'],
      ['/api/demo/nope', 'Unknown card.'],
    ];
    for (const [path, message] of cases) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 400, path);
      assert.ok((await res.text()).includes(message), path);
    }
  });

  it('only allows GET and HEAD', async () => {
    const res = await fetch(`${base}/api/demo/summary`, { method: 'POST' });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('allow'), 'GET, HEAD');
  });

  it('returns 404 for unknown routes', async () => {
    assert.equal((await fetch(`${base}/nothing`)).status, 404);
    assert.equal((await fetch(`${base}/api/nothing`)).status, 404);
  });
});

describe('server without a token', () => {
  it('keeps the demo working and reports a clear error for real profiles', async () => {
    const { server, base } = await start({});
    try {
      assert.equal((await fetch(`${base}/api/demo/languages`)).status, 200);
      const res = await fetch(`${base}/api/card/summary?user=octocat&year=2025`);
      assert.equal(res.status, 503);
      assert.match(await res.text(), /token is required/);
    } finally {
      server.closeAllConnections();
      await stop(server);
    }
  });
});

describe('rate limiting', () => {
  it('rejects clients over the limit with Retry-After', async () => {
    const { server, base } = await start({ rateLimitPerMinute: 3 });
    try {
      for (let i = 0; i < 3; i++) assert.equal((await fetch(`${base}/api/demo/summary`)).status, 200);
      const res = await fetch(`${base}/api/demo/summary`);
      assert.equal(res.status, 429);
      assert.ok(Number(res.headers.get('retry-after')) >= 1);
      assert.ok((await res.text()).includes('Too many requests'));
      // The landing page and health check are never throttled.
      assert.equal((await fetch(`${base}/`)).status, 200);
      assert.equal((await fetch(`${base}/healthz`)).status, 200);
    } finally {
      server.closeAllConnections();
      await stop(server);
    }
  });

  it('only trusts X-Forwarded-For when configured', async () => {
    const strict = await start({ rateLimitPerMinute: 1 });
    const proxied = await start({ rateLimitPerMinute: 1, trustProxy: true });
    try {
      const get = (base: string, ip: string) => fetch(`${base}/api/demo/summary`, { headers: { 'X-Forwarded-For': ip } });

      // Without trustProxy, spoofed headers do not create new buckets.
      assert.equal((await get(strict.base, '1.1.1.1')).status, 200);
      assert.equal((await get(strict.base, '2.2.2.2')).status, 429);

      // With trustProxy, each forwarded client has its own bucket.
      assert.equal((await get(proxied.base, '1.1.1.1')).status, 200);
      assert.equal((await get(proxied.base, '2.2.2.2')).status, 200);
      assert.equal((await get(proxied.base, '1.1.1.1')).status, 429);
    } finally {
      for (const s of [strict.server, proxied.server]) {
        s.closeAllConnections();
        await stop(s);
      }
    }
  });
});
