import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeLanguages, computeStats, dayNumber, hourShares, weekdayOf } from '../src/stats.ts';
import { AFTER_2025, calendarYear, makeRaw } from './helpers.ts';

describe('date helpers', () => {
  it('computes consecutive day numbers across month and year boundaries', () => {
    assert.equal(dayNumber('2025-03-01') - dayNumber('2025-02-28'), 1);
    assert.equal(dayNumber('2025-01-01') - dayNumber('2024-12-31'), 1);
    assert.equal(dayNumber('2024-03-01') - dayNumber('2024-02-28'), 2); // leap year
  });

  it('returns the weekday with Sunday as 0', () => {
    assert.equal(weekdayOf('2025-11-09'), 0); // Sunday
    assert.equal(weekdayOf('2025-11-10'), 1); // Monday
    assert.equal(weekdayOf('2025-11-15'), 6); // Saturday
  });
});

describe('totals and distributions', () => {
  it('sums contributions and counts active days', () => {
    const days = calendarYear(2025, { '2025-01-01': 3, '2025-01-02': 0, '2025-06-10': 7 });
    const stats = computeStats(makeRaw({ days }), { now: AFTER_2025 });
    assert.equal(stats.totals.contributions, 10);
    assert.equal(stats.activeDays, 2);
    assert.equal(stats.daysInPeriod, 365);
  });

  it('finds the busiest day and month', () => {
    const days = calendarYear(2025, { '2025-02-03': 4, '2025-02-04': 9, '2025-07-01': 12 });
    const stats = computeStats(makeRaw({ days }), { now: AFTER_2025 });
    // July 1st is the busiest single day, but February wins as a month (4 + 9 = 13 > 12).
    assert.deepEqual(stats.busiestDay, { date: '2025-07-01', count: 12 });
    assert.deepEqual(stats.busiestMonth, { month: 1, count: 13 });
    assert.equal(stats.monthCounts[6], 12);
  });

  it('buckets contributions by weekday', () => {
    const days = calendarYear(2025, { '2025-11-09': 5, '2025-11-10': 2 });
    const stats = computeStats(makeRaw({ days }), { now: AFTER_2025 });
    assert.equal(stats.weekdayCounts[0], 5);
    assert.equal(stats.weekdayCounts[1], 2);
  });

  it('handles a year with no activity', () => {
    const stats = computeStats(makeRaw(), { now: AFTER_2025 });
    assert.equal(stats.busiestDay, null);
    assert.equal(stats.busiestMonth, null);
    assert.equal(stats.longestStreak.length, 0);
    assert.equal(stats.personality.id, 'explorer');
  });
});

describe('streaks', () => {
  it('finds the longest streak and its dates', () => {
    const days = calendarYear(2025, {
      '2025-03-01': 1,
      '2025-03-02': 1,
      '2025-03-04': 1,
      '2025-03-05': 1,
      '2025-03-06': 1,
      '2025-03-07': 1,
    });
    const { longestStreak } = computeStats(makeRaw({ days }), { now: AFTER_2025 });
    assert.deepEqual(longestStreak, { length: 4, start: '2025-03-04', end: '2025-03-07' });
  });

  it('counts a streak that crosses a month boundary', () => {
    const days = calendarYear(2025, { '2025-01-30': 1, '2025-01-31': 1, '2025-02-01': 1 });
    const { longestStreak } = computeStats(makeRaw({ days }), { now: AFTER_2025 });
    assert.equal(longestStreak.length, 3);
  });

  it('reports a current streak that reaches the end of the period', () => {
    const days = calendarYear(2025, { '2025-12-29': 1, '2025-12-30': 2, '2025-12-31': 1 });
    const { currentStreak } = computeStats(makeRaw({ days }), { now: AFTER_2025 });
    assert.deepEqual(currentStreak, { length: 3, start: '2025-12-29', end: '2025-12-31' });
  });

  it('resets the current streak when the last day of a finished year is empty', () => {
    const days = calendarYear(2025, { '2025-12-29': 1, '2025-12-30': 1 });
    const { currentStreak } = computeStats(makeRaw({ days }), { now: AFTER_2025 });
    assert.equal(currentStreak.length, 0);
  });

  it('does not break an ongoing streak because today has no contributions yet', () => {
    const days = calendarYear(2026, {}).slice(0, 10).map((d, i) => ({ ...d, count: i < 9 ? 1 : 0 }));
    const { currentStreak } = computeStats(makeRaw({ year: 2026, days }), { now: new Date('2026-01-10T08:00:00Z') });
    assert.equal(currentStreak.length, 9);
  });
});

