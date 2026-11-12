import type { DayContribution, RawYearData, RepoContribution } from './types.ts';

/** Small deterministic PRNG so the demo output is identical on every run. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REPOS: RepoContribution[] = [
  { nameWithOwner: 'sample-dev/awesome-cli', isPrivate: false, commits: 310, stars: 842, language: 'TypeScript', languageColor: '#3178c6' },
  { nameWithOwner: 'sample-dev/web-dashboard', isPrivate: false, commits: 128, stars: 96, language: 'TypeScript', languageColor: '#3178c6' },
  { nameWithOwner: 'sample-dev/ml-playground', isPrivate: false, commits: 96, stars: 41, language: 'Python', languageColor: '#3572a5' },
  { nameWithOwner: 'sample-dev/rusty-kv', isPrivate: false, commits: 71, stars: 213, language: 'Rust', languageColor: '#dea584' },
  { nameWithOwner: 'sample-dev/internal-tools', isPrivate: true, commits: 55, stars: 0, language: 'TypeScript', languageColor: '#3178c6' },
  { nameWithOwner: 'sample-dev/dotfiles', isPrivate: false, commits: 44, stars: 12, language: 'Shell', languageColor: '#89e051' },
  { nameWithOwner: 'sample-dev/go-gateway', isPrivate: false, commits: 38, stars: 27, language: 'Go', languageColor: '#00add8' },
  { nameWithOwner: 'sample-dev/portfolio', isPrivate: false, commits: 20, stars: 5, language: 'CSS', languageColor: '#663399' },
];

/** Relative likelihood of a commit at each hour of the day (index = hour, local time): a night owl. */
const HOUR_WEIGHTS = [
  14, 9, 4, 1.5, 0.5, 0.5, 0.5, 1, 2, 3, 4, 4, 3, 3, 4, 4, 4, 4, 5, 7, 9, 12, 20, 18,
];

/**
 * Fictional but realistic data for one year. It powers `--demo` in the CLI, the demo endpoint of
 * the web server and the example images in the README, so everything can be tried without a token.
 */
export function demoData(year = 2025): RawYearData {
  const rand = mulberry32(year);
  const days: DayContribution[] = [];
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year, 11, 31);

  for (let t = start, i = 0; t <= end; t += 86_400_000, i++) {
    const date = new Date(t).toISOString().slice(0, 10);
    const weekday = new Date(t).getUTCDay();
    const month = new Date(t).getUTCMonth();
    const isWeekend = weekday === 0 || weekday === 6;

    let chance = isWeekend ? 0.45 : 0.82;
    if (month === 7) chance *= 0.55; // summer break
    if (month === 11) chance *= 0.8;
    const forcedStreak = i >= 118 && i <= 142; // a 25 day streak in spring

    const active = forcedStreak || rand() < chance;
    const count = active ? Math.floor(rand() * rand() * 16) + 1 : 0;
    days.push({ date, count });
  }

  const totalPullRequests = 64;
  const totalIssues = 23;
  const totalReviews = 112;
  const contributions = days.reduce((sum, d) => sum + d.count, 0);

  const weightTotal = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);
  const commitTimestamps: string[] = [];
  const activeDays = days.filter((d) => d.count > 0);
  for (let n = 0; n < 420; n++) {
    const day = activeDays[Math.floor(rand() * activeDays.length)];
    if (!day) break;
    let pick = rand() * weightTotal;
    let hour = 0;
    for (let h = 0; h < 24; h++) {
      pick -= HOUR_WEIGHTS[h] ?? 0;
      if (pick <= 0) {
        hour = h;
        break;
      }
    }
    const minute = Math.floor(rand() * 60);
    commitTimestamps.push(`${day.date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
  }

  return {
    login: 'sample-dev',
    name: 'Sample Dev',
    year,
    followers: 318,
    days,
    totalCommits: Math.max(0, contributions - totalPullRequests - totalIssues - totalReviews),
    totalPullRequests,
    totalIssues,
    totalReviews,
    repos: REPOS,
    commitTimestamps,
  };
}
