import type { Personality, PersonalityId } from './types.ts';

export interface HourShares {
  night: number;
  morning: number;
  afternoon: number;
  evening: number;
}

export interface PersonalityInput {
  commits: number;
  pullRequests: number;
  issues: number;
  reviews: number;
  activeDays: number;
  daysInPeriod: number;
  longestStreak: number;
  /** Share (0-1) of contributions made on Saturday or Sunday. */
  weekendShare: number;
  /** Null when there are not enough commit timestamps to say anything about the hours. */
  hourShares: HourShares | null;
  languageCount: number;
  /** Share (0-1) of the most used language. */
  topLanguageShare: number;
  /** Share (0-1) of all contributions made on the busiest 10% of active days. */
  burstShare: number;
}

interface Archetype {
  title: string;
  emoji: string;
  tagline: string;
  trait: string;
}

export const ARCHETYPES: Record<PersonalityId, Archetype> = {
  'night-owl': {
    title: 'The Night Owl',
    emoji: '🦉',
    tagline: 'The best commits happen after the world goes to sleep.',
    trait: 'Night owl',
  },
  'early-bird': {
    title: 'The Early Bird',
    emoji: '🌅',
    tagline: 'Coffee, sunrise and a fresh branch.',
    trait: 'Early bird',
  },
  'weekend-warrior': {
    title: 'The Weekend Warrior',
    emoji: '⚔️',
    tagline: 'Weekdays pay the bills. Weekends ship the dreams.',
    trait: 'Weekend warrior',
  },
  marathoner: {
    title: 'The Marathoner',
    emoji: '🏃',
    tagline: 'Consistency is a superpower, and yours runs for weeks.',
    trait: 'Streak machine',
  },
  sprinter: {
    title: 'The Sprinter',
    emoji: '⚡',
    tagline: 'Long silences, then explosive bursts of code.',
    trait: 'Burst coder',
  },
  collaborator: {
    title: 'The Collaborator',
    emoji: '🤝',
    tagline: 'Code is a team sport, and you are always in the huddle.',
    trait: 'Team player',
  },
  polyglot: {
    title: 'The Polyglot',
    emoji: '🌍',
    tagline: 'Why pick one language when you can speak them all?',
    trait: 'Polyglot',
  },
  specialist: {
    title: 'The Specialist',
    emoji: '🎯',
    tagline: 'One language, mastered in depth.',
    trait: 'Specialist',
  },
  'steady-builder': {
    title: 'The Steady Builder',
    emoji: '🧱',
    tagline: 'Brick by brick, day after day.',
    trait: 'Steady builder',
  },
  explorer: {
    title: 'The Explorer',
    emoji: '🧭',
    tagline: 'Still mapping the territory, and every commit is a new trail.',
    trait: 'Explorer',
  },
};

/**
 * Returns a score per archetype; 0 means "does not apply". Order is the tie-break.
 * A clear time-of-day identity is the most distinctive signal, so it is weighted above generic
 * ones such as "active most days" or "uses many languages".
 */
function score(input: PersonalityInput): [PersonalityId, number][] {
  const social = input.pullRequests + input.issues + input.reviews;
  const work = input.commits + social;
  const socialShare = work > 0 ? social / work : 0;
  const activeRatio = input.daysInPeriod > 0 ? input.activeDays / input.daysInPeriod : 0;
  const hours = input.hourShares;

  return [
    ['night-owl', hours && hours.night >= 0.35 ? hours.night * 2 : 0],
    ['early-bird', hours && hours.morning >= 0.5 ? hours.morning * 2 : 0],
    ['weekend-warrior', input.weekendShare >= 0.35 ? input.weekendShare * 1.5 : 0],
    ['marathoner', input.longestStreak >= 21 ? Math.min(1, input.longestStreak / 60) * 1.3 : 0],
    ['sprinter', input.activeDays >= 10 && input.burstShare >= 0.6 ? input.burstShare : 0],
    ['collaborator', socialShare >= 0.4 ? socialShare * 1.2 : 0],
    ['polyglot', input.languageCount >= 6 ? Math.min(1, input.languageCount / 10) * 1.1 : 0],
    ['specialist', input.languageCount >= 1 && input.topLanguageShare >= 0.75 ? input.topLanguageShare : 0],
    ['steady-builder', activeRatio >= 0.5 ? activeRatio * 1.2 : 0],
  ];
}

export function pickPersonality(input: PersonalityInput): Personality {
  const ranked = score(input)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  const primary: PersonalityId = ranked[0]?.[0] ?? 'explorer';
  const secondary = ranked.slice(1, 3).map(([id]) => ARCHETYPES[id].trait);
  const archetype = ARCHETYPES[primary];

  return {
    id: primary,
    title: archetype.title,
    emoji: archetype.emoji,
    tagline: archetype.tagline,
    traits: [archetype.trait, ...secondary],
  };
}
