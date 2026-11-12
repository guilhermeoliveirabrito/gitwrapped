import type { WrappedStats } from '../types.ts';
import { heatmapCard } from './heatmap.ts';
import { languagesCard } from './languages.ts';
import { personalityCard } from './personality.ts';
import { rhythmCard } from './rhythm.ts';
import { summaryCard } from './summary.ts';
import { MARGIN, THEMES, eyebrow, frame, text, truncate } from './svg.ts';
import type { ThemeName } from './svg.ts';

export { THEME_NAMES, isThemeName } from './svg.ts';
export type { ThemeName } from './svg.ts';

export const CARD_NAMES = ['summary', 'languages', 'rhythm', 'heatmap', 'personality'] as const;
export type CardName = (typeof CARD_NAMES)[number];

export function isCardName(value: string): value is CardName {
  return (CARD_NAMES as readonly string[]).includes(value);
}

const RENDERERS = {
  summary: summaryCard,
  languages: languagesCard,
  rhythm: rhythmCard,
  heatmap: heatmapCard,
  personality: personalityCard,
} as const;

/** Renders one card as a standalone 1200x630 SVG document. */
export function renderCard(name: CardName, stats: WrappedStats, theme: ThemeName = 'dark'): string {
  return RENDERERS[name](stats, THEMES[theme]);
}

/** A card that explains what went wrong; used so `<img>` embeds fail visibly instead of showing a broken icon. */
export function renderErrorCard(message: string, theme: ThemeName = 'dark'): string {
  const t = THEMES[theme];
  const id = 'gw-error';
  const body = [
    eyebrow(id, 'Git Wrapped'),
    text(MARGIN, 240, 'Could not generate this card', { size: 56, weight: 800 }),
    text(MARGIN, 300, truncate(message, 70), { size: 28, fill: t.muted }),
  ].join('\n');
  return frame(body, t, { id, title: 'Git Wrapped error', description: message });
}
