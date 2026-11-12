import { GitWrappedError } from './errors.ts';
import type { DayContribution, RawYearData, RepoContribution } from './types.ts';

const ENDPOINT = 'https://api.github.com/graphql';
const HISTORY_REPOS = 10;
const HISTORY_PAGE = 100;

/** GitHub usernames: alphanumerics and single hyphens, 1-39 chars, no leading/trailing hyphen. */
const LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isValidLogin(login: string): boolean {
  return LOGIN_RE.test(login);
}

export interface FetchOptions {
  token: string;
  year: number;
  /** Injectable for tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests. Defaults to the current time. */
  now?: Date;
}

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { type?: string; message: string }[];
}

interface UserResponse {
  user: {
    id: string;
    login: string;
    name: string | null;
    followers: { totalCount: number };
    contributionsCollection: {
      totalCommitContributions: number;
      totalIssueContributions: number;
      totalPullRequestContributions: number;
      totalPullRequestReviewContributions: number;
      contributionCalendar: {
        weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
      };
      commitContributionsByRepository: {
        repository: {
          nameWithOwner: string;
          isPrivate: boolean;
          stargazerCount: number;
          primaryLanguage: { name: string; color: string | null } | null;
        };
        contributions: { totalCount: number };
      }[];
    };
  } | null;
}

type HistoryResponse = Record<
  string,
  {
    defaultBranchRef: {
      target: { history?: { nodes: { committedDate: string }[] } } | null;
    } | null;
  } | null
>;

const USER_QUERY = /* GraphQL */ `
  query WrappedUser($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      id
      login
      name
      followers {
        totalCount
      }
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            nameWithOwner
            isPrivate
            stargazerCount
            primaryLanguage {
              name
              color
            }
          }
          contributions {
            totalCount
          }
        }
      }
    }
  }
`;

/** Builds one query that reads the commit history of several repositories via aliases. */
export function buildHistoryQuery(repoCount: number): string {
  const vars = Array.from({ length: repoCount }, (_, i) => `$o${i}: String!, $n${i}: String!`).join(', ');
  const fields = Array.from(
    { length: repoCount },
    (_, i) =>
      `r${i}: repository(owner: $o${i}, name: $n${i}) { defaultBranchRef { target { ... on Commit { history(author: { id: $id }, since: $since, until: $until, first: ${HISTORY_PAGE}) { nodes { committedDate } } } } } }`,
  ).join('\n');
  return `query WrappedHistory($id: ID!, $since: GitTimestamp!, $until: GitTimestamp!, ${vars}) {\n${fields}\n}`;
}

async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  fetchImpl: typeof fetch,
): Promise<GraphQLResponse<T>> {
  let res: Response;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'gitwrapped',
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new GitWrappedError('API_ERROR', `Could not reach the GitHub API: ${reason}`);
  }

  if (res.status === 401) {
    throw new GitWrappedError('BAD_TOKEN', 'GitHub rejected the token. Check that GITHUB_TOKEN is valid.');
  }
  if (res.status === 403 || res.status === 429) {
    throw new GitWrappedError('RATE_LIMITED', 'GitHub API rate limit reached. Try again in a few minutes.');
  }
  if (!res.ok) {
    throw new GitWrappedError('API_ERROR', `GitHub API responded with HTTP ${res.status}.`);
  }

  try {
    return (await res.json()) as GraphQLResponse<T>;
  } catch {
    throw new GitWrappedError('API_ERROR', 'GitHub API returned an unreadable response.');
  }
}

function throwForErrors(errors: NonNullable<GraphQLResponse<unknown>['errors']>): never {
  if (errors.some((e) => e.type === 'NOT_FOUND')) {
    throw new GitWrappedError('NOT_FOUND', 'GitHub user not found.');
  }
  if (errors.some((e) => e.type === 'RATE_LIMITED')) {
    throw new GitWrappedError('RATE_LIMITED', 'GitHub API rate limit reached. Try again in a few minutes.');
  }
  throw new GitWrappedError('API_ERROR', `GitHub API error: ${errors.map((e) => e.message).join('; ')}`);
}

