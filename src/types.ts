/** One calendar day of contributions. `date` is `YYYY-MM-DD`. */
export interface DayContribution {
  date: string;
  count: number;
}

export interface RepoContribution {
  nameWithOwner: string;
  isPrivate: boolean;
  commits: number;
  stars: number;
  language: string | null;
  languageColor: string | null;
}

/** Normalized data fetched from GitHub for one user and one calendar year. */
export interface RawYearData {
  login: string;
  name: string | null;
  year: number;
  followers: number;
  /** Every day of the period in ascending order. */
  days: DayContribution[];
  totalCommits: number;
  totalPullRequests: number;
  totalIssues: number;
  totalReviews: number;
  repos: RepoContribution[];
  /** ISO timestamps of a sample of the user's commits (used for the hourly chart). */
  commitTimestamps: string[];
}

export interface LanguageShare {
  name: string;
  color: string;
  commits: number;
  /** Percentage of language-attributed commits, one decimal place. */
  percent: number;
}

export interface Streak {
  length: number;
  start: string | null;
  end: string | null;
}

export type Chronotype = 'night' | 'morning' | 'afternoon' | 'evening';

export type PersonalityId =
  | 'night-owl'
  | 'early-bird'
  | 'weekend-warrior'
  | 'marathoner'
  | 'sprinter'
  | 'collaborator'
  | 'polyglot'
  | 'specialist'
  | 'steady-builder'
  | 'explorer';

export interface Personality {
  id: PersonalityId;
  title: string;
  emoji: string;
  tagline: string;
  /** Short labels: the primary trait first, then up to two secondary traits. */
  traits: string[];
}

export interface TopRepo {
  /** `owner/name`, or "Private repository" when the repo is private. */
  name: string;
  commits: number;
  stars: number;
  isPrivate: boolean;
}

export interface WrappedStats {
  login: string;
  name: string | null;
  year: number;
  followers: number;
  totals: {
    contributions: number;
    commits: number;
    pullRequests: number;
    issues: number;
    reviews: number;
  };
  activeDays: number;
  daysInPeriod: number;
  longestStreak: Streak;
  currentStreak: Streak;
  busiestDay: { date: string; count: number } | null;
  /** Month index 0-11. */
  busiestMonth: { month: number; count: number } | null;
  /** Contributions per weekday, Sunday first. */
  weekdayCounts: number[];
  /** Contributions per month, January first. */
  monthCounts: number[];
  /** Sampled commits per hour of day (0-23) in the requested UTC offset. */
  hourCounts: number[];
  hourSampleSize: number;
  peakHour: number | null;
  chronotype: Chronotype | null;
  languages: LanguageShare[];
  topRepos: TopRepo[];
  personality: Personality;
  /** The full day-by-day calendar, used to draw the heatmap. */
  calendar: DayContribution[];
}
