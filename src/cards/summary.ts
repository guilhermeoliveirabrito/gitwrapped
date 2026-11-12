import type { WrappedStats } from '../types.ts';
import { CONTENT_WIDTH, MARGIN, days, eyebrow, esc, fmt, frame, panel, text, truncate } from './svg.ts';
import type { Theme } from './svg.ts';

export function summaryCard(stats: WrappedStats, theme: Theme): string {
  const id = 'gw-summary';
  const who = truncate(stats.name ?? stats.login, 26);
  const topLanguage = stats.languages.find((l) => l.name !== 'Other');
  const accent = `url(#${id}-accent)`;

  const parts: string[] = [
    eyebrow(id, `Git Wrapped · ${stats.year}`),
    text(MARGIN, 152, who, { size: 56, weight: 800 }),
    text(MARGIN, 190, `@${stats.login} · ${stats.year} in code`, { size: 24, fill: theme.muted }),
  ];

  // Row 1: four headline numbers.
  const bigW = 252;
  const bigGap = (CONTENT_WIDTH - bigW * 4) / 3;
  const big: [string, string][] = [
    [fmt(stats.totals.contributions), 'contributions'],
    [fmt(stats.totals.commits), 'commits'],
    [fmt(stats.totals.pullRequests), 'pull requests'],
    [fmt(stats.totals.reviews), 'code reviews'],
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
    [days(stats.activeDays), `active in ${stats.year}`],
    [days(stats.longestStreak.length), 'longest streak'],
    [topLanguage ? truncate(topLanguage.name, 14) : 'None yet', 'top language'],
  ];
  small.forEach(([value, label], i) => {
    const x = MARGIN + i * (smallW + 20);
    parts.push(panel(x, 392, smallW, 120, theme));
    parts.push(text(x + 28, 456, value, { size: 40, weight: 700 }));
    parts.push(text(x + 28, 488, label, { size: 18, fill: theme.muted }));
  });

  parts.push(
    `<text x="${MARGIN}" y="566" font-size="24" fill="${theme.muted}">Dev personality: <tspan font-weight="800" fill="${accent}">${esc(stats.personality.title)}</tspan></text>`,
  );

  return frame(parts.join('\n'), theme, {
    id,
    title: `Git Wrapped ${stats.year} summary for ${stats.login}`,
    description: `${stats.totals.contributions} contributions, ${stats.totals.commits} commits, ${stats.activeDays} active days, longest streak ${stats.longestStreak.length} days. Personality: ${stats.personality.title}.`,
  });
}
