# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to follow
[Semantic Versioning](https://semver.org/) once it reaches 1.0.

## [Unreleased]

### Added

- Six SVG cards in dark and light themes: summary, languages, top repositories, coding rhythm,
  contribution calendar and dev personality.
- `gitwrapped` command line tool with `--demo`, `--json`, `--card`, `--theme` (including `both`),
  `--name`, `--year`, `--tz` and `--out`.
- HTTP server with `/api/card/:card`, `/api/stats` and `/api/demo/:card`, a landing page with a live
  preview, an in-memory cache and per-client rate limiting.
- GitHub Action that regenerates the cards and commits them to a profile repository.
- Dockerfile for self-hosting.
- Cards in English and Brazilian Portuguese (`--lang`, `?lang=` and the Action's `lang` input).
- English and Portuguese READMEs.

### Fixed

- Calendar days that have not happened yet are ignored for the current year, so the number of days in
  the period and the current streak are correct.
