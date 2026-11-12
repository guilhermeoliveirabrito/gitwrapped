// Regenerates the images in docs/examples from the built-in sample data.
// Run with: npm run examples
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_NAMES, THEME_NAMES, renderCard } from '../src/cards/index.ts';
import { demoData } from '../src/demo.ts';
import { computeStats } from '../src/stats.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'examples');

// A fixed "now" keeps the output identical from run to run.
const stats = computeStats(demoData(2025), { now: new Date('2026-06-01T12:00:00Z') });

await mkdir(outDir, { recursive: true });
for (const theme of THEME_NAMES) {
  for (const card of CARD_NAMES) {
    await writeFile(path.join(outDir, `${card}-${theme}.svg`), renderCard(card, stats, theme), 'utf8');
  }
}
console.log(`Wrote ${CARD_NAMES.length * THEME_NAMES.length} cards to ${path.relative(root, outDir)}`);
