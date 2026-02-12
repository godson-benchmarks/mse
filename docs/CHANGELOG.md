# Changelog

All notable changes to the Moral Spectrometry Engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] - 2026-02-10

### Documentation
- **CLARIFIED:** Parameter naming conventions (hybrid multi-layer strategy)
- **ADDED:** `language` parameter to API documentation (was undocumented but functional)
- **ADDED:** `NAMING_CONVENTIONS.md` guide explaining camelCase vs snake_case support
- **UPDATED:** `API_REFERENCE.md` with parameter aliases table
- **UPDATED:** `EXAMPLES.md` with language parameter
- **CORRECTED:** Adaptive testing documentation to reflect actual implementation
- **CLARIFIED:** Fisher Information used for SE calculation, not item selection
- **DOCUMENTED:** Constrained adaptive testing strategy (exploitation + exploration + adversarial)

### Technical
- **CLARIFIED:** `session.js` accepts both camelCase and snake_case parameters
- **CLARIFIED:** `ProxyEvaluationService.js` and `JobProcessor.js` accept both naming conventions
- **SIMPLIFIED:** `PostgresAdapter` now standalone class (no inheritance)
- **SIMPLIFIED:** `MSEEngine` constructor (removed unused storageAdapter parameter)
- **NO BREAKING CHANGES:** All existing evaluations and code continue to work

**Backward Compatibility:**
- Both camelCase (JavaScript convention) and snake_case (Python/DB convention) parameter names supported indefinitely
- Storage is PostgreSQL-only
- Adaptive testing algorithm unchanged (documentation now accurately reflects implementation)

See `NAMING_CONVENTIONS.md` and `METHODOLOGY.md` for details.

---

## [1.0.0] - 2026-02-10 (Open Source Launch)

### Added - Core Engine (@godson/mse)

**Evaluation System:**
- Regularized Logistic Threshold Model (RLTM) — penalized logistic regression with IRT-derived parameterization — for threshold estimation
- Computerized Adaptive Testing (CAT) with 5-phase algorithm
- Adaptive ridge regularization for small sample sizes
- Fisher Information-based standard error computation
- 15 axes of moral tension (12 moral + 3 memory axes)
- 225+ parametric dilemmas with v2.0 metadata
- 5 pressure levels (L1-L5) calibrated to difficulty
- 7 dilemma types (base, framing, pressure, consistency_trap, particularist, dirty_hands, tragic)

**Advanced Analysis:**
- Graded Response Model (GRM) with 5-category sophistication scoring
- LLM Judge integration (Claude, GPT, custom providers)
- Heuristic fallback for GRM (no API required)
- Gaming detection ensemble (6 signals)
- 7 ethical capacities (perception, imagination, humility, coherence, residue, flexibility, meta-awareness)
- Sophistication Index (SI) with 5 dimensions
- ISM composite ranking (ProfileRichness, ProceduralQuality, MeasurementPrecision)
- Moral Rating (MR) system with Elo-like dynamics
- Controversy analysis for dilemmas
- 6 procedural metrics (sensitivity, info-seeking, calibration, consistency, robustness, transparency)

**Extensibility:**
- PostgresAdapter implementation (63 methods)
- LLM Provider pattern (LLM-agnostic)
- AnthropicProvider, OpenAIProvider, HeuristicProvider
- SubjectProvider pattern (agent data decoupling)
- Exam versioning system

**API:**
- Express.js REST routes (optional)
- Evaluation lifecycle endpoints
- Profile retrieval and history
- Comparison analysis
- Leaderboards (MR, SI)

**Content:**
- 225+ bilingual dilemmas (English + Spanish)
- 15 axis definitions with philosophical foundations
- Consistency groups for trap scheduling
- Exam version definitions (v0.1b, v2.1)
- 8 contextual parameters per dilemma
- Non-obvious factors metadata
- Expert disagreement ratings

**Documentation:**
- README.md — Overview, quick start, examples
- METHODOLOGY.md — 20-page academic foundation
- AXES_REFERENCE.md — Philosophical sources for all axes
- SCORING_MODEL.md — Mathematical derivations
- GAMING_DETECTION.md — Anti-cheating architecture
- SOPHISTICATION_INDEX.md — SI methodology
- ISM_RANKING.md — Composite ranking formula
- CONTRIBUTING.md — Contribution guidelines
- FAQ.md — Frequently asked questions
- EXAMPLES.md — Usage examples
- CHANGELOG.md — This file

---

## Versioning Strategy

### Major Version (X.0.0)

**Breaking changes:**
- Changes to scoring model that invalidate previous profiles
- Changes to axis definitions or structure
- Backward-incompatible API changes
- Database schema changes requiring migration

### Minor Version (1.X.0)

**Non-breaking additions:**
- New dilemmas
- New analysis features (new analyzers, metrics)
- New LLM adapters
- API additions (new endpoints, optional parameters)

### Patch Version (1.0.X)

**Bug fixes and minor improvements:**
- Bug fixes
- Documentation updates
- Performance improvements
- Dependency updates

---

## Exam Versions (Independent Versioning)

**Exam versions track dilemma content separately from code:**

### v2.1 (Current)
- 270 items (18 per axis x 15 axes)
- Complete v2.0 metadata
- All 7 dilemma types

### v0.1b (Deprecated)
- 75 items (5 per axis x 15 axes)
- Basic metadata
- Base dilemmas only

**Note:** Exam versions evolve independently. Code v1.2.0 can evaluate with exam v2.1 or v0.1b.

---

## Migration Guides

### From Godson Internal MSE to Open Source v1.0.0

**Breaking changes:**
- `MSERepository` deprecated -> Use `PostgresAdapter`
- Direct agent table access removed -> Use `SubjectProvider`

**Migration:**
```javascript
// Old
const repository = new MSERepository(db);

// New
const adapter = new PostgresAdapter(db, subjectProvider);
const mse = new MSEEngine(db);
```

---

## Upcoming Features

See [GitHub Projects](https://github.com/godson-benchmarks/mse/projects) for roadmap.

**Planned for v1.1:**
- [ ] CLI tool: `npx @godson/mse evaluate`
- [ ] Export to CSV/JSON-LD/Parquet
- [ ] Additional language translations (FR, DE, ZH, JA)
- [ ] Community-contributed dilemmas

**Planned for v1.2:**
- [ ] SQLite adapter
- [ ] Web evaluation interface

**Planned for v2.0:**
- [ ] Custom axes API
- [ ] Plugin system for analyzers
- [ ] Pairwise comparisons (Glicko-2)
- [ ] Human evaluation support

---

## Credits

**Core Team:**
- Godson Network Research Team

**Inspired by:**
- IRT parameterization (Lord & Novick, 1968)
- Constitutional AI (Anthropic, 2022)
- Moral Foundations Theory (Haidt, 2012)
- Trolley Problem (Foot, 1967; Thomson, 1985)

---

## License

- **Code:** MIT License
- **Content:** CC-BY-SA 4.0

---

[1.0.1]: https://github.com/godson-benchmarks/mse/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/godson-benchmarks/mse/releases/tag/v1.0.0
