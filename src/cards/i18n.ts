import { ARCHETYPES } from '../personality.ts';
import type { Chronotype, PersonalityId } from '../types.ts';

/**
 * Languages the cards can be rendered in. To add one, add its code here and a `Messages` object
 * to `MESSAGES` below; the type checker lists everything that needs translating.
 */
export const LOCALES = ['en', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Accepts the usual spellings (`pt`, `pt-br`, `PT_BR`, `en-US`) and returns a supported locale, if any. */
export function parseLocale(value: string): Locale | undefined {
  const normalized = value.trim().toLowerCase().replace('_', '-');
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  if (normalized === 'pt' || normalized === 'pt-br') return 'pt-BR';
  return undefined;
}

export interface ArchetypeText {
  title: string;
  tagline: string;
  /** Short label shown in the pill under the title. */
  trait: string;
}

export interface Messages {
  /** BCP 47 tag used to format numbers. */
  numberLocale: string;
  /** Abbreviated months, January first. */
  months: readonly string[];
  /** Full month names as they appear inside a sentence, January first. */
  monthsFull: readonly string[];
  /** Full weekday names as they appear inside a sentence, Sunday first. */
  weekdays: readonly string[];
  /** Abbreviated weekdays, Sunday first. */
  weekdaysShort: readonly string[];

  hour: (hour: number) => string;
  day: (formattedCount: string, count: number) => string;
  /** `month` is 0-11. */
  shortDate: (month: number, day: number) => string;
  dateRange: (from: string, to: string) => string;
  commitCount: (formattedCount: string, count: number) => string;

  // summary
  summarySubtitle: (login: string, year: number) => string;
  contributions: string;
  commits: string;
  pullRequests: string;
  codeReviews: string;
  activeIn: (year: number) => string;
  topLanguage: string;
  noneYet: string;
  devPersonality: string;

  // languages
  languagesEyebrow: (year: number) => string;
  languagesLed: (language: string, year: number) => string;
  languagesSub: string;
  noLanguages: string;
  noLanguagesSub: string;

  // repositories
  reposEyebrow: (year: number) => string;
  reposTitle: string;
  reposSub: string;
  noRepos: string;
  privateLabel: string;
  privateRepo: string;

  // rhythm
  rhythmEyebrow: (year: number) => string;
  codeMostAround: (hourLabel: string) => string;
  dayIsYours: (weekday: string) => string;
  quietYear: string;
  rhythmWeekSub: string;
  chronotype: Record<Chronotype, string>;
  byHour: string;
  sampleOf: (formattedCount: string) => string;
  notEnoughHours: [string, string];
  byWeekday: string;

  // heatmap
  heatmapEyebrow: (year: number) => string;
  contributionsIn: (formattedCount: string, year: number) => string;
  activeDaysBusiestMonth: (formattedDays: string, month: string) => string;
  activeDaysOnly: (formattedDays: string) => string;
  less: string;
  more: string;
  longestStreak: string;
  currentStreak: string;
  busiestDay: string;
  noStreak: string;
  nothingRecorded: string;
  contributionsCount: (formattedCount: string) => string;

  // personality
  personalityEyebrow: (year: number) => string;
  daysWithActivity: string;
  streakLabel: string;
  languagesUsed: (count: number) => string;
  archetypes: Record<PersonalityId, ArchetypeText>;

  // error card
  errorTitle: string;
}

const en: Messages = {
  numberLocale: 'en-US',
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  monthsFull: [
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
  ],
  weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

  hour: (hour) => `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? 'am' : 'pm'}`,
  day: (formatted, count) => `${formatted} ${count === 1 ? 'day' : 'days'}`,
  shortDate: (month, day) => `${en.months[month] ?? ''} ${day}`,
  dateRange: (from, to) => `${from} to ${to}`,
  commitCount: (formatted, count) => `${formatted} ${count === 1 ? 'commit' : 'commits'}`,

  summarySubtitle: (login, year) => `@${login} · ${year} in code`,
  contributions: 'contributions',
  commits: 'commits',
  pullRequests: 'pull requests',
  codeReviews: 'code reviews',
  activeIn: (year) => `active in ${year}`,
  topLanguage: 'top language',
  noneYet: 'None yet',
  devPersonality: 'Dev personality',

  languagesEyebrow: (year) => `Top languages · ${year}`,
  languagesLed: (language, year) => `${language} led your ${year}`,
  languagesSub: "Share of your commits, by each repository's main language",
  noLanguages: 'No language data yet',
  noLanguagesSub: 'Commit to repositories with a detected language to see this card.',

  reposEyebrow: (year) => `Top repositories · ${year}`,
  reposTitle: 'Where your year went',
  reposSub: 'Your most active repositories, ranked by commits',
  noRepos: 'No commits to repositories were recorded this year.',
  privateLabel: 'private',
  privateRepo: 'Private repository',

  rhythmEyebrow: (year) => `Coding rhythm · ${year}`,
  codeMostAround: (hourLabel) => `You code most around ${hourLabel}`,
  dayIsYours: (weekday) => `${weekday} is your day`,
  quietYear: 'A quiet year',
  rhythmWeekSub: 'Your rhythm across the week, from your contribution calendar.',
  chronotype: {
    night: 'A true night owl: most of your commits land between 10pm and 5am.',
    morning: 'An early riser: most of your commits land between 5am and noon.',
    afternoon: 'A daytime coder: most of your commits land between noon and 6pm.',
    evening: 'An evening coder: most of your commits land between 6pm and 10pm.',
  },
  byHour: 'Commits by hour of day',
  sampleOf: (formatted) => `sample of ${formatted} commits`,
  notEnoughHours: ['Not enough commit timestamps', 'to chart your hours of the day.'],
  byWeekday: 'Contributions by weekday',

  heatmapEyebrow: (year) => `Contribution calendar · ${year}`,
  contributionsIn: (formatted, year) => `${formatted} contributions in ${year}`,
  activeDaysBusiestMonth: (formatted, month) => `${formatted} active days · busiest month: ${month}`,
  activeDaysOnly: (formatted) => `${formatted} active days`,
  less: 'Less',
  more: 'More',
  longestStreak: 'Longest streak',
  currentStreak: 'Current streak',
  busiestDay: 'Busiest day',
  noStreak: 'No streak yet',
  nothingRecorded: 'Nothing recorded',
  contributionsCount: (formatted) => `${formatted} contributions`,

  personalityEyebrow: (year) => `Your dev personality · ${year}`,
  daysWithActivity: 'days with activity',
  streakLabel: 'day longest streak',
  languagesUsed: (count) => (count === 1 ? 'language used' : 'languages used'),
  archetypes: Object.fromEntries(
    Object.entries(ARCHETYPES).map(([id, a]) => [id, { title: a.title, tagline: a.tagline, trait: a.trait }]),
  ) as Record<PersonalityId, ArchetypeText>,

  errorTitle: 'Could not generate this card',
};

const ptBR: Messages = {
  numberLocale: 'pt-BR',
  months: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  monthsFull: [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ],
  weekdays: ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'],
  weekdaysShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],

  hour: (hour) => `${hour}h`,
  day: (formatted, count) => `${formatted} ${count === 1 ? 'dia' : 'dias'}`,
  shortDate: (month, day) => `${day} ${(ptBR.months[month] ?? '').toLowerCase()}`,
  dateRange: (from, to) => `${from} a ${to}`,
  commitCount: (formatted, count) => `${formatted} ${count === 1 ? 'commit' : 'commits'}`,

  summarySubtitle: (login, year) => `@${login} · ${year} em código`,
  contributions: 'contribuições',
  commits: 'commits',
  pullRequests: 'pull requests',
  codeReviews: 'revisões de código',
  activeIn: (year) => `ativos em ${year}`,
  topLanguage: 'linguagem principal',
  noneYet: 'Nenhuma ainda',
  devPersonality: 'Personalidade dev',

  languagesEyebrow: (year) => `Principais linguagens · ${year}`,
  languagesLed: (language, year) => `${language} liderou o seu ${year}`,
  languagesSub: 'Fatia dos seus commits, pela linguagem principal de cada repositório',
  noLanguages: 'Ainda sem dados de linguagem',
  noLanguagesSub: 'Faça commits em repositórios com linguagem detectada para ver este card.',

  reposEyebrow: (year) => `Repositórios em destaque · ${year}`,
  reposTitle: 'Para onde foi o seu ano',
  reposSub: 'Seus repositórios mais ativos, por número de commits',
  noRepos: 'Nenhum commit em repositórios foi registrado neste ano.',
  privateLabel: 'privado',
  privateRepo: 'Repositório privado',

  rhythmEyebrow: (year) => `Ritmo de código · ${year}`,
  codeMostAround: (hourLabel) => `Você programa mais por volta das ${hourLabel}`,
  dayIsYours: (weekday) => `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} é o seu dia`,
  quietYear: 'Um ano tranquilo',
  rhythmWeekSub: 'Seu ritmo ao longo da semana, a partir do calendário de contribuições.',
  chronotype: {
    night: 'Uma coruja de verdade: a maioria dos commits sai entre 22h e 5h.',
    morning: 'Madrugador: a maioria dos seus commits sai entre 5h e meio-dia.',
    afternoon: 'Dev diurno: a maioria dos seus commits sai entre meio-dia e 18h.',
    evening: 'Dev do fim do dia: a maioria dos commits sai entre 18h e 22h.',
  },
  byHour: 'Commits por hora do dia',
  sampleOf: (formatted) => `amostra de ${formatted} commits`,
  notEnoughHours: ['Poucos horários de commit para', 'montar o gráfico de horas do dia.'],
  byWeekday: 'Contribuições por dia',

  heatmapEyebrow: (year) => `Calendário de contribuições · ${year}`,
  contributionsIn: (formatted, year) => `${formatted} contribuições em ${year}`,
  activeDaysBusiestMonth: (formatted, month) => `${formatted} dias ativos · mês mais movimentado: ${month}`,
  activeDaysOnly: (formatted) => `${formatted} dias ativos`,
  less: 'Menos',
  more: 'Mais',
  longestStreak: 'Maior sequência',
  currentStreak: 'Sequência atual',
  busiestDay: 'Dia mais movimentado',
  noStreak: 'Sem sequência ainda',
  nothingRecorded: 'Nada registrado',
  contributionsCount: (formatted) => `${formatted} contribuições`,

  personalityEyebrow: (year) => `Sua personalidade dev · ${year}`,
  daysWithActivity: 'dias com atividade',
  streakLabel: 'dias na maior sequência',
  languagesUsed: (count) => (count === 1 ? 'linguagem usada' : 'linguagens usadas'),
  archetypes: {
    'night-owl': {
      title: 'A Coruja Noturna',
      tagline: 'Os melhores commits acontecem depois que o mundo dorme.',
      trait: 'Coruja noturna',
    },
    'early-bird': {
      title: 'O Madrugador',
      tagline: 'Café, nascer do sol e uma branch nova.',
      trait: 'Madrugador',
    },
    'weekend-warrior': {
      title: 'O Guerreiro de Fim de Semana',
      tagline: 'Na semana, as contas. No fim de semana, os sonhos.',
      trait: 'Guerreiro de fim de semana',
    },
    marathoner: {
      title: 'O Maratonista',
      tagline: 'Constância é um superpoder, e o seu dura semanas.',
      trait: 'Máquina de sequência',
    },
    sprinter: {
      title: 'O Velocista',
      tagline: 'Longos silêncios, depois explosões de código.',
      trait: 'Código em rajadas',
    },
    collaborator: {
      title: 'O Colaborador',
      tagline: 'Código é esporte coletivo, e você está sempre na roda.',
      trait: 'Jogador de equipe',
    },
    polyglot: {
      title: 'O Poliglota',
      tagline: 'Por que escolher uma linguagem se dá para falar todas?',
      trait: 'Poliglota',
    },
    specialist: {
      title: 'O Especialista',
      tagline: 'Uma linguagem, dominada a fundo.',
      trait: 'Especialista',
    },
    'steady-builder': {
      title: 'O Construtor Constante',
      tagline: 'Tijolo por tijolo, dia após dia.',
      trait: 'Construtor constante',
    },
    explorer: {
      title: 'O Explorador',
      tagline: 'Ainda mapeando o território, e cada commit é uma nova trilha.',
      trait: 'Explorador',
    },
  },

  errorTitle: 'Não foi possível gerar este card',
};

