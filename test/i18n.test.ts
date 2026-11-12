import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CARD_NAMES, THEME_NAMES, renderCard, renderErrorCard } from '../src/cards/index.ts';
import { LOCALES, MESSAGES, labelsFor, parseLocale } from '../src/cards/i18n.ts';
import { demoData } from '../src/demo.ts';
import { ARCHETYPES } from '../src/personality.ts';
import { computeStats } from '../src/stats.ts';
import type { PersonalityId } from '../src/types.ts';
import { AFTER_2025, assertWellFormed, makeRaw } from './helpers.ts';

const demoStats = computeStats(demoData(2025), { now: AFTER_2025 });
const emptyStats = computeStats(makeRaw(), { now: AFTER_2025 });
const archetypeIds = Object.keys(ARCHETYPES) as PersonalityId[];

describe('parseLocale', () => {
  it('accepts the usual spellings', () => {
    for (const value of ['en', 'EN', 'en-US', 'en_GB']) assert.equal(parseLocale(value), 'en', value);
    for (const value of ['pt', 'PT', 'pt-BR', 'pt-br', 'pt_BR', ' pt-BR ']) assert.equal(parseLocale(value), 'pt-BR', value);
  });

  it('returns undefined for unsupported languages', () => {
    for (const value of ['', 'fr', 'english', 'pt-PT', 'p']) assert.equal(parseLocale(value), undefined, value);
  });
});

describe('messages', () => {
  const en = MESSAGES.en;

  for (const locale of LOCALES) {
    describe(locale, () => {
      const m = MESSAGES[locale];

      it('has exactly the same keys as English', () => {
        assert.deepEqual(Object.keys(m).sort(), Object.keys(en).sort());
      });

      it('has 12 months and 7 weekdays', () => {
        assert.equal(m.months.length, 12);
        assert.equal(m.monthsFull.length, 12);
        assert.equal(m.weekdays.length, 7);
        assert.equal(m.weekdaysShort.length, 7);
      });

      it('translates every dev personality', () => {
        assert.deepEqual(Object.keys(m.archetypes).sort(), [...archetypeIds].sort());
        for (const id of archetypeIds) {
          const a = m.archetypes[id];
          assert.ok(a.title && a.tagline && a.trait, id);
        }
      });

      it('translates every chronotype', () => {
        for (const key of ['night', 'morning', 'afternoon', 'evening'] as const) assert.ok(m.chronotype[key], key);
      });

      it('never produces empty or broken text from its functions', () => {
        const samples: string[] = [
          m.hour(0),
          m.hour(13),
          m.day('1', 1),
          m.day('5', 5),
          m.shortDate(0, 1),
          m.shortDate(11, 31),
          m.dateRange('a', 'b'),
          m.commitCount('1', 1),
          m.commitCount('2', 2),
          m.summarySubtitle('octocat', 2025),
          m.activeIn(2025),
          m.languagesEyebrow(2025),
          m.languagesLed('Go', 2025),
          m.reposEyebrow(2025),
          m.rhythmEyebrow(2025),
          m.codeMostAround('10pm'),
          m.dayIsYours('monday'),
          m.sampleOf('42'),
          m.heatmapEyebrow(2025),
          m.contributionsIn('1', 2025),
          m.activeDaysBusiestMonth('2', 'May'),
          m.activeDaysOnly('2'),
          m.contributionsCount('3'),
          m.personalityEyebrow(2025),
          m.languagesUsed(1),
          m.languagesUsed(2),
        ];
        for (const sample of samples) {
          assert.ok(sample.trim().length > 0);
          assert.ok(!/undefined|NaN/.test(sample), sample);
        }
      });
    });
  }

  it('differs from English where it should', () => {
    assert.notEqual(MESSAGES['pt-BR'].contributions, en.contributions);
    assert.notEqual(MESSAGES['pt-BR'].archetypes['night-owl'].title, en.archetypes['night-owl'].title);
  });
});

