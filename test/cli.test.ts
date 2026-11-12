import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { run, parseCli } from '../src/cli.ts';
import type { CliIO } from '../src/cli.ts';
import { GitWrappedError } from '../src/errors.ts';

const NOW = new Date('2026-03-10T12:00:00Z');

function capture(overrides: Partial<CliIO> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIO = {
    stdout: (t) => void out.push(t),
    stderr: (t) => void err.push(t),
    env: {},
    cwd: process.cwd(),
    now: NOW,
    color: false,
    ...overrides,
  };
  return { io, stdout: () => out.join(''), stderr: () => err.join('') };
}

const invalidInput = (e: unknown) => e instanceof GitWrappedError && e.code === 'INVALID_INPUT';

describe('parseCli', () => {
  it('applies defaults', () => {
    const options = parseCli(['octocat'], NOW);
    assert.equal(options.username, 'octocat');
    assert.equal(options.year, 2026);
    assert.deepEqual(options.themes, ['dark']);
    assert.equal(options.name, '{login}-{year}-{card}');
    assert.equal(options.out, 'wrapped');
    assert.equal(options.cards.length, 6);
    assert.equal(options.utcOffsetMinutes, undefined);
    assert.equal(options.demo, false);
  });

  it('reads short and long options', () => {
    const options = parseCli(['@octocat', '-y', '2024', '-t', 'light', '-o', 'out', '-c', 'summary,Heatmap,summary'], NOW);
    assert.equal(options.username, 'octocat');
    assert.equal(options.year, 2024);
    assert.deepEqual(options.themes, ['light']);
    assert.equal(options.out, 'out');
    assert.deepEqual(options.cards, ['summary', 'heatmap']);
  });

  it('accepts negative and fractional timezone offsets', () => {
    assert.equal(parseCli(['x', '--tz=-3'], NOW).utcOffsetMinutes, -180);
    assert.equal(parseCli(['x', '--tz=5.5'], NOW).utcOffsetMinutes, 330);
  });

  it('expands --theme both into both themes', () => {
    assert.deepEqual(parseCli(['x', '--theme', 'both'], NOW).themes, ['dark', 'light']);
  });

  it('rejects --name values that could escape the output directory', () => {
    for (const bad of ['../evil', 'a/b', 'a\\b', '..', '   ', '']) {
      assert.throws(() => parseCli(['x', '--name', bad], NOW), invalidInput, JSON.stringify(bad));
    }
    assert.equal(parseCli(['x', '--name', '{card}'], NOW).name, '{card}');
  });

  it('allows --demo without a username', () => {
    const options = parseCli(['--demo'], NOW);
    assert.equal(options.demo, true);
    assert.equal(options.username, undefined);
  });

  it('rejects bad input with INVALID_INPUT', () => {
    assert.throws(() => parseCli(['x', '--card', 'nope'], NOW), invalidInput);
    assert.throws(() => parseCli(['x', '--theme', 'neon'], NOW), invalidInput);
    assert.throws(() => parseCli(['x', '--year', 'abc'], NOW), invalidInput);
    assert.throws(() => parseCli(['x', '--year', '20.5'], NOW), invalidInput);
    assert.throws(() => parseCli(['x', '--tz=20'], NOW), invalidInput);
    assert.throws(() => parseCli(['x', '--tz=abc'], NOW), invalidInput);
    assert.throws(() => parseCli(['a', 'b'], NOW), invalidInput);
    assert.throws(() => parseCli(['x', '--nope'], NOW), invalidInput);
  });
});

