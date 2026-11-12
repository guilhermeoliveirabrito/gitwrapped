import type { WrappedStats } from '../types.ts';
import type { Labels } from './i18n.ts';
import { CONTENT_WIDTH, MARGIN, eyebrow, frame, panel, pill, pillWidth, text } from './svg.ts';
import type { Theme } from './svg.ts';

const TITLE_MAX_SIZE = 84;
/** Rough average glyph width of the bold title font, as a fraction of the font size. */
const TITLE_GLYPH_WIDTH = 0.58;

export function personalityCard(stats: WrappedStats, theme: Theme, l: Labels): string {
  const { m } = l;
  const id = 'gw-personality';
  const accent = `url(#${id}-accent)`;
  const { personality } = stats;
  const archetype = l.archetype(personality.id);

  // Long titles (some languages need them) shrink so they never run past the card.
  const titleSize = Math.min(
    TITLE_MAX_SIZE,
    Math.floor(CONTENT_WIDTH / (Math.max(1, archetype.title.length) * TITLE_GLYPH_WIDTH)),
  );

  const parts: string[] = [
    eyebrow(id, m.personalityEyebrow(stats.year)),
    text(MARGIN, 190, archetype.title, { size: titleSize, weight: 800, fill: accent }),
    text(MARGIN, 244, archetype.tagline, { size: 28, fill: theme.muted }),
  ];

  // Primary trait highlighted, then the secondary ones.
  let x = MARGIN;
  personality.traits.forEach((trait, i) => {
    const label = l.trait(trait);
    parts.push(pill(x, 292, label, theme, i === 0 ? theme.accentB : undefined));
    x += pillWidth(label) + 14;
  });

  const factW = (CONTENT_WIDTH - 40) / 3;
  const languageCount = stats.languages.filter((lang) => lang.name !== 'Other').length;
  const facts: [string, string][] = [
    [l.fmt(stats.activeDays), m.daysWithActivity],
    [l.fmt(stats.longestStreak.length), m.streakLabel],
    [l.fmt(languageCount), m.languagesUsed(languageCount)],
  ];
  facts.forEach(([value, label], i) => {
    const fx = MARGIN + i * (factW + 20);
    parts.push(panel(fx, 400, factW, 140, theme));
    parts.push(text(fx + 28, 470, value, { size: 56, weight: 800 }));
    parts.push(text(fx + 28, 508, label, { size: 20, fill: theme.muted }));
  });

  return frame(parts.join('\n'), theme, {
    id,
    title: `Dev personality of ${stats.login} in ${stats.year}`,
    description: `${personality.title}. ${personality.tagline}`,
  });
}