describe('languages', () => {
  const repo = (nameWithOwner: string, commits: number, language: string | null, color: string | null = '#fff') => ({
    nameWithOwner,
    isPrivate: false,
    commits,
    stars: 0,
    language,
    languageColor: color,
  });

  it('aggregates by language and computes percentages', () => {
    const langs = computeLanguages([
      repo('a/one', 60, 'TypeScript', '#3178c6'),
      repo('a/two', 20, 'TypeScript', '#3178c6'),
      repo('a/three', 20, 'Rust', '#dea584'),
      repo('a/none', 50, null),
    ]);
    assert.deepEqual(
      langs.map((l) => [l.name, l.percent]),
      [
        ['TypeScript', 80],
        ['Rust', 20],
      ],
    );
    assert.equal(langs[0]?.color, '#3178c6');
  });

  it('groups the long tail into "Other"', () => {
    const repos = Array.from({ length: 9 }, (_, i) => repo(`a/r${i}`, 10 - i, `Lang${i}`));
    const langs = computeLanguages(repos);
    assert.equal(langs.length, 7);
    assert.equal(langs.at(-1)?.name, 'Other');
    assert.equal(langs.at(-1)?.commits, 4 + 3 + 2); // Lang6..Lang8 -> commits 4,3,2
  });

  it('returns nothing when no repo has a language', () => {
    assert.deepEqual(computeLanguages([repo('a/x', 5, null)]), []);
  });
});

describe('top repositories', () => {
  it('masks private repository names and stars', () => {
    const stats = computeStats(
      makeRaw({
        repos: [
          { nameWithOwner: 'me/secret-sauce', isPrivate: true, commits: 90, stars: 5, language: 'Go', languageColor: null },
          { nameWithOwner: 'me/public', isPrivate: false, commits: 10, stars: 7, language: 'Go', languageColor: null },
        ],
      }),
      { now: AFTER_2025 },
    );
    assert.equal(stats.topRepos[0]?.name, 'Private repository');
    assert.equal(stats.topRepos[0]?.stars, 0);
    assert.equal(stats.topRepos[1]?.name, 'me/public');
    assert.ok(!JSON.stringify(stats).includes('secret-sauce'));
  });
});

describe('commit hours', () => {
  const at = (hourUtc: number, n: number) =>
    Array.from({ length: n }, (_, i) => `2025-05-${String((i % 28) + 1).padStart(2, '0')}T${String(hourUtc).padStart(2, '0')}:15:00Z`);

  it('ignores samples that are too small to be meaningful', () => {
    const stats = computeStats(makeRaw({ commitTimestamps: at(23, 5) }), { now: AFTER_2025 });
    assert.equal(stats.peakHour, null);
    assert.equal(stats.chronotype, null);
  });

  it('finds the peak hour and chronotype', () => {
    const stats = computeStats(makeRaw({ commitTimestamps: [...at(23, 30), ...at(14, 5)] }), { now: AFTER_2025 });
    assert.equal(stats.peakHour, 23);
    assert.equal(stats.chronotype, 'night');
    assert.equal(stats.hourSampleSize, 35);
  });

  it('applies the UTC offset when bucketing hours', () => {
    const raw = makeRaw({ commitTimestamps: at(2, 20) });
    assert.equal(computeStats(raw, { now: AFTER_2025 }).peakHour, 2);
    assert.equal(computeStats(raw, { now: AFTER_2025, utcOffsetMinutes: -180 }).peakHour, 23);
    assert.equal(computeStats(raw, { now: AFTER_2025, utcOffsetMinutes: 330 }).peakHour, 7);
  });

  it('skips invalid timestamps', () => {
    const stats = computeStats(makeRaw({ commitTimestamps: ['not-a-date', ...at(10, 12)] }), { now: AFTER_2025 });
    assert.equal(stats.hourSampleSize, 12);
  });

  it('splits the day into four shares that add up to one', () => {
    const counts = new Array<number>(24).fill(1);
    const s = hourShares(counts);
    assert.ok(Math.abs(s.night + s.morning + s.afternoon + s.evening - 1) < 1e-9);
  });
});

describe('personality', () => {
  it('picks the night owl when most commits happen late', () => {
    const timestamps = Array.from({ length: 40 }, (_, i) => `2025-04-${String((i % 28) + 1).padStart(2, '0')}T0${i % 3}:00:00Z`);
    const stats = computeStats(makeRaw({ commitTimestamps: timestamps }), { now: AFTER_2025 });
    assert.equal(stats.personality.id, 'night-owl');
    assert.equal(stats.personality.traits[0], 'Night owl');
  });

  it('picks the marathoner for a long streak', () => {
    const counts: Record<string, number> = {};
    for (let d = 1; d <= 60; d++) {
      const date = new Date(Date.UTC(2025, 2, d)).toISOString().slice(0, 10);
      counts[date] = 1;
    }
    const stats = computeStats(makeRaw({ days: calendarYear(2025, counts) }), { now: AFTER_2025 });
    assert.equal(stats.longestStreak.length, 60);
    assert.equal(stats.personality.id, 'marathoner');
  });

  it('picks the collaborator when reviews and PRs dominate', () => {
    const stats = computeStats(
      // 2025-02-03 is a Monday, so the weekend heuristic does not apply.
      makeRaw({ days: calendarYear(2025, { '2025-02-03': 1 }), totalCommits: 10, totalPullRequests: 30, totalReviews: 60 }),
      { now: AFTER_2025 },
    );
    assert.equal(stats.personality.id, 'collaborator');
  });
});
