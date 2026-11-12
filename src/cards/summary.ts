import type { WrappedStats } from '../types.ts';
import type { Labels } from './i18n.ts';
import { CONTENT_WIDTH, MARGIN, eyebrow, esc, frame, panel, text, truncate } from './svg.ts';
import type { Theme } from './svg.ts';

export function summaryCard(stats: WrappedStats, theme: Theme, l: Labels): string {
  const { m } = l;
  const id = 'gw-summary';
  const who = truncate(stats.name ?? stats.login, 26);
  const topLanguage = stats.languages.find((lang) => lang.name !== 'Other');
  const accent = `url(#${id}-accent)`;

  const parts: string[] = [
    eyebrow(id, `Git Wrapped · ${stats.year}`),
    text(MARGIN, 152, who, { size: 56, weight: 800 }),
    text(MARGIN, 190, m.summarySubtitle(stats.login, stats.year), { size: 24, fill: theme.muted }),
  ];

  // Row 1: four headline numbers.
  const bigW = 252;
  const bigGap = (CONTENT_WIDTH - bigW * 4) / 3;
  const big: [string, string][] = [
    [l.fmt(stats.totals.contributions), m.contributions],
    [l.fmt(stats.totals.commits), m.commits],
    [l.fmt(stats.totals.pullRequests), m.pullRequests],
    [l.fmt(stats.totals.reviews), m.codeReviews],
  ];
  big.forEach(([value, label], i) => {
    const x = MARGIN + i * (bigW + bigGap);
    parts.push(panel(x, 232, bigW, 140, theme));
    parts.push(text(x + 28, 304, value, { size: 52, weight: 800, fill: accent }));
    parts.push(text(x + 28, 340, label, { size: 20, fill: theme.muted }));
  });

  // Row 2: three supporting facts.
  const smallW = (CONTENT_WIDTH - 40) / 3;
  const small: [string, string][] = [
    [l.days(stats.activeDays), m.activeIn(stats.year)],
    [l.days(stats.longestStreak.length), m.longestStreak.toLowerCase()],
    [topLanguage ? truncate(topLanguage.name, 14) : m.noneYet, m.topLanguage],
  ];
  small.forEach(([value, label], i) => {
    const x = MARGIN + i * (smallW + 20);
    parts.push(panel(x, 392, smallW, 120, theme));
    parts.push(text(x + 28, 456, value, { size: 40, weight: 700 }));
    parts.push(text(x + 28, 488, label, { size: 18, fill: theme.muted }));
  });

  const personalityTitle = l.archetype(stats.personality.id).title;
  parts.push(
    `<text x="${MARGIN}" y="566" font-size="24" fill="${theme.muted}">${esc(m.devPersonality)}: <tspan font-weight="800" fill="${accent}">${esc(personalityTitle)}</tspan></text>`,
  );

  return frame(parts.join('\n'), theme, {
    id,
    title: `Git Wrapped ${stats.year} summary for ${stats.login}`,
    description: `${stats.totals.contributions} contributions, ${stats.totals.commits} commits, ${stats.activeDays} active days, longest streak ${stats.longestStreak.length} days. Personality: ${stats.personality.title}.`,
  });
}