describe('labels', () => {
  const en = labelsFor('en');
  const pt = labelsFor('pt-BR');

  it('formats numbers for each locale', () => {
    assert.equal(en.fmt(1121), '1,121');
    assert.equal(pt.fmt(1121), '1.121');
  });

  it('formats dates and hours for each locale', () => {
    assert.equal(en.shortDate('2025-03-04'), 'Mar 4');
    assert.equal(pt.shortDate('2025-03-04'), '4 mar');
    assert.equal(en.hour(0), '12am');
    assert.equal(en.hour(15), '3pm');
    assert.equal(pt.hour(22), '22h');
  });

  it('handles singular and plural', () => {
    assert.equal(en.days(1), '1 day');
    assert.equal(en.days(35), '35 days');
    assert.equal(pt.days(1), '1 dia');
    assert.equal(pt.days(35), '35 dias');
    assert.equal(pt.commitCount(1), '1 commit');
    assert.equal(pt.commitCount(1200), '1.200 commits');
  });

  it('translates the trait labels stored in the stats', () => {
    for (const id of archetypeIds) {
      assert.equal(pt.trait(ARCHETYPES[id].trait), MESSAGES['pt-BR'].archetypes[id].trait, id);
      assert.equal(en.trait(ARCHETYPES[id].trait), ARCHETYPES[id].trait, id);
    }
    assert.equal(pt.trait('Something else'), 'Something else');
  });

  it('keeps English archetypes identical to the personality rules', () => {
    for (const id of archetypeIds) {
      assert.equal(en.archetype(id).title, ARCHETYPES[id].title);
      assert.equal(en.archetype(id).tagline, ARCHETYPES[id].tagline);
    }
  });
});

describe('translated cards', () => {
  for (const locale of LOCALES) {
    for (const theme of THEME_NAMES) {
      for (const name of CARD_NAMES) {
        it(`renders ${name} in ${locale} (${theme}), also for an empty year`, () => {
          for (const stats of [demoStats, emptyStats]) {
            const svg = renderCard(name, stats, theme, locale);
            assertWellFormed(svg);
            assert.ok(!/NaN|undefined|Infinity/.test(svg), 'contains an invalid number or missing value');
          }
        });
      }
    }
  }

  it('renders English by default', () => {
    for (const name of CARD_NAMES) assert.equal(renderCard(name, demoStats), renderCard(name, demoStats, 'dark', 'en'));
  });

  it('writes the text in Portuguese', () => {
    assert.ok(renderCard('summary', demoStats, 'dark', 'pt-BR').includes('contribuições'));
    assert.ok(renderCard('summary', demoStats, 'dark', 'pt-BR').includes('A Coruja Noturna'));
    assert.ok(renderCard('languages', demoStats, 'dark', 'pt-BR').includes('liderou o seu 2025'));
    assert.ok(renderCard('rhythm', demoStats, 'dark', 'pt-BR').includes('Você programa mais por volta das 22h'));
    assert.ok(renderCard('heatmap', demoStats, 'dark', 'pt-BR').includes('mês mais movimentado: janeiro'));
    // the small label above every title is drawn in capitals
    assert.ok(renderCard('personality', demoStats, 'dark', 'pt-BR').includes('SUA PERSONALIDADE DEV'));
  });

  it('uses the local number format', () => {
    assert.ok(renderCard('summary', demoStats, 'dark', 'pt-BR').includes('1.121'));
    assert.ok(renderCard('summary', demoStats, 'dark', 'en').includes('1,121'));
  });

  it('translates the placeholder for private repositories without leaking the real name', () => {
    const svg = renderCard('repos', demoStats, 'dark', 'pt-BR');
    assert.ok(svg.includes('Repositório privado'));
    assert.ok(svg.includes('privado'));
    assert.ok(!svg.includes('internal-tools'));
  });

  it('shrinks long titles so they stay inside the card', () => {
    const stats = { ...demoStats, personality: { ...demoStats.personality, id: 'weekend-warrior' as const } };
    const sizeOf = (svg: string) => Number(/font-size="(\d+)"[^>]*>O Guerreiro/.exec(svg)?.[1]);
    assert.ok(sizeOf(renderCard('personality', stats, 'dark', 'pt-BR')) < 84);
    // short titles keep the full size
    const owl = renderCard('personality', demoStats, 'dark', 'en');
    assert.match(owl, /font-size="84"[^>]*>The Night Owl/);
  });

  it('localizes the error card', () => {
    assert.ok(renderErrorCard('x', 'dark', 'pt-BR').includes('Não foi possível gerar este card'));
    assert.ok(renderErrorCard('x', 'dark', 'en').includes('Could not generate this card'));
  });
});