describe('run', () => {
  let dir: string;
  before(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'gitwrapped-'));
  });
  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('prints help when called without arguments', async () => {
    const c = capture();
    assert.equal(await run([], c.io), 0);
    assert.match(c.stdout(), /Usage/);
    assert.equal(c.stderr(), '');
  });

  it('prints the version', async () => {
    const c = capture();
    assert.equal(await run(['--version'], c.io), 0);
    assert.match(c.stdout(), /^\d+\.\d+\.\d+/);
  });

  it('generates every card from demo data without a token', async () => {
    const out = path.join(dir, 'demo');
    const c = capture({ cwd: dir });
    assert.equal(await run(['--demo', '--year', '2025', '--out', out], c.io), 0);

    const files = (await readdir(out)).sort();
    assert.deepEqual(files, [
      'sample-dev-2025-heatmap.svg',
      'sample-dev-2025-languages.svg',
      'sample-dev-2025-personality.svg',
      'sample-dev-2025-repos.svg',
      'sample-dev-2025-rhythm.svg',
      'sample-dev-2025-summary.svg',
    ]);
    const summary = await readFile(path.join(out, 'sample-dev-2025-summary.svg'), 'utf8');
    assert.ok(summary.startsWith('<svg'));
    assert.match(c.stdout(), /Git Wrapped 2025/);
    assert.match(c.stdout(), /Saved 6 cards/);
    assert.match(c.stdout(), /The Night Owl/);
  });

  it('writes only the requested cards in the requested theme', async () => {
    const out = path.join(dir, 'only-summary');
    const c = capture({ cwd: dir });
    assert.equal(await run(['--demo', '-c', 'summary', '-t', 'light', '-o', out], c.io), 0);
    assert.deepEqual(await readdir(out), ['sample-dev-2026-summary.svg']);
    assert.match(await readFile(path.join(out, 'sample-dev-2026-summary.svg'), 'utf8'), /#f8fafc/);
  });

  it('writes both themes with stable names for profile READMEs', async () => {
    const out = path.join(dir, 'both');
    const c = capture({ cwd: dir });
    assert.equal(await run(['--demo', '-c', 'summary,heatmap', '-t', 'both', '--name', '{card}', '-o', out], c.io), 0);
    assert.deepEqual((await readdir(out)).sort(), [
      'heatmap-dark.svg',
      'heatmap-light.svg',
      'summary-dark.svg',
      'summary-light.svg',
    ]);
    const dark = await readFile(path.join(out, 'summary-dark.svg'), 'utf8');
    const light = await readFile(path.join(out, 'summary-light.svg'), 'utf8');
    assert.notEqual(dark, light);
    assert.match(c.stdout(), /Saved 4 cards/);
  });

  it('prints parseable JSON with --json and writes no files', async () => {
    const c = capture({ cwd: dir });
    assert.equal(await run(['--demo', '--json', '-o', path.join(dir, 'json-out')], c.io), 0);
    const stats = JSON.parse(c.stdout());
    assert.equal(stats.login, 'sample-dev');
    assert.equal(stats.personality.id, 'night-owl');
    await assert.rejects(readdir(path.join(dir, 'json-out')));
  });

  it('fails with a helpful message when there is no token', async () => {
    const c = capture();
    assert.equal(await run(['octocat'], c.io), 1);
    assert.match(c.stderr(), /GITHUB_TOKEN/);
    assert.match(c.stderr(), /--demo/);
    assert.equal(c.stdout(), '');
  });

  it('returns exit code 2 for invalid usage', async () => {
    const c = capture();
    assert.equal(await run(['octocat', '--card', 'nope'], c.io), 2);
    assert.match(c.stderr(), /Unknown card/);
  });

  it('fetches real data through the API client and falls back to GH_TOKEN', async () => {
    const seen: string[] = [];
    const user = {
      id: 'U_1',
      login: 'octocat',
      name: 'The Octocat',
      followers: { totalCount: 1 },
      contributionsCollection: {
        totalCommitContributions: 3,
        totalIssueContributions: 0,
        totalPullRequestContributions: 0,
        totalPullRequestReviewContributions: 0,
        contributionCalendar: {
          weeks: [{ contributionDays: [{ date: '2026-01-05', contributionCount: 3 }] }],
        },
        commitContributionsByRepository: [
          {
            repository: {
              nameWithOwner: 'octocat/hello',
              isPrivate: false,
              stargazerCount: 2,
              primaryLanguage: { name: 'Go', color: '#00add8' },
            },
            contributions: { totalCount: 1, nodes: [{ commitCount: 3 }] },
          },
        ],
      },
    };
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      seen.push((init?.headers as Record<string, string>).Authorization ?? '');
      const body = seen.length === 1 ? { data: { user } } : { data: { r0: null } };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;

    const out = path.join(dir, 'real');
    const c = capture({ cwd: dir, env: { GH_TOKEN: 'from-gh-token' }, fetchImpl });
    assert.equal(await run(['octocat', '-c', 'languages', '-o', out], c.io), 0);

    assert.equal(seen[0], 'Bearer from-gh-token');
    assert.deepEqual(await readdir(out), ['octocat-2026-languages.svg']);
    assert.match(c.stdout(), /@octocat/);
    assert.match(c.stdout(), /Go/);
  });

  it('reports API errors without a stack trace', async () => {
    const fetchImpl = (async () => new Response('{}', { status: 401 })) as typeof fetch;
    const c = capture({ env: { GITHUB_TOKEN: 'bad' }, fetchImpl });
    assert.equal(await run(['octocat'], c.io), 1);
    assert.match(c.stderr(), /rejected the token/);
    assert.ok(!c.stderr().includes('    at '));
  });
});
