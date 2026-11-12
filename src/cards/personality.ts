import type { WrappedStats } from '../types.ts';
import { CONTENT_WIDTH, MARGIN, eyebrow, fmt, frame, panel, pill, pillWidth, text } from './svg.ts';
import type { Theme } from './svg.ts';

export function personalityCard(stats: WrappedStats, theme: Theme): string {
  const id = 'gw-personality';
  const accent = `url(#${id}-accent)`;
  const { personality } = stats;

  const parts: string[] = [
    eyebrow(id, `Your dev personality · ${stats.year}`),
    text(MARGIN, 190, personality.title, { size: 84, weight: 800, fill: accent }),
    text(MARGIN, 244, personality.tagline, { size: 28, fill: theme.muted }),
  ];

  // Primary trait highlighted, then the secondary ones.
  let x = MARGIN;
  personality.traits.forEach((trait, i) => {
    parts.push(pill(x, 292, trait, theme, i === 0 ? theme.accentB : undefined));
    x += pillWidth(trait) + 14;
  });

  const factW = (CONTENT_WIDTH - 40) / 3;
  const languageCount = stats.languages.filter((l) => l.name !== 'Other').length;
  const facts: [string, string][] = [
    [fmt(stats.activeDays), 'days with activity'],
    [fmt(stats.longestStreak.length), 'day longest streak'],
    [fmt(languageCount), languageCount === 1 ? 'language used' : 'languages used'],
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
