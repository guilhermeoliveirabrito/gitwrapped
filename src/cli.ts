import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CARD_NAMES, isCardName, isThemeName, renderCard } from './cards/index.ts';
import type { CardName, ThemeName } from './cards/index.ts';
import { days, hourLabel, shortDate } from './cards/svg.ts';
import { demoData } from './demo.ts';
import { GitWrappedError } from './errors.ts';
import { fetchYearData } from './github.ts';
import { computeStats } from './stats.ts';
import type { WrappedStats } from './types.ts';

export interface CliOptions {
  username: string | undefined;
  year: number;
  cards: CardName[];
  out: string;
  theme: ThemeName;
  /** Undefined means "use the system timezone" (or UTC for demo data). */
  utcOffsetMinutes: number | undefined;
  json: boolean;
  demo: boolean;
  help: boolean;
  version: boolean;
}

export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  env: Record<string, string | undefined>;
  cwd: string;
  /** Injectable for tests. */
  now?: Date;
  fetchImpl?: typeof fetch;
  /** Force colors on or off. Defaults to "on when stdout is a TTY and NO_COLOR is unset". */
  color?: boolean;
}

export const HELP = `gitwrapped - your year in code, wrapped

Usage
  gitwrapped <username> [options]
  gitwrapped --demo [options]

Options
  -y, --year <year>     Year to summarize (default: current year)
  -c, --card <names>    Comma separated list of cards, or "all" (default: all)
                        Cards: ${CARD_NAMES.join(', ')}
  -t, --theme <theme>   dark or light (default: dark)
  -o, --out <dir>       Output directory (default: ./wrapped)
      --tz=<hours>      UTC offset for the hourly chart, e.g. --tz=-3 or --tz=5.5
                        (default: your system timezone)
      --json            Print the computed stats as JSON instead of writing cards
      --demo            Use built-in sample data, no token needed
  -h, --help            Show this help
  -v, --version         Show the version

Authentication
  Set GITHUB_TOKEN (or GH_TOKEN) to a GitHub personal access token.
  Public data needs no scopes. Add the read:user scope to include private
  contribution counts.

Examples
  gitwrapped octocat
  gitwrapped octocat --year 2024 --card summary,heatmap --theme light
  gitwrapped --demo --out ./preview
`;

function invalid(message: string): GitWrappedError {
  return new GitWrappedError('INVALID_INPUT', message);
}

/** Parses command line arguments. Throws `GitWrappedError('INVALID_INPUT')` on bad input. */
export function parseCli(argv: string[], now: Date = new Date()): CliOptions {
  let parsed: ReturnType<typeof parseArgs<{ options: typeof OPTION_SPEC; allowPositionals: true }>>;
  try {
    parsed = parseArgs({ args: argv, allowPositionals: true, options: OPTION_SPEC });
  } catch (error) {
    throw invalid(error instanceof Error ? error.message : String(error));
  }
  const { values, positionals } = parsed;

  if (positionals.length > 1) throw invalid(`Expected a single username but got ${positionals.length} arguments.`);
  const username = positionals[0]?.replace(/^@/, '');

  const year = values.year === undefined ? now.getFullYear() : Number(values.year);
  if (!Number.isInteger(year)) throw invalid(`Invalid year: "${values.year}".`);

  const theme = values.theme ?? 'dark';
  if (!isThemeName(theme)) throw invalid(`Unknown theme "${theme}". Use dark or light.`);

  let cards: CardName[] = [...CARD_NAMES];
  if (values.card !== undefined && values.card !== 'all') {
    const requested = values.card.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
    const unknown = requested.filter((c) => !isCardName(c));
    if (requested.length === 0 || unknown.length > 0) {
      throw invalid(`Unknown card "${unknown[0] ?? values.card}". Available: ${CARD_NAMES.join(', ')}.`);
    }
    cards = [...new Set(requested)] as CardName[];
  }

  let utcOffsetMinutes: number | undefined;
  if (values.tz !== undefined) {
    const hours = Number(values.tz);
    if (!Number.isFinite(hours) || hours < -12 || hours > 14) {
      throw invalid(`Invalid --tz "${values.tz}". Use an offset in hours between -12 and 14, e.g. --tz=-3.`);
    }
    utcOffsetMinutes = Math.round(hours * 60);
  }

  return {
    username,
    year,
    cards,
    out: values.out ?? 'wrapped',
    theme,
    utcOffsetMinutes,
    json: values.json ?? false,
    demo: values.demo ?? false,
    help: values.help ?? false,
    version: values.version ?? false,
  };
}

const OPTION_SPEC = {
  year: { type: 'string', short: 'y' },
  card: { type: 'string', short: 'c' },
  theme: { type: 'string', short: 't' },
  out: { type: 'string', short: 'o' },
  tz: { type: 'string' },
  json: { type: 'boolean' },
  demo: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
} as const;

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function painter(enabled: boolean) {
  const wrap = (open: number, close: number) => (s: string) => (enabled ? `\u001b[${open}m${s}\u001b[${close}m` : s);
  return { bold: wrap(1, 22), dim: wrap(2, 22), magenta: wrap(35, 39), cyan: wrap(36, 39), green: wrap(32, 39) };
}

