import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GitWrappedError } from '../src/errors.ts';
import { buildHistoryQuery, fetchYearData, isValidLogin } from '../src/github.ts';

const NOW = new Date('2025-12-31T23:59:59Z');

const userPayload = {
  data: {
    user: {
      id: 'U_123',
      login: 'octocat',
      name: 'The Octocat',
      followers: { totalCount: 42 },
      contributionsCollection: {
        totalCommitContributions: 12,
        totalIssueContributions: 1,
        totalPullRequestContributions: 2,
        totalPullRequestReviewContributions: 3,
        contributionCalendar: {
          weeks: [
            {
              contributionDays: [
                { date: '2024-12-31', contributionCount: 9 }, // outside the requested year
                { date: '2025-01-02', contributionCount: 4 },
                { date: '2025-01-01', contributionCount: 2 },
              ],
            },
          ],
        },
        commitContributionsByRepository: [
          {
            repository: { nameWithOwner: 'octocat/small', isPrivate: false, stargazerCount: 1, primaryLanguage: null },
            contributions: { totalCount: 1, nodes: [{ commitCount: 2 }] },
          },
          {
            repository: {
              nameWithOwner: 'octocat/big',
              isPrivate: false,
              stargazerCount: 99,
              primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
            },
            // two active days with 6 and 4 commits: totalCount counts days, not commits
            contributions: { totalCount: 2, nodes: [{ commitCount: 6 }, { commitCount: 4 }] },
          },
        ],
      },
    },
  },
};

const historyPayload = {
  data: {
    r0: {
      defaultBranchRef: {
        target: { history: { totalCount: 150, nodes: [{ committedDate: '2025-03-01T10:00:00Z' }] } },
      },
    },
    r1: null,
  },
};

interface Call {
  body: { query: string; variables: Record<string, unknown> };
  headers: Record<string, string>;
}

function mockFetch(responses: (() => Response)[]): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      body: JSON.parse(String(init?.body)),
      headers: init?.headers as Record<string, string>,
    });
    const next = responses.shift();
    if (!next) throw new Error('unexpected extra request');
    return next();
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const json = (payload: unknown, status = 200) => () =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });

describe('isValidLogin', () => {
  it('accepts valid usernames', () => {
    for (const ok of ['a', 'octocat', 'foo-bar', 'A1-b2', 'x'.repeat(39)]) assert.ok(isValidLogin(ok), ok);
  });

  it('rejects invalid usernames', () => {
    for (const bad of ['', '-foo', 'foo-', 'foo--bar', 'foo_bar', 'x'.repeat(40), 'a b', 'a/b', '<script>']) {
      assert.ok(!isValidLogin(bad), bad);
    }
  });
});

