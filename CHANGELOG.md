# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-10

### Added

- **packages/dilemmas/** — Consolidated from [godson-benchmarks/mse-dilemmas](https://github.com/godson-benchmarks/mse-dilemmas) (now archived). Contains 225+ parametric ethical dilemmas, import/export/validate scripts, and CC-BY-SA 4.0 license.
- **packages/react/** — Consolidated from [godson-benchmarks/mse-react](https://github.com/godson-benchmarks/mse-react) (now archived). Contains React visualization components (EthicalProfileCard, EthicalAxisBar, ExamsTab, etc.), data-fetching hooks, and TypeScript types.
- **CHANGELOG.md** — This file.
- **Packages table** in README.md listing all three packages.

### Changed

- Updated internal URLs in seed SQL files (`002_dilemmas.sql`, `003_consistency_groups.sql`) to point to `packages/dilemmas/` instead of the archived `mse-dilemmas` repo.

## [1.0.0] - 2026-02-08

### Added

- Initial open-source release of the Moral Spectrometry Engine.
- `packages/core/` — Evaluation engine, RLTM scoring, adaptive testing, gaming detection, sophistication index.
- Full documentation suite (methodology, scoring model, axes reference, API reference, FAQ).
- Database migrations and seed data.
- CITATION.cff, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md.