function renderSummary(stats: WrappedStats, c: ReturnType<typeof painter>): string {
  const n = (v: number) => new Intl.NumberFormat('en-US').format(v);
  const lines: string[] = [];
  lines.push('');
  lines.push(`  ${c.bold(c.magenta(`Git Wrapped ${stats.year}`))} ${c.dim('·')} ${c.bold(`@${stats.login}`)}`);
  lines.push('');
  lines.push(
    `  ${c.bold(n(stats.totals.contributions))} contributions   ${c.bold(n(stats.totals.commits))} commits   ` +
      `${c.bold(n(stats.totals.pullRequests))} PRs   ${c.bold(n(stats.totals.reviews))} reviews`,
  );
  lines.push(
    `  ${c.bold(days(stats.activeDays))} active ${c.dim('·')} longest streak ${c.bold(days(stats.longestStreak.length))} ` +
      `${c.dim('·')} current streak ${c.bold(days(stats.currentStreak.length))}`,
  );
  if (stats.busiestDay) {
    lines.push(`  Busiest day: ${c.bold(shortDate(stats.busiestDay.date))} (${n(stats.busiestDay.count)} contributions)`);
  }
  if (stats.peakHour !== null && stats.chronotype) {
    lines.push(`  Peak hour: ${c.bold(hourLabel(stats.peakHour))} ${c.dim(`(${stats.chronotype} coder)`)}`);
  }
  if (stats.languages.length > 0) {
    lines.push('');
    lines.push(`  ${c.bold('Languages')}`);
    const nameWidth = Math.max(...stats.languages.map((l) => l.name.length));
    for (const lang of stats.languages) {
      const filled = Math.max(1, Math.round((lang.percent / 100) * 24));
      const bar = c.cyan('█'.repeat(filled)) + c.dim('░'.repeat(24 - filled));
      lines.push(`  ${lang.name.padEnd(nameWidth)} ${bar} ${lang.percent}%`);
    }
  }
  lines.push('');
  lines.push(`  ${stats.personality.emoji} ${c.bold(stats.personality.title)}`);
  lines.push(`  ${c.dim(stats.personality.tagline)}`);
  lines.push('');
  return lines.join('\n');
}

function hintFor(error: GitWrappedError): string {
  switch (error.code) {
    case 'NO_TOKEN':
      return [
        'Create a token at https://github.com/settings/tokens (no scopes needed for public data)',
        'and export it, e.g.  export GITHUB_TOKEN=ghp_...',
        'Or try the built-in sample data with:  gitwrapped --demo',
      ].join('\n');
    case 'INVALID_INPUT':
      return 'Run gitwrapped --help for usage.';
    default:
      return '';
  }
}

/** Runs the CLI and returns the process exit code. */
export async function run(argv: string[], io: CliIO): Promise<number> {
  const now = io.now ?? new Date();
  const color = painter(io.color ?? (io.env.NO_COLOR === undefined && Boolean(process.stdout.isTTY)));

  try {
    const options = parseCli(argv, now);

    if (options.help || (argv.length === 0 && !options.demo)) {
      io.stdout(HELP);
      return 0;
    }
    if (options.version) {
      io.stdout(`${readVersion()}\n`);
      return 0;
    }

    let raw;
    if (options.demo) {
      raw = demoData(options.year);
    } else {
      if (!options.username) throw invalid('Missing GitHub username.');
      const token = io.env.GITHUB_TOKEN ?? io.env.GH_TOKEN ?? '';
      const fetchOptions = { token, year: options.year, now, ...(io.fetchImpl ? { fetchImpl: io.fetchImpl } : {}) };
      raw = await fetchYearData(options.username, fetchOptions);
    }

    // Demo timestamps are already "local"; real data defaults to the machine's timezone.
    const utcOffsetMinutes = options.utcOffsetMinutes ?? (options.demo ? 0 : -now.getTimezoneOffset());
    const stats = computeStats(raw, { utcOffsetMinutes, now });

    if (options.json) {
      io.stdout(`${JSON.stringify(stats, null, 2)}\n`);
      return 0;
    }

    const outDir = path.resolve(io.cwd, options.out);
    await mkdir(outDir, { recursive: true });
    const written: string[] = [];
    for (const card of options.cards) {
      const file = path.join(outDir, `${stats.login}-${stats.year}-${card}.svg`);
      await writeFile(file, renderCard(card, stats, options.theme), 'utf8');
      written.push(file);
    }

    // Show paths relative to the current directory unless that would climb out of it.
    const display = (p: string) => {
      const relative = path.relative(io.cwd, p);
      return relative.startsWith('..') || path.isAbsolute(relative) ? p : relative || '.';
    };

    io.stdout(renderSummary(stats, color));
    io.stdout(`\n  ${color.green('✔')} Saved ${written.length} card${written.length === 1 ? '' : 's'} to ${color.bold(display(outDir))}\n`);
    for (const file of written) io.stdout(`    ${color.dim(display(file))}\n`);
    io.stdout('\n');
    return 0;
  } catch (error) {
    if (error instanceof GitWrappedError) {
      io.stderr(`error: ${error.message}\n`);
      const hint = hintFor(error);
      if (hint) io.stderr(`\n${hint}\n`);
      return error.code === 'INVALID_INPUT' ? 2 : 1;
    }
    io.stderr(`error: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