describe('fetchYearData', () => {
  it('normalizes the API response', async () => {
    const { fetchImpl, calls } = mockFetch([json(userPayload), json(historyPayload)]);
    const data = await fetchYearData('octocat', { token: 'tkn', year: 2025, fetchImpl, now: NOW });

    assert.equal(data.login, 'octocat');
    assert.equal(data.followers, 42);
    assert.equal(data.totalCommits, 12);
    assert.equal(data.totalReviews, 3);
    // days outside the year are dropped and the rest is sorted
    assert.deepEqual(data.days, [
      { date: '2025-01-01', count: 2 },
      { date: '2025-01-02', count: 4 },
    ]);
    // repos are sorted by commits and keep language data
    assert.equal(data.repos[0]?.nameWithOwner, 'octocat/big');
    assert.equal(data.repos[0]?.language, 'TypeScript');
    assert.equal(data.repos[1]?.language, null);
    // the busiest repository gets its exact commit count from the history query (150),
    // the other one keeps the sum of its daily counts (2)
    assert.equal(data.repos[0]?.commits, 150);
    assert.equal(data.repos[1]?.commits, 2);
    assert.deepEqual(data.commitTimestamps, ['2025-03-01T10:00:00Z']);

    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.headers.Authorization, 'Bearer tkn');
    assert.equal(calls[0]?.body.variables.login, 'octocat');
    // history query targets the top repositories, passing names as variables
    assert.equal(calls[1]?.body.variables.id, 'U_123');
    assert.equal(calls[1]?.body.variables.o0, 'octocat');
    assert.equal(calls[1]?.body.variables.n0, 'big');
  });

  it('caps the period at "now" for the current year', async () => {
    const { fetchImpl, calls } = mockFetch([json(userPayload), json(historyPayload)]);
    const now = new Date('2025-06-15T10:00:00Z');
    await fetchYearData('octocat', { token: 't', year: 2025, fetchImpl, now });
    assert.equal(calls[0]?.body.variables.from, '2025-01-01T00:00:00Z');
    assert.equal(calls[0]?.body.variables.to, '2025-06-15T10:00:00.000Z');
  });

  it('drops days that have not happened yet in the current year', async () => {
    const payload = structuredClone(userPayload);
    payload.data.user.contributionsCollection.contributionCalendar.weeks = [
      {
        contributionDays: [
          { date: '2025-06-14', contributionCount: 3 },
          { date: '2025-06-15', contributionCount: 1 },
          { date: '2025-06-16', contributionCount: 0 }, // tomorrow
          { date: '2025-06-17', contributionCount: 0 },
        ],
      },
    ];
    const { fetchImpl } = mockFetch([json(payload), json(historyPayload)]);
    const now = new Date('2025-06-15T10:00:00Z');
    const data = await fetchYearData('octocat', { token: 't', year: 2025, fetchImpl, now });
    assert.deepEqual(
      data.days.map((d) => d.date),
      ['2025-06-14', '2025-06-15'],
    );
  });

  it('still succeeds when the hourly sample cannot be fetched', async () => {
    const { fetchImpl } = mockFetch([json(userPayload), json({ errors: [{ message: 'boom' }] }, 502)]);
    const data = await fetchYearData('octocat', { token: 't', year: 2025, fetchImpl, now: NOW });
    assert.deepEqual(data.commitTimestamps, []);
    assert.equal(data.days.length, 2);
    // without the history query the daily counts are used (6 + 4), not the number of days
    assert.equal(data.repos[0]?.commits, 10);
  });

  it('maps a missing user to NOT_FOUND', async () => {
    const { fetchImpl } = mockFetch([
      json({ data: { user: null }, errors: [{ type: 'NOT_FOUND', message: 'Could not resolve to a User' }] }),
    ]);
    await assert.rejects(
      fetchYearData('ghost', { token: 't', year: 2025, fetchImpl, now: NOW }),
      (e: unknown) => e instanceof GitWrappedError && e.code === 'NOT_FOUND',
    );
  });

  it('maps HTTP 401 to BAD_TOKEN and 403 to RATE_LIMITED', async () => {
    const bad = mockFetch([json({}, 401)]);
    await assert.rejects(
      fetchYearData('octocat', { token: 't', year: 2025, fetchImpl: bad.fetchImpl, now: NOW }),
      (e: unknown) => e instanceof GitWrappedError && e.code === 'BAD_TOKEN',
    );
    const limited = mockFetch([json({}, 403)]);
    await assert.rejects(
      fetchYearData('octocat', { token: 't', year: 2025, fetchImpl: limited.fetchImpl, now: NOW }),
      (e: unknown) => e instanceof GitWrappedError && e.code === 'RATE_LIMITED',
    );
  });

  it('reports network failures as API_ERROR', async () => {
    const fetchImpl = (async () => {
      throw new Error('socket hang up');
    }) as typeof fetch;
    await assert.rejects(
      fetchYearData('octocat', { token: 't', year: 2025, fetchImpl, now: NOW }),
      (e: unknown) => e instanceof GitWrappedError && e.code === 'API_ERROR' && e.message.includes('socket hang up'),
    );
  });

  it('validates input before calling the network', async () => {
    const { fetchImpl, calls } = mockFetch([]);
    const run = (login: string, year: number, token = 't') =>
      fetchYearData(login, { token, year, fetchImpl, now: NOW });

    await assert.rejects(run('bad name', 2025), (e: unknown) => (e as GitWrappedError).code === 'INVALID_INPUT');
    await assert.rejects(run('octocat', 1999), (e: unknown) => (e as GitWrappedError).code === 'INVALID_INPUT');
    await assert.rejects(run('octocat', 2030), (e: unknown) => (e as GitWrappedError).code === 'INVALID_INPUT');
    await assert.rejects(run('octocat', 2025, ''), (e: unknown) => (e as GitWrappedError).code === 'NO_TOKEN');
    assert.equal(calls.length, 0);
  });
});

describe('buildHistoryQuery', () => {
  it('declares one variable pair and one alias per repository', () => {
    const query = buildHistoryQuery(3);
    assert.match(query, /\$o0: String!, \$n0: String!/);
    assert.match(query, /\$o2: String!, \$n2: String!/);
    assert.match(query, /r2: repository\(owner: \$o2, name: \$n2\)/);
    assert.ok(!query.includes('r3:'));
  });
});
