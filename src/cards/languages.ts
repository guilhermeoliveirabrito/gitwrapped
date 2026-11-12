import type { WrappedStats } from '../types.ts';
import { CONTENT_WIDTH, MARGIN, eyebrow, esc, frame, r, text, truncate } from './svg.ts';
import type { Theme } from './svg.ts';

export function languagesCard(stats: WrappedStats, theme: Theme): string {
  const id = 'gw-languages';
  const top = stats.languages[0];
  const parts: string[] = [eyebrow(id, `Top languages · ${stats.year}`)];

  if (!top) {
    parts.push(text(MARGIN, 152, 'No language data yet', { size: 52, weight: 800 }));
    parts.push(
      text(MARGIN, 190, 'Commit to repositories with a detected language to see this card.', {
        size: 24,
        fill: theme.muted,
      }),
    );
    return frame(parts.join('\n'), theme, {
      id,
      title: `Languages for ${stats.login}`,
      description: 'No language data available.',
    });
  }

  parts.push(text(MARGIN, 152, `${truncate(top.name, 22)} led your ${stats.year}`, { size: 52, weight: 800 }));
  parts.push(text(MARGIN, 190, "Share of your commits, by each repository's main language", { size: 24, fill: theme.muted }));

  // Stacked bar, clipped to a rounded rectangle.
  const barY = 232;
  const barH = 40;
  let cursor = MARGIN;
  const segments = stats.languages.map((lang) => {
    const w = Math.max(2, (lang.percent / 100) * CONTENT_WIDTH);
    const rect = `<rect x="${r(cursor)}" y="${barY}" width="${r(w)}" height="${barH}" fill="${esc(lang.color)}"/>`;
    cursor += w;
    return rect;
  });
  parts.push(`<clipPath id="${id}-clip"><rect x="${MARGIN}" y="${barY}" width="${CONTENT_WIDTH}" height="${barH}" rx="20"/></clipPath>`);
  parts.push(`<g clip-path="url(#${id}-clip)">${segments.join('')}</g>`);

  // Legend in two columns.
  const colW = CONTENT_WIDTH / 2;
  stats.languages.forEach((lang, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * colW;
    const y = 332 + row * 66;
    parts.push(`<circle cx="${x + 12}" cy="${y + 12}" r="11" fill="${esc(lang.color)}"/>`);
    parts.push(text(x + 38, y + 21, truncate(lang.name, 22), { size: 28, weight: 600 }));
    parts.push(text(x + colW - 40, y + 21, `${lang.percent}%`, { size: 28, weight: 700, fill: theme.muted, anchor: 'end' }));
  });

  return frame(parts.join('\n'), theme, {
    id,
    title: `Top languages for ${stats.login} in ${stats.year}`,
    description: stats.languages.map((l) => `${l.name} ${l.percent}%`).join(', '),
  });
}
