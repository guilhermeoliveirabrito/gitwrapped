/** Tiny SVG toolkit: escaping, formatting, themes and the shared card frame. */

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
export const MARGIN = 64;
export const CONTENT_WIDTH = CARD_WIDTH - MARGIN * 2;

export type ThemeName = 'dark' | 'light';
export const THEME_NAMES: readonly ThemeName[] = ['dark', 'light'];

export interface Theme {
  name: ThemeName;
  bgFrom: string;
  bgTo: string;
  text: string;
  muted: string;
  /** Fill of panels; combined with `panelOpacity`. */
  panel: string;
  panelOpacity: number;
  accentA: string;
  accentB: string;
  accentC: string;
  /** Five contribution intensity levels, lowest first. */
  heat: [string, string, string, string, string];
}

export const THEMES: Record<ThemeName, Theme> = {
  dark: {
    name: 'dark',
    bgFrom: '#0b0f1a',
    bgTo: '#161a33',
    text: '#f8fafc',
    muted: '#94a3b8',
    panel: '#ffffff',
    panelOpacity: 0.06,
    accentA: '#8b5cf6',
    accentB: '#ec4899',
    accentC: '#22d3ee',
    heat: ['#1b2033', '#0e4429', '#006d32', '#26a641', '#39d353'],
  },
  light: {
    name: 'light',
    bgFrom: '#f8fafc',
    bgTo: '#e8ecff',
    text: '#0f172a',
    muted: '#475569',
    panel: '#0f172a',
    panelOpacity: 0.05,
    accentA: '#7c3aed',
    accentB: '#db2777',
    accentC: '#0891b2',
    heat: ['#e2e8f0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  },
};

export function isThemeName(value: string): value is ThemeName {
  return value === 'dark' || value === 'light';
}

/** Escapes text for use in SVG text nodes and attribute values. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const numberFormat = new Intl.NumberFormat('en-US');
export function fmt(n: number): string {
  return numberFormat.format(n);
}

/** `1` -> `1 day`, `35` -> `35 days`. */
export function days(n: number): string {
  return `${fmt(n)} ${n === 1 ? 'day' : 'days'}`;
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
}

/** Rounds to two decimals so coordinates stay short and free of floating point noise. */
export function r(n: number): number {
  return Math.round(n * 100) / 100;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2025-03-04` -> `Mar 4`. */
export function shortDate(date: string): string {
  const month = SHORT_MONTHS[Number(date.slice(5, 7)) - 1] ?? '';
  return `${month} ${Number(date.slice(8, 10))}`;
}

/** `5` -> `5am`, `0` -> `12am`, `15` -> `3pm`. */
export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? 'am' : 'pm';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${suffix}`;
}

export interface TextOptions {
  size?: number;
  weight?: number | string;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  spacing?: number;
  opacity?: number;
}

export function text(x: number, y: number, content: string, options: TextOptions = {}): string {
  const { size = 24, weight = 400, fill, anchor = 'start', spacing, opacity } = options;
  const attrs = [
    `x="${r(x)}"`,
    `y="${r(y)}"`,
    `font-size="${size}"`,
    `font-weight="${weight}"`,
    fill ? `fill="${fill}"` : '',
    anchor !== 'start' ? `text-anchor="${anchor}"` : '',
    spacing !== undefined ? `letter-spacing="${spacing}"` : '',
    opacity !== undefined ? `opacity="${opacity}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<text ${attrs}>${esc(content)}</text>`;
}

export function panel(x: number, y: number, w: number, h: number, theme: Theme, radius = 20): string {
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${radius}" fill="${theme.panel}" fill-opacity="${theme.panelOpacity}"/>`;
}

export function pillWidth(label: string): number {
  return Math.round(label.length * 12.5 + 44);
}

export function pill(x: number, y: number, label: string, theme: Theme, fill?: string): string {
  const width = pillWidth(label);
  const height = 44;
  const background = fill ?? theme.panel;
  const opacity = fill ? 0.18 : theme.panelOpacity * 1.6;
  return [
    `<rect x="${r(x)}" y="${r(y)}" width="${width}" height="${height}" rx="22" fill="${background}" fill-opacity="${opacity}"/>`,
    text(x + width / 2, y + 29, label, { size: 20, weight: 600, fill: theme.text, anchor: 'middle' }),
  ].join('');
}

export interface FrameOptions {
  /** Unique per card so several inline SVGs in one HTML page do not share gradient ids. */
  id: string;
  title: string;
  description: string;
  footerLeft?: string;
  footerRight?: string;
}

const FONT = "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif";

/** Wraps card content in the shared background, decoration, footer and accessibility metadata. */
export function frame(body: string, theme: Theme, options: FrameOptions): string {
  const { id } = options;
  const footerLeft = options.footerLeft ?? 'gitwrapped';
  const footerRight = options.footerRight ?? 'github.com/guilhermeoliveirabrito/gitwrapped';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img" aria-labelledby="${id}-t ${id}-d">`,
    `<title id="${id}-t">${esc(options.title)}</title>`,
    `<desc id="${id}-d">${esc(options.description)}</desc>`,
    '<defs>',
    `<linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${theme.bgFrom}"/><stop offset="1" stop-color="${theme.bgTo}"/></linearGradient>`,
    `<linearGradient id="${id}-accent" gradientUnits="userSpaceOnUse" x1="${MARGIN}" y1="0" x2="${CARD_WIDTH - MARGIN}" y2="0"><stop offset="0" stop-color="${theme.accentA}"/><stop offset="0.55" stop-color="${theme.accentB}"/><stop offset="1" stop-color="${theme.accentC}"/></linearGradient>`,
    `<radialGradient id="${id}-glow-a"><stop offset="0" stop-color="${theme.accentA}" stop-opacity="0.35"/><stop offset="1" stop-color="${theme.accentA}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="${id}-glow-b"><stop offset="0" stop-color="${theme.accentC}" stop-opacity="0.22"/><stop offset="1" stop-color="${theme.accentC}" stop-opacity="0"/></radialGradient>`,
    '</defs>',
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#${id}-bg)"/>`,
    `<circle cx="1080" cy="40" r="360" fill="url(#${id}-glow-a)"/>`,
    `<circle cx="80" cy="620" r="320" fill="url(#${id}-glow-b)"/>`,
    `<g font-family="${FONT}" fill="${theme.text}">`,
    body,
    text(MARGIN, CARD_HEIGHT - 26, footerLeft, { size: 18, weight: 700, fill: `url(#${id}-accent)` }),
    text(CARD_WIDTH - MARGIN, CARD_HEIGHT - 26, footerRight, { size: 16, fill: theme.muted, anchor: 'end' }),
    '</g>',
    '</svg>',
  ].join('\n');
}

/** Small uppercase label at the top of every card. */
export function eyebrow(id: string, label: string): string {
  return text(MARGIN, 88, label.toUpperCase(), { size: 18, weight: 700, spacing: 4, fill: `url(#${id}-accent)` });
}
