import type { DayContribution, RawYearData } from '../src/types.ts';

/** Builds a full calendar year where `counts` maps `YYYY-MM-DD` to a contribution count (default 0). */
export function calendarYear(year: number, counts: Record<string, number> = {}): DayContribution[] {
  const days: DayContribution[] = [];
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year, 11, 31);
  for (let t = start; t <= end; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    days.push({ date, count: counts[date] ?? 0 });
  }
  return days;
}

export function makeRaw(overrides: Partial<RawYearData> = {}): RawYearData {
  const year = overrides.year ?? 2025;
  return {
    login: 'tester',
    name: 'Test User',
    year,
    followers: 3,
    days: calendarYear(year),
    totalCommits: 0,
    totalPullRequests: 0,
    totalIssues: 0,
    totalReviews: 0,
    repos: [],
    commitTimestamps: [],
    ...overrides,
  };
}

/** A finished year, so "ongoing" logic never kicks in. */
export const AFTER_2025 = new Date('2026-06-01T12:00:00Z');

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

/** A `fetch` stand-in for the GitHub GraphQL API. The login "ghost" does not exist. */
export function githubFetchMock() {
  const calls: { query: string; variables: Record<string, unknown> }[] = [];
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
    calls.push(body);

    if (body.query.includes('WrappedHistory')) return jsonResponse({ data: { r0: null } });

    const login = String(body.variables.login);
    if (login === 'ghost') {
      return jsonResponse({ data: { user: null }, errors: [{ type: 'NOT_FOUND', message: 'Could not resolve to a User' }] });
    }
    return jsonResponse({
      data: {
        user: {
          id: 'U_1',
          login,
          name: `Name of ${login}`,
          followers: { totalCount: 5 },
          contributionsCollection: {
            totalCommitContributions: 8,
            totalIssueContributions: 1,
            totalPullRequestContributions: 2,
            totalPullRequestReviewContributions: 3,
            contributionCalendar: {
              weeks: [
                {
                  contributionDays: [
                    { date: '2025-03-03', contributionCount: 5 },
                    { date: '2025-03-04', contributionCount: 9 },
                  ],
                },
              ],
            },
            commitContributionsByRepository: [
              {
                repository: {
                  nameWithOwner: `${login}/project`,
                  isPrivate: false,
                  stargazerCount: 12,
                  primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
                },
                contributions: { totalCount: 8 },
              },
            ],
          },
        },
      },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}