function periodFor(year: number, now: Date): { from: string; to: string } {
  const from = `${year}-01-01T00:00:00Z`;
  const endOfYear = Date.UTC(year, 11, 31, 23, 59, 59);
  const to = new Date(Math.min(endOfYear, now.getTime())).toISOString();
  return { from, to };
}

/** Fetches and normalizes everything needed to compute the wrapped stats for one year. */
export async function fetchYearData(login: string, options: FetchOptions): Promise<RawYearData> {
  const { token, year } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();

  if (!token) {
    throw new GitWrappedError('NO_TOKEN', 'A GitHub token is required (set GITHUB_TOKEN).');
  }
  if (!isValidLogin(login)) {
    throw new GitWrappedError('INVALID_INPUT', `"${login}" is not a valid GitHub username.`);
  }
  if (!Number.isInteger(year) || year < 2008 || year > now.getUTCFullYear()) {
    throw new GitWrappedError('INVALID_INPUT', `Year must be between 2008 and ${now.getUTCFullYear()}.`);
  }

  const { from, to } = periodFor(year, now);
  const response = await graphql<UserResponse>(USER_QUERY, { login, from, to }, token, fetchImpl);
  if (response.errors?.length) throwForErrors(response.errors);
  const user = response.data?.user;
  if (!user) throw new GitWrappedError('NOT_FOUND', 'GitHub user not found.');

  const collection = user.contributionsCollection;

  const byDate = new Map<string, number>();
  for (const week of collection.contributionCalendar.weeks) {
    for (const day of week.contributionDays) {
      if (day.date.startsWith(`${year}-`)) byDate.set(day.date, day.contributionCount);
    }
  }
  const days: DayContribution[] = [...byDate.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const repos: RepoContribution[] = collection.commitContributionsByRepository
    .map((entry) => ({
      nameWithOwner: entry.repository.nameWithOwner,
      isPrivate: entry.repository.isPrivate,
      commits: entry.contributions.totalCount,
      stars: entry.repository.stargazerCount,
      language: entry.repository.primaryLanguage?.name ?? null,
      languageColor: entry.repository.primaryLanguage?.color ?? null,
    }))
    .sort((a, b) => b.commits - a.commits);

  const commitTimestamps = await fetchCommitTimestamps(user.id, repos, { from, to }, token, fetchImpl);

  return {
    login: user.login,
    name: user.name,
    year,
    followers: user.followers.totalCount,
    days,
    totalCommits: collection.totalCommitContributions,
    totalPullRequests: collection.totalPullRequestContributions,
    totalIssues: collection.totalIssueContributions,
    totalReviews: collection.totalPullRequestReviewContributions,
    repos,
    commitTimestamps,
  };
}

/**
 * Contribution calendars only have day-level resolution, so for the hourly chart we sample real
 * commit timestamps from the most active repositories. This is best effort: any failure here
 * results in an empty sample instead of failing the whole request.
 */
async function fetchCommitTimestamps(
  userId: string,
  repos: RepoContribution[],
  period: { from: string; to: string },
  token: string,
  fetchImpl: typeof fetch,
): Promise<string[]> {
  const top = repos.filter((r) => r.commits > 0).slice(0, HISTORY_REPOS);
  if (top.length === 0) return [];

  const variables: Record<string, unknown> = { id: userId, since: period.from, until: period.to };
  top.forEach((repo, i) => {
    const [owner = '', name = ''] = repo.nameWithOwner.split('/');
    variables[`o${i}`] = owner;
    variables[`n${i}`] = name;
  });

  try {
    const response = await graphql<HistoryResponse>(buildHistoryQuery(top.length), variables, token, fetchImpl);
    const data = response.data;
    if (!data) return [];
    const timestamps: string[] = [];
    for (let i = 0; i < top.length; i++) {
      const nodes = data[`r${i}`]?.defaultBranchRef?.target?.history?.nodes ?? [];
      for (const node of nodes) timestamps.push(node.committedDate);
    }
    return timestamps;
  } catch (error) {
    if (error instanceof GitWrappedError) return [];
    throw error;
  }
}
