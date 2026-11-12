import { MONTH_NAMES, weekdayOf } from '../stats.ts';
import type { WrappedStats } from '../types.ts';
import { CONTENT_WIDTH, MARGIN, days as dayCount, eyebrow, fmt, frame, panel, r, shortDate, text } from './svg.ts';
import type { Theme } from './svg.ts';

function level(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}

export function heatmapCard(stats: WrappedStats, theme: Theme): string {
  const id = 'gw-heatmap';
  const accent = `url(#${id}-accent)`;
  const days = stats.calendar;

  const headline = `${fmt(stats.totals.contributions)} contributions in ${stats.year}`;
  const busiestMonth = stats.busiestMonth ? MONTH_NAMES[stats.busiestMonth.month] : null;
  const subline = busiestMonth
    ? `${fmt(stats.activeDays)} active days · busiest month: ${busiestMonth}`
    : `${fmt(stats.activeDays)} active days`;

  const parts: string[] = [
    eyebrow(id, `Contribution calendar · ${stats.year}`),
    text(MARGIN, 152, headline, { size: 52, weight: 800 }),
    text(MARGIN, 190, subline, { size: 24, fill: theme.muted }),
  ];

  const first = days[0];
  if (first) {
    const offset = weekdayOf(first.date);
    const columns = Math.ceil((days.length + offset) / 7);
    const gridX = MARGIN + 44;
    const gridY = 252;
    const step = Math.min(20, Math.floor((CONTENT_WIDTH - 44) / columns));
    const cell = step - 4;
    const max = Math.max(0, ...days.map((d) => d.count));

    // Month labels above the first column of each month.
    let lastLabelColumn = -10;
    days.forEach((day, i) => {
      if (day.date.slice(8, 10) !== '01') return;
      const column = Math.floor((i + offset) / 7);
      if (column - lastLabelColumn < 3) return;
      lastLabelColumn = column;
      const month = MONTH_NAMES[Number(day.date.slice(5, 7)) - 1] ?? '';
      parts.push(text(gridX + column * step, 240, month.slice(0, 3), { size: 14, fill: theme.muted }));
    });

    // Weekday labels (Mon / Wed / Fri).
    [1, 3, 5].forEach((row) => {
      const label = (['Mon', 'Wed', 'Fri'] as const)[(row - 1) / 2];
      parts.push(text(MARGIN, gridY + row * step + cell - 3, label ?? '', { size: 13, fill: theme.muted }));
    });

    // One square per day.
    days.forEach((day, i) => {
      const column = Math.floor((i + offset) / 7);
      const row = (i + offset) % 7;
      const fill = theme.heat[level(day.count, max)] ?? theme.heat[0];
      parts.push(
        `<rect x="${r(gridX + column * step)}" y="${gridY + row * step}" width="${cell}" height="${cell}" rx="3" fill="${fill}"/>`,
      );
    });

    // Legend.
    const legendY = gridY + 7 * step + 18;
    const legendRight = gridX + columns * step - 4;
    const squares = theme.heat.length;
    const legendX = legendRight - squares * step - 78;
    parts.push(text(legendX, legendY + 11, 'Less', { size: 14, fill: theme.muted, anchor: 'end' }));
    theme.heat.forEach((color, i) => {
      parts.push(`<rect x="${legendX + 10 + i * step}" y="${legendY}" width="${cell}" height="${cell}" rx="3" fill="${color}"/>`);
    });
    parts.push(text(legendX + 16 + squares * step, legendY + 11, 'More', { size: 14, fill: theme.muted }));
  }

  // Three facts under the calendar.
  const factW = (CONTENT_WIDTH - 40) / 3;
  const streakRange = (s: WrappedStats['longestStreak']) =>
    s.start && s.end ? (s.start === s.end ? shortDate(s.start) : `${shortDate(s.start)} to ${shortDate(s.end)}`) : 'No streak yet';
  const facts: [string, string, string][] = [
    ['Longest streak', dayCount(stats.longestStreak.length), streakRange(stats.longestStreak)],
    ['Current streak', dayCount(stats.currentStreak.length), streakRange(stats.currentStreak)],
    [
      'Busiest day',
      stats.busiestDay ? shortDate(stats.busiestDay.date) : 'None yet',
      stats.busiestDay ? `${fmt(stats.busiestDay.count)} contributions` : 'Nothing recorded',
    ],
  ];
  facts.forEach(([label, value, detail], i) => {
    const x = MARGIN + i * (factW + 20);
    parts.push(panel(x, 436, factW, 128, theme));
    parts.push(text(x + 28, 472, label, { size: 18, fill: theme.muted }));
    parts.push(text(x + 28, 518, value, { size: 38, weight: 800, fill: accent }));
    parts.push(text(x + 28, 546, detail, { size: 17, fill: theme.muted }));
  });

  return frame(parts.join('\n'), theme, {
    id,
    title: `Contribution calendar of ${stats.login} for ${stats.year}`,
    description: `${headline}. ${subline}.`,
  });
}
