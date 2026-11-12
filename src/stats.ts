import { pickPersonality } from './personality.ts';
import type { HourShares } from './personality.ts';
import type {
  Chronotype,
  DayContribution,
  LanguageShare,
  RawYearData,
  Streak,
  TopRepo,
  WrappedStats,
} from './types.ts';

export interface StatsOptions {
  /** Offset from UTC in minutes used to bucket commit hours, e.g. -180 for UTC-3. Default 0. */
  utcOffsetMinutes?: number;
  /** Injectable for tests. Used to decide whether the year is still in progress. */
  now?: Date;
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Below this many sampled timestamps we do not draw conclusions about hours. */
export const MIN_HOUR_SAMPLE = 10;
const MAX_LANGUAGES = 6;
const MAX_TOP_REPOS = 5;
const OTHER_COLOR = '#6e7681';
const DEFAULT_LANGUAGE_COLOR = '#8b949e';

/** Days since the Unix epoch for a `YYYY-MM-DD` string. */
export function dayNumber(date: string): number {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Weekday (0 = Sunday) for a `YYYY-MM-DD` string. */
export function weekdayOf(date: string): number {
  return new Date(dayNumber(date) * 86_400_000).getUTCDay();
}

function longestStreakOf(days: DayContribution[]): Streak {
  let best: Streak = { length: 0, start: null, end: null };
  let run: Streak = { length: 0, start: null, end: null };
  let previousActive = Number.NaN;

  for (const day of days) {
    if (day.count <= 0) continue;
    const n = dayNumber(day.date);
    run =
      run.length > 0 && n === previousActive + 1
        ? { length: run.length + 1, start: run.start, end: day.date }
        : { length: 1, start: day.date, end: day.date };
    previousActive = n;
    if (run.length > best.length) best = run;
  }
  return best;
}

function currentStreakOf(days: DayContribution[], ongoing: boolean): Streak {
  let i = days.length - 1;
  // An in-progress day with no contributions yet should not break a running streak.
  if (ongoing && days[i]?.count === 0) i--;

  let length = 0;
  let start: string | null = null;
  let end: string | null = null;
  let expected = Number.NaN;
  while (i >= 0) {
    const day = days[i];
    if (!day || day.count <= 0) break;
    const n = dayNumber(day.date);
    if (length > 0 && n !== expected) break;
    end ??= day.date;
    start = day.date;
    length++;
    expected = n - 1;
    i--;
  }
  return { length, start, end };
}

export function computeLanguages(repos: RawYearData['repos']): LanguageShare[] {
  const totals = new Map<string, { color: string; commits: number }>();
  for (const repo of repos) {
    if (!repo.language || repo.commits <= 0) continue;
    const entry = totals.get(repo.language) ?? { color: repo.languageColor ?? DEFAULT_LANGUAGE_COLOR, commits: 0 };
    entry.commits += repo.commits;
    totals.set(repo.language, entry);
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1].commits - a[1].commits);
  const total = sorted.reduce((sum, [, v]) => sum + v.commits, 0);
  if (total === 0) return [];

  const percent = (commits: number) => Math.round((commits / total) * 1000) / 10;
  const top = sorted.slice(0, MAX_LANGUAGES).map(([name, v]) => ({
    name,
    color: v.color,
    commits: v.commits,
    percent: percent(v.commits),
  }));

  const restCommits = sorted.slice(MAX_LANGUAGES).reduce((sum, [, v]) => sum + v.commits, 0);
  if (restCommits > 0) {
    top.push({ name: 'Other', color: OTHER_COLOR, commits: restCommits, percent: percent(restCommits) });
  }
  return top;
}

function computeTopRepos(repos: RawYearData['repos']): TopRepo[] {
  return repos
    .filter((r) => r.commits > 0)
    .slice()
    .sort((a, b) => b.commits - a.commits)
    .slice(0, MAX_TOP_REPOS)
    .map((r) => ({
      // Never leak the name of a private repository.
      name: r.isPrivate ? 'Private repository' : r.nameWithOwner,
      commits: r.commits,
      stars: r.isPrivate ? 0 : r.stars,
      isPrivate: r.isPrivate,
    }));
}

function computeHours(
  timestamps: string[],
  year: number,
  offsetMinutes: number,
): { counts: number[]; size: number } {
  const counts = new Array<number>(24).fill(0);
  let size = 0;
  for (const ts of timestamps) {
    const ms = Date.parse(ts);
    if (Number.isNaN(ms)) continue;
    const local = new Date(ms + offsetMinutes * 60_000);
    if (local.getUTCFullYear() !== year) continue;
    counts[local.getUTCHours()] = (counts[local.getUTCHours()] ?? 0) + 1;
    size++;
  }
  return { counts, size };
}

/** Night 22-04, morning 05-11, afternoon 12-17, evening 18-21. */
export function hourShares(counts: number[]): HourShares {
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const sum = (hours: number[]) => hours.reduce((acc, h) => acc + (counts[h] ?? 0), 0) / total;
  return {
    night: sum([22, 23, 0, 1, 2, 3, 4]),
    morning: sum([5, 6, 7, 8, 9, 10, 11]),
    afternoon: sum([12, 13, 14, 15, 16, 17]),
    evening: sum([18, 19, 20, 21]),
  };
}

function chronotypeOf(shares: HourShares): Chronotype {
  const entries = Object.entries(shares) as [Chronotype, number][];
  return entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'afternoon';
}

/** Turns raw GitHub data into everything the cards need. Pure and deterministic. */
export function computeStats(raw: RawYearData, options: StatsOptions = {}): WrappedStats {
  const offset = options.utcOffsetMinutes ?? 0;
  const now = options.now ?? new Date();
  const days = raw.days;

  const contributions = days.reduce((sum, d) => sum + d.count, 0);
  const activeDays = days.filter((d) => d.count > 0).length;
  const ongoing = raw.year === now.getUTCFullYear();

  const weekdayCounts = new Array<number>(7).fill(0);
  const monthCounts = new Array<number>(12).fill(0);
  let busiestDay: WrappedStats['busiestDay'] = null;
  for (const day of days) {
    const weekday = weekdayOf(day.date);
    const month = Number(day.date.slice(5, 7)) - 1;
    weekdayCounts[weekday] = (weekdayCounts[weekday] ?? 0) + day.count;
    monthCounts[month] = (monthCounts[month] ?? 0) + day.count;
    if (day.count > 0 && (!busiestDay || day.count > busiestDay.count)) {
      busiestDay = { date: day.date, count: day.count };
    }
  }

  const topMonthCount = Math.max(0, ...monthCounts);
  const busiestMonth =
    topMonthCount > 0 ? { month: monthCounts.indexOf(topMonthCount), count: topMonthCount } : null;

  const hours = computeHours(raw.commitTimestamps, raw.year, offset);
  const hasHours = hours.size >= MIN_HOUR_SAMPLE;
  const shares = hasHours ? hourShares(hours.counts) : null;
  const topHourCount = Math.max(0, ...hours.counts);
  const peakHour = hasHours && topHourCount > 0 ? hours.counts.indexOf(topHourCount) : null;

  const languages = computeLanguages(raw.repos);
  const longestStreak = longestStreakOf(days);

  const activeCounts = days
    .filter((d) => d.count > 0)
    .map((d) => d.count)
    .sort((a, b) => b - a);
  const burstDays = Math.max(1, Math.ceil(activeCounts.length * 0.1));
  const burstTotal = activeCounts.slice(0, burstDays).reduce((a, b) => a + b, 0);
  const weekendTotal = (weekdayCounts[0] ?? 0) + (weekdayCounts[6] ?? 0);

  const personality = pickPersonality({
    commits: raw.totalCommits,
    pullRequests: raw.totalPullRequests,
    issues: raw.totalIssues,
    reviews: raw.totalReviews,
    activeDays,
    daysInPeriod: days.length,
    longestStreak: longestStreak.length,
    weekendShare: contributions > 0 ? weekendTotal / contributions : 0,
    hourShares: shares,
    languageCount: languages.filter((l) => l.name !== 'Other').length,
    topLanguageShare: (languages[0]?.percent ?? 0) / 100,
    burstShare: contributions > 0 ? burstTotal / contributions : 0,
  });

  return {
    login: raw.login,
    name: raw.name,
    year: raw.year,
    followers: raw.followers,
    totals: {
      contributions,
      commits: raw.totalCommits,
      pullRequests: raw.totalPullRequests,
      issues: raw.totalIssues,
      reviews: raw.totalReviews,
    },
    activeDays,
    daysInPeriod: days.length,
    longestStreak,
    currentStreak: currentStreakOf(days, ongoing),
    busiestDay,
    busiestMonth,
    weekdayCounts,
    monthCounts,
    hourCounts: hours.counts,
    hourSampleSize: hours.size,
    peakHour,
    chronotype: shares ? chronotypeOf(shares) : null,
    languages,
    topRepos: computeTopRepos(raw.repos),
    personality,
    calendar: days,
  };
}
