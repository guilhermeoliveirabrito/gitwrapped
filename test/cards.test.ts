import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CARD_NAMES, THEME_NAMES, renderCard, renderErrorCard } from '../src/cards/index.ts';
import { demoData } from '../src/demo.ts';
import { computeStats } from '../src/stats.ts';
import { AFTER_2025, makeRaw } from './helpers.ts';

/** Minimal well-formedness check: every opened element is closed in the right order. */
function assertWellFormed(svg: string): void {
  const stack: string[] = [];
  const tag = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/g;
  for (const match of svg.matchAll(tag)) {
    const [, closing, name = '', , selfClosing] = match;
    if (selfClosing) continue;
    if (closing) {
      assert.equal(stack.pop(), name, `unexpected </${name}>`);
    } else {
      stack.push(name);
    }
  }
  assert.deepEqual(stack, [], 'unclosed elements');
}

const demoStats = computeStats(demoData(2025), { now: AFTER_2025 });
const emptyStats = computeStats(makeRaw(), { now: AFTER_2025 });

describe('cards', () => {
  for (const theme of THEME_NAMES) {
    for (const name of CARD_NAMES) {
      it(`renders a valid ${name} card in the ${theme} theme`, () => {
        const svg = renderCard(name, demoStats, theme);
        assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
        assert.ok(svg.trimEnd().endsWith('</svg>'));
        assert.match(svg, /width="1200" height="630"/);
        assert.match(svg, /<title id=/);
        assertWellFormed(svg);
        assert.ok(!/NaN|undefined|Infinity/.test(svg), 'contains an invalid number or missing value');
      });

      it(`renders the ${name} card for a year with no activity (${theme})`, () => {
        const svg = renderCard(name, emptyStats, theme);
        assertWellFormed(svg);
        assert.ok(!/NaN|undefined|Infinity/.test(svg), 'contains an invalid number or missing value');
      });
    }
  }

  it('uses different colors for the light and dark themes', () => {
    assert.notEqual(renderCard('summary', demoStats, 'dark'), renderCard('summary', demoStats, 'light'));
  });

  it('gives every card its own gradient ids so they can share an HTML page', () => {
    const ids = CARD_NAMES.map((name) => /<linearGradient id="([^"]+)"/.exec(renderCard(name, demoStats))?.[1]);
    assert.equal(new Set(ids).size, CARD_NAMES.length);
  });

  it('shows the headline numbers on the summary card', () => {
    const svg = renderCard('summary', demoStats);
    assert.ok(svg.includes('@sample-dev'));
    assert.ok(svg.includes('Night Owl'));
    assert.ok(svg.includes(new Intl.NumberFormat('en-US').format(demoStats.totals.contributions)));
  });

  it('never prints the name of a private repository', () => {
    for (const name of CARD_NAMES) {
      assert.ok(!renderCard(name, demoStats).includes('internal-tools'), name);
    }
  });
});

describe('escaping', () => {
  const hostile = `<script>alert(1)</script> & "quotes" 'single' <img src=x onerror=alert(1)>`;
  const stats = computeStats(makeRaw({ name: hostile, login: 'safe-login' }), { now: AFTER_2025 });

  it('escapes user controlled text in every card', () => {
    for (const name of CARD_NAMES) {
      const svg = renderCard(name, stats);
      assert.ok(!svg.includes('<script'), `${name}: raw <script>`);
      assert.ok(!svg.includes('<img'), `${name}: raw <img>`);
      assertWellFormed(svg);
    }
    assert.ok(renderCard('summary', stats).includes('&lt;script&gt;'));
  });

  it('escapes the message of error cards', () => {
    const svg = renderErrorCard('<b>boom</b> & "bad"');
    assert.ok(!svg.includes('<b>'));
    assert.ok(svg.includes('&lt;b&gt;boom&lt;/b&gt; &amp; &quot;bad&quot;'));
    assertWellFormed(svg);
  });

  it('escapes language colors and names coming from the API', () => {
    const raw = makeRaw({
      repos: [
        { nameWithOwner: 'a/b', isPrivate: false, commits: 5, stars: 0, language: '<Evil>', languageColor: '"/><script>' },
      ],
    });
    const svg = renderCard('languages', computeStats(raw, { now: AFTER_2025 }));
    assert.ok(!svg.includes('<script'));
    assert.ok(!svg.includes('<Evil>'));
    assertWellFormed(svg);
  });
});

describe('error card', () => {
  it('renders a standalone SVG for both themes', () => {
    for (const theme of THEME_NAMES) {
      const svg = renderErrorCard('GitHub user not found.', theme);
      assert.ok(svg.includes('Could not generate this card'));
      assert.ok(svg.includes('GitHub user not found.'));
      assertWellFormed(svg);
    }
  });
});
