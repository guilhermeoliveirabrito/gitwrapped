import type { WrappedStats } from '../types.ts';
import type { Labels } from './i18n.ts';
import { CONTENT_WIDTH, MARGIN, eyebrow, frame, panel, r, text, truncate } from './svg.ts';
import type { Theme } from './svg.ts';

/** A five pointed star centered on (cx, cy). Drawn as a shape so it never depends on font glyphs. */
function star(cx: number, cy: number, outer: number, fill: string): string {
  const inner = outer * 0.4;
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = ((-90 + i * 36) * Math.PI) / 180;
    const radius = i % 2 === 0 ? outer : inner;
    return `${r(cx + radius * Math.cos(angle))},${r(cy + radius * Math.sin(angle))}`;
  }).join(' ');
  return `<polygon points="${points}" fill="${fill}"/>`;
}

export function reposCard(stats: WrappedStats, theme: Theme, l: Labels): string {
  const { m } = l;
  const id = 'gw-repos';
  const accent = `url(#${id}-accent)`;
  const repos = stats.topRepos;

  const parts: string[] = [
    eyebrow(id, m.reposEyebrow(stats.year)),
    text(MARGIN, 152, m.reposTitle, { size: 52, weight: 800 }),
  ];

  if (repos.length === 0) {
    parts.push(text(MARGIN, 190, m.noRepos, { size: 24, fill: theme.muted }));
    return frame(parts.join('\n'), theme, {
      id,
      title: `Top repositories of ${stats.login} in ${stats.year}`,
      description: 'No repository activity available.',
    });
  }

  parts.push(text(MARGIN, 190, m.reposSub, { size: 24, fill: theme.muted }));

  const rowHeight = 56;
  const gap = 12;
  const startY = 226;
  const maxCommits = Math.max(1, ...repos.map((repo) => repo.commits));
  const trackX = MARGIN + 500;
  const trackWidth = 200;

  repos.forEach((repo, i) => {
    const y = startY + i * (rowHeight + gap);
    const mid = y + rowHeight / 2;
    parts.push(panel(MARGIN, y, CONTENT_WIDTH, rowHeight, theme, 16));
    parts.push(text(MARGIN + 24, mid + 8, String(i + 1), { size: 22, weight: 800, fill: accent }));
    parts.push(text(MARGIN + 64, mid + 9, truncate(repo.isPrivate ? m.privateRepo : repo.name, 28), { size: 26, weight: 600 }));

    const barWidth = Math.max(6, (repo.commits / maxCommits) * trackWidth);
    parts.push(
      `<rect x="${trackX}" y="${r(mid - 6)}" width="${trackWidth}" height="12" rx="6" fill="${theme.panel}" fill-opacity="${theme.panelOpacity * 2}"/>`,
      `<rect x="${trackX}" y="${r(mid - 6)}" width="${r(barWidth)}" height="12" rx="6" fill="${accent}"/>`,
    );

    if (repo.isPrivate) {
      parts.push(text(MARGIN + 730, mid + 7, m.privateLabel, { size: 18, fill: theme.muted }));
    } else {
      parts.push(star(MARGIN + 738, mid, 9, theme.accentC));
      parts.push(text(MARGIN + 756, mid + 7, l.fmt(repo.stars), { size: 20, fill: theme.muted }));
    }

    const label = l.commitCount(repo.commits);
    parts.push(text(MARGIN + CONTENT_WIDTH - 24, mid + 8, label, { size: 22, weight: 700, anchor: 'end' }));
  });

  return frame(parts.join('\n'), theme, {
    id,
    title: `Top repositories of ${stats.login} in ${stats.year}`,
    description: repos.map((repo, i) => `${i + 1}. ${repo.name}, ${repo.commits} commits`).join('; '),
  });
}
