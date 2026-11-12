<div align="center">

# 🎁 Git Wrapped

**Your year in code, wrapped.**
Shareable recap cards for any GitHub profile: languages, streaks, coding rhythm and your dev personality.

[![CI](https://github.com/guilhermeoliveirabrito/gitwrapped/actions/workflows/ci.yml/badge.svg)](https://github.com/guilhermeoliveirabrito/gitwrapped/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522.18-339933.svg)](https://nodejs.org)
[![Zero dependencies](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen.svg)](package.json)

[Português](README.pt-BR.md)

<img src="docs/examples/summary-dark.svg" alt="Git Wrapped summary card" width="720">

</div>

## Why

Spotify has Wrapped. Your commit history deserves one too. Git Wrapped turns a year of GitHub activity into a set of clean 1200×630 cards that are ready to post or embed in your profile README.

- **Five cards**: summary, languages, coding rhythm, contribution calendar and dev personality
- **Dark and light themes**, plain SVG: sharp at any size, tiny, and works in a README
- **CLI and HTTP API**: generate files locally, or serve cards you can embed with one line of Markdown
- **Zero runtime dependencies**: just Node.js, the standard library and the GitHub GraphQL API
- **Private by default**: private repository names never appear on a card
- **Try it without a token**: `--demo` runs on built-in sample data

## Quick start

You need Node.js 22.18 or newer.

```bash
git clone https://github.com/guilhermeoliveirabrito/gitwrapped.git
cd gitwrapped
npm install

# no token needed, uses sample data
npm run cli -- --demo
```

To use your own profile, create a [personal access token](https://github.com/settings/tokens) (no scopes are needed for public data; add `read:user` to count private contributions) and run:

```bash
export GITHUB_TOKEN=ghp_your_token
npm run cli -- <your-username>
```

Cards are written to `./wrapped` and a summary is printed in the terminal:

```text
  Git Wrapped 2025 · @sample-dev

  1,121 contributions   922 commits   64 PRs   112 reviews
  252 days active · longest streak 35 days · current streak 3 days
  Busiest day: May 19 (15 contributions)
  Peak hour: 10pm (night coder)

  Languages
  TypeScript ████████████████░░░░░░░░ 64.7%
  Python     ███░░░░░░░░░░░░░░░░░░░░░ 12.6%
  Rust       ██░░░░░░░░░░░░░░░░░░░░░░ 9.3%
  ...

  🦉 The Night Owl
  The best commits happen after the world goes to sleep.
```

### CLI options

| Option | Description |
| --- | --- |
| `-y, --year <year>` | Year to summarize (default: current year) |
| `-c, --card <names>` | Comma separated cards, or `all` (default) |
| `-t, --theme <theme>` | `dark` (default) or `light` |
| `-o, --out <dir>` | Output directory (default: `./wrapped`) |
| `--tz=<hours>` | UTC offset for the hourly chart, e.g. `--tz=-3` (default: your system timezone) |
| `--json` | Print the computed stats as JSON instead of writing files |
| `--demo` | Use built-in sample data, no token needed |

```bash
npm run cli -- octocat --year 2024 --card summary,heatmap --theme light
```

## The cards

| | |
| --- | --- |
| <img src="docs/examples/languages-dark.svg" alt="Languages card"> | <img src="docs/examples/rhythm-dark.svg" alt="Coding rhythm card"> |
| <img src="docs/examples/heatmap-dark.svg" alt="Contribution calendar card"> | <img src="docs/examples/personality-dark.svg" alt="Dev personality card"> |

Everything also comes in a light theme:

<img src="docs/examples/summary-light.svg" alt="Summary card, light theme" width="560">

## Embed in your profile README

Run the server and every card becomes an image URL:

```bash
export GITHUB_TOKEN=ghp_your_token
npm start        # after npm run build, or use npm run dev
```

```markdown
![My 2025 wrapped](https://your-host/api/card/summary?user=octocat&year=2025)
```

Open the server's home page for a live preview and a copy-paste snippet. Because it is a regular image, it works anywhere Markdown does.

### API

| Endpoint | Returns |
| --- | --- |
| `GET /api/card/:card?user=&year=&theme=&tz=` | An SVG card |
| `GET /api/stats?user=&year=&tz=` | The computed stats as JSON |
| `GET /api/demo/:card?theme=` | A card with sample data, no token needed |
| `GET /healthz` | Health check |

`:card` is one of `summary`, `languages`, `rhythm`, `heatmap`, `personality`. Errors on card endpoints are rendered as a card too, so a broken embed explains itself instead of showing a missing-image icon.

GitHub data is cached in memory for an hour, concurrent lookups for the same profile are de-duplicated, and each client is limited to 60 requests per minute. Set `TRUST_PROXY=1` when running behind a reverse proxy so the limit applies per real client address.

### Docker

```bash
docker build -t gitwrapped .
docker run -p 3000:3000 -e GITHUB_TOKEN=ghp_your_token gitwrapped
```

## Dev personalities

Your personality comes from simple, readable rules over your real activity. There is no model and no randomness: the same year always gives the same result.

| | Personality | Signal |
| --- | --- | --- |
| 🦉 | The Night Owl | Most commits land between 10pm and 5am |
| 🌅 | The Early Bird | Most commits land between 5am and noon |
| ⚔️ | The Weekend Warrior | 35%+ of contributions on weekends |
| 🏃 | The Marathoner | A streak of 21+ days |
| ⚡ | The Sprinter | Most of the year's work in the busiest 10% of days |
| 🤝 | The Collaborator | PRs, issues and reviews dominate |
| 🌍 | The Polyglot | Six or more languages |
| 🎯 | The Specialist | One language over 75% of commits |
| 🧱 | The Steady Builder | Active on more than half the days of the year |
| 🧭 | The Explorer | Everything else |

The rules live in [`src/personality.ts`](src/personality.ts). Want a new archetype? Open a PR.

## How it works

```text
GitHub GraphQL API
       │  fetchYearData()        src/github.ts
       ▼
   RawYearData ──► computeStats() ──► WrappedStats      src/stats.ts
                                          │
                          ┌───────────────┼───────────────┐
                          ▼               ▼               ▼
                      renderCard()       CLI          HTTP server
                       src/cards/     src/cli.ts     src/server.ts
```

- **One request, two sources.** The contribution calendar and per-repository commit counts come from a single GraphQL query. Commit timestamps for the hourly chart are sampled with a second, aliased query (up to 100 commits from each of your 10 most active repositories) because the calendar only has day-level precision. If that sample fails, the hourly chart is skipped and everything else still works.
- **Pure core.** `computeStats` has no I/O and takes the current time as a parameter, so the stats are easy to test.
- **No templating library.** Cards are plain SVG strings built with a tiny helper layer in `src/cards/svg.ts`, and every piece of user-controlled text is escaped.

## Development

```bash
npm install
npm test             # unit and integration tests (node:test)
npm run typecheck
npm run build        # compile to dist/
npm run examples     # regenerate docs/examples
```

Node runs the TypeScript sources directly during development, so there is no watch step and no bundler. Tests mock the GitHub API and also start a real HTTP server on an ephemeral port.

## Roadmap

Ideas that would make a great first contribution:

- [ ] Publish to npm so `npx gitwrapped <user>` just works
- [ ] GitHub Action that keeps a wrapped card in your profile README up to date
- [ ] PNG export for platforms that do not accept SVG
- [ ] More cards: pull request and review stats, most starred repository
- [ ] Translated cards (the strings are all in `src/cards/`)
- [ ] Team and organization wrapped

See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## License

[MIT](LICENSE) © Guilherme Oliveira de Brito Silva
