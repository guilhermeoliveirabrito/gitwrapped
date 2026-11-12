import { MIN_HOUR_SAMPLE } from '../stats.ts';
import type { WrappedStats } from '../types.ts';
import type { Labels } from './i18n.ts';
import { CONTENT_WIDTH, MARGIN, eyebrow, frame, panel, r, text } from './svg.ts';
import type { Theme } from './svg.ts';

function busiestWeekday(counts: number[]): number | null {
  const max = Math.max(0, ...counts);
  return max > 0 ? counts.indexOf(max) : null;
}

export function rhythmCard(stats: WrappedStats, theme: Theme, l: Labels): string {
  const { m } = l;
  const id = 'gw-rhythm';
  const accent = `url(#${id}-accent)`;
  const hasHours = stats.hourSampleSize >= MIN_HOUR_SAMPLE;
  const topWeekday = busiestWeekday(stats.weekdayCounts);

  const headline =
    hasHours && stats.peakHour !== null
      ? m.codeMostAround(l.hour(stats.peakHour))
      : topWeekday !== null
        ? m.dayIsYours(m.weekdays[topWeekday] ?? '')
        : m.quietYear;
  const subline =
    hasHours && stats.chronotype
      ? m.chronotype[stats.chronotype]
      : m.rhythmWeekSub;

  const parts: string[] = [
    eyebrow(id, m.rhythmEyebrow(stats.year)),
    text(MARGIN, 152, headline, { size: 52, weight: 800 }),
    text(MARGIN, 190, subline, { size: 24, fill: theme.muted }),
  ];

  // Left panel: commits by hour of day.
  const leftW = 640;
  const panelY = 226;
  const panelH = 336;
  parts.push(panel(MARGIN, panelY, leftW, panelH, theme));
  parts.push(text(MARGIN + 28, 268, m.byHour, { size: 22, weight: 700 }));

  if (hasHours) {
    parts.push(text(MARGIN + leftW - 28, 268, m.sampleOf(l.fmt(stats.hourSampleSize)), { size: 16, fill: theme.muted, anchor: 'end' }));
    const chartX = MARGIN + 28;
    const chartW = leftW - 56;
    const baseline = 514;
    const maxBar = 190;
    const step = chartW / 24;
    const barW = step - 6;
    const max = Math.max(1, ...stats.hourCounts);
    stats.hourCounts.forEach((count, hour) => {
      const h = Math.max(3, (count / max) * maxBar);
      const fill = hour === stats.peakHour ? theme.accentC : accent;
      parts.push(
        `<rect x="${r(chartX + hour * step)}" y="${r(baseline - h)}" width="${r(barW)}" height="${r(h)}" rx="4" fill="${fill}"/>`,
      );
    });
    for (const hour of [0, 6, 12, 18]) {
      parts.push(text(chartX + hour * step + barW / 2, 544, l.hour(hour), { size: 16, fill: theme.muted, anchor: 'middle' }));
    }
  } else {
    parts.push(text(MARGIN + leftW / 2, 400, m.notEnoughHours[0], { size: 22, fill: theme.muted, anchor: 'middle' }));
    parts.push(text(MARGIN + leftW / 2, 432, m.notEnoughHours[1], { size: 22, fill: theme.muted, anchor: 'middle' }));
  }

  // Right panel: contributions by weekday, Monday first.
  const rightX = MARGIN + leftW + 20;
  const rightW = CONTENT_WIDTH - leftW - 20;
  parts.push(panel(rightX, panelY, rightW, panelH, theme));
  parts.push(text(rightX + 28, 268, m.byWeekday, { size: 22, weight: 700 }));

  const order = [1, 2, 3, 4, 5, 6, 0];
  const maxDay = Math.max(1, ...stats.weekdayCounts);
  const barX = rightX + 28 + 84;
  const barMax = rightW - 28 - 84 - 28 - 64;
  order.forEach((weekday, row) => {
    const y = 296 + row * 38;
    const count = stats.weekdayCounts[weekday] ?? 0;
    const w = Math.max(count > 0 ? 4 : 0, (count / maxDay) * barMax);
    const isTop = weekday === topWeekday;
    parts.push(text(rightX + 28, y + 15, m.weekdaysShort[weekday] ?? '', { size: 18, fill: theme.muted }));
    parts.push(`<rect x="${r(barX)}" y="${y}" width="${r(w)}" height="20" rx="6" fill="${isTop ? theme.accentC : accent}"/>`);
    parts.push(text(rightX + rightW - 28, y + 16, l.fmt(count), { size: 16, fill: theme.muted, anchor: 'end' }));
  });

  return frame(parts.join('\n'), theme, {
    id,
    title: `Coding rhythm of ${stats.login} in ${stats.year}`,
    description: `${headline}. ${subline}`,
  });
}