export const MESSAGES: Record<Locale, Messages> = { en, 'pt-BR': ptBR };

/** Everything a card needs to turn numbers, dates and ids into text for one language. */
export interface Labels {
  locale: Locale;
  m: Messages;
  fmt: (n: number) => string;
  days: (n: number) => string;
  commitCount: (n: number) => string;
  /** `2025-03-04` -> `Mar 4` or `4 mar`. */
  shortDate: (date: string) => string;
  hour: (hour: number) => string;
  archetype: (id: PersonalityId) => ArchetypeText;
  /** Translates the English trait label stored in `WrappedStats.personality.traits`. */
  trait: (englishLabel: string) => string;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function labelsFor(locale: Locale = 'en'): Labels {
  const m = MESSAGES[locale];
  let numberFormat = formatters.get(m.numberLocale);
  if (!numberFormat) {
    numberFormat = new Intl.NumberFormat(m.numberLocale);
    formatters.set(m.numberLocale, numberFormat);
  }
  const format = numberFormat;
  const fmt = (n: number) => format.format(n);

  const traitById = new Map<string, PersonalityId>(
    (Object.entries(ARCHETYPES) as [PersonalityId, (typeof ARCHETYPES)[PersonalityId]][]).map(([id, a]) => [a.trait, id]),
  );

  return {
    locale,
    m,
    fmt,
    days: (n) => m.day(fmt(n), n),
    commitCount: (n) => m.commitCount(fmt(n), n),
    shortDate: (date) => m.shortDate(Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))),
    hour: m.hour,
    archetype: (id) => m.archetypes[id],
    trait: (label) => {
      const id = traitById.get(label);
      return id ? m.archetypes[id].trait : label;
    },
  };
}
