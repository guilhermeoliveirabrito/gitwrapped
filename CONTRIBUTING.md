# Contributing to Git Wrapped

Thanks for taking a look! Bug reports, ideas and pull requests are all welcome, from typo fixes to new cards.

## Getting set up

You need Node.js 22.18 or newer.

```bash
git clone https://github.com/guilhermeoliveirabrito/gitwrapped.git
cd gitwrapped
npm install
npm test
```

Node runs the TypeScript sources directly, so there is nothing to compile while developing. Try your changes with the demo data, which needs no token:

```bash
npm run cli -- --demo --out ./preview
```

## Before you open a pull request

```bash
npm run typecheck
npm test
npm run examples     # only if you changed how a card looks
```

CI checks the same things, and also fails if `docs/examples` is out of date with the card code.

## Project layout

| Path | What lives there |
| --- | --- |
| `src/github.ts` | GraphQL client and data normalization |
| `src/stats.ts` | Pure functions that turn raw data into stats |
| `src/personality.ts` | The rules behind each dev personality |
| `src/cards/` | One file per card, the shared SVG helpers and `i18n.ts` with all the text |
| `src/cli.ts` | Argument parsing and the command line flow |
| `src/server.ts` | The HTTP API |
| `test/` | Tests, using `node:test` |

## Guidelines

- **Keep runtime dependencies at zero.** If you think a dependency is worth it, open an issue first and let's talk.
- **Escape everything.** Any text that comes from GitHub (names, repository names, languages) must go through `esc()` before it lands in an SVG.
- **Never expose private repositories.** Names of private repos must not appear in cards, JSON or logs.
- **Test your change.** Stats logic needs unit tests; new cards need to be added to the rendering tests, including the empty-year case.
- **Keep pull requests focused.** One idea per PR is easier to review and quicker to merge.
- **Look at the result.** For visual changes, add a screenshot or the generated SVG to the PR description.

## Adding a card

1. Create `src/cards/<name>.ts` exporting a function `(stats, theme, labels) => string`. The existing cards are good templates.
2. Put every visible string in `src/cards/i18n.ts` (for each language) and read it from `labels.m`. Use `labels.fmt`, `labels.days` and friends for numbers and dates.
3. Register the card in `src/cards/index.ts`.
4. Run `npm test` (the rendering tests pick it up automatically) and `npm run examples`.
5. Mention it in the README.

## Adding a language

All the text on the cards lives in `src/cards/i18n.ts`.

1. Add the language code to `LOCALES` and a `Messages` object to `MESSAGES`. The type checker lists every string that is missing.
2. Teach `parseLocale` the spellings people will use (`es`, `es-ES`, and so on).
3. Run `npm test`. The tests check that your language has every key, translates every dev personality, and renders every card without producing broken text.
4. Look at the result with `npm run cli -- --demo --lang <code>`. Some languages need more room than English, so check the long strings, such as the personality titles and the sentence under the rhythm headline.

Please write the text the way a developer would say it, not as a literal translation.

## Reporting bugs

Open an issue with the command or URL you used, what you expected and what happened. Please do not paste tokens. For security problems, see [SECURITY.md](SECURITY.md).

## Code of conduct

Be kind and assume good intentions. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
