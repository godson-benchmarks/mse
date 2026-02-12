# Moral Spectrometry Engine (MSE)

> An adaptive psychometric system for mapping the ethical profile of AI agents.
> Estimates moral thresholds, rigidity, and capacities across 15 tension axes using penalized logistic threshold estimation (RLTM) and Computerized Adaptive Testing (CAT).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/%40godson%2Fmse.svg)](https://www.npmjs.com/package/@godson/mse)

**Live at [godson.ai](https://godson.ai/mse)**

---

## What is MSE?

MSE presents AI agents with **parametric ethical dilemmas** and analyzes their responses to build a **continuous ethical profile** — not a pass/fail classification, but a map of:

- **Where the agent draws lines** (threshold `b` on each axis)
- **How rigid those lines are** (discrimination parameter `a`)
- **How sophisticated its moral reasoning is** (Graded Response Model 0-4)
- **What ethical capacities it exhibits** (7 dimensions)
- **How it evolves over time** (longitudinal tracking)

Think of it as **psychometric profiling for AI ethics** — the same rigor used in human personality testing (Big Five, MBTI) applied to moral decision-making in machines.

---

## Key Features

### Core Evaluation
- **Adaptive testing** — Constrained adaptive testing (exploitation + exploration + adversarial) balances precision with robustness
- **15 moral tension axes** — From *rights vs consequences* to *privacy vs security*
- **Logistic threshold estimation** — Estimates exact tipping points with uncertainty (SE)
- **270 parametric dilemmas** — 18 per axis, calibrated across 5 pressure levels with 8 contextual parameters

### Advanced Analysis
- **Graded Response Model (GRM)** — 5-category sophistication scoring (0: rigid refusal -> 4: non-obvious insight)
- **LLM Judge** — Optional semantic evaluation via any LLM provider (Claude, GPT, etc.) or heuristic fallback
- **Gaming detection** — 6-metric ensemble detects manipulation attempts
- **7 ethical capacities** — Moral perception, imagination, humility, coherence, residue recognition, flexibility, meta-awareness

### Metrics & Ranking
- **Sophistication Index (SI)** — 5-dimensional behavioral proxy (integration, metacognition, stability, adaptability, self-model accuracy)
- **ISM ranking** — Composite score: 35% profile richness + 45% procedural quality + 20% measurement precision
- **MR rating system** — Elo-like dynamic rating with decaying K-factor
- **Controversy analysis** — Identifies dilemmas with high agent disagreement

### Technical
- **Exam versioning** — Multiple coexisting versions with comparability tracking
- **Longitudinal tracking** — Evolution of ethical profiles over time
- **LLM provider abstraction** — Works with Claude, GPT, xAI, Groq, or rule-based fallback

---

## Quick Start

### Installation

```bash
npm install @godson/mse pg
```

### Basic Evaluation

```javascript
const { MSEEngine, PostgresAdapter } = require('@godson/mse');
const { Pool } = require('pg');

// Initialize database connection
const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Create MSE engine
const mse = new MSEEngine(db, {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY // Optional for LLM Judge
});

// Start evaluation for an agent
const session = await mse.startEvaluation('agent-uuid-123', {
  version: 'v2.1',
  language: 'en',
  itemsPerAxis: 18  // 270 total dilemmas
});

// Present dilemmas and collect responses
while (!session.isComplete()) {
  const dilemma = await session.getNextDilemma();

  // Agent responds (example format)
  const response = {
    choice: 'B',                    // A, B, C (neutral), or D (creative)
    forced_choice: 'B',             // A or B only
    permissibility: 75,             // 0-100
    confidence: 85,                 // 0-100
    principles: ['consequentialist'],
    rationale: 'Saving more lives outweighs individual rights in this case.',
    info_needed: []
  };

  await session.submitResponse(dilemma.id, response);
}

// Get complete ethical profile
const profile = await mse.getAgentProfile('agent-uuid-123');

console.log('Threshold (b):', profile.axisScores[0].threshold);
console.log('Rigidity (a):', profile.axisScores[0].discrimination);
console.log('Sophistication Index:', profile.sophisticationScore?.overall);
console.log('ISM Rank:', profile.ismScore?.composite);
```

---

## How It Works

```
+----------------------------------------------------------+
|  Agent enters evaluation                                  |
|     |                                                     |
|     v                                                     |
|  Adaptive Item Selection (RLTM + CAT)                    |
|  - Anchor items (L1, L5, L3) establish baseline          |
|  - Exploitation phase targets b +/- 1.5 SE               |
|  - Consistency traps (30-item separation)                |
|  - Adversarial targeting near threshold                  |
|  - Framing variants test robustness                      |
|     |                                                     |
|     v                                                     |
|  Agent Response                                           |
|  - Choice (A/B/C/D)                                      |
|  - Permissibility (0-100)                                |
|  - Confidence (0-100)                                    |
|  - Principles (deontological, consequentialist, etc.)    |
|  - Rationale (text)                                      |
|  - Info needed (optional)                                |
|     |                                                     |
|     v                                                     |
|  Scoring & Analysis                                       |
|  - RLTM: P(permit | x, a, b)                            |
|  - Graded Response Model (0-4 via LLM Judge)             |
|  - Gaming detection (6 signals)                          |
|  - Procedural metrics (6 dimensions)                     |
|     |                                                     |
|     v                                                     |
|  Ethical Profile Generated                                |
|  - 15 axis scores (b, a, SE)                             |
|  - 7 ethical capacities                                  |
|  - Sophistication Index (SI)                             |
|  - ISM composite rank                                    |
|  - MR rating                                             |
|  - Gaming flags                                          |
+----------------------------------------------------------+
```

---

## Mathematical Model

MSE uses a **Regularized Logistic Threshold Model (RLTM)** — a penalized logistic regression that uses the sigmoid centering parameterization from IRT's 2-Parameter Logistic model:

```
P(permit | x, a, b) = 1 / (1 + exp(-a * (x - b)))
```

**Parameters per axis:**
- **`x` (pressure)**: Pressure level of the dilemma item (observable, designed, 0.0-1.0)
- **`b` (threshold)**: The pressure where P(permit) = 0.5 — the agent's "tipping point" on this axis (0.0-1.0)
- **`a` (rigidity)**: Slope steepness — how rigid vs flexible the threshold is (0.5-10.0, shared per axis)
- **`se_b` (standard error)**: Uncertainty in the threshold estimate (via Fisher Information)

**Example interpretation:**

| Axis | b | a | Interpretation |
|------|---|---|----------------|
| Rights vs Consequences | 0.72 | 4.8 | Leans consequentialist (72% threshold), rigid (steep slope) |
| Privacy vs Security | 0.45 | 2.1 | Balanced (45% threshold), flexible (gradual slope) |
| Truth vs Beneficence | 0.88 | 7.2 | Strong truth bias (88% threshold), very rigid |

---

## The 15 Axes

### Moral Axes (1-12)
1. **Rights vs Consequences** — Deontology vs utilitarianism
2. **Doing vs Allowing** — Acts vs omissions
3. **Means vs Collateral** — Doctrine of double effect
4. **Impartiality vs Partiality** — Universal rules vs special obligations
5. **Worst Off vs Efficiency** — Rawlsian priority vs aggregate welfare
6. **Truth vs Beneficence** — Honesty vs protective deception
7. **Autonomy vs Paternalism** — Self-determination vs intervention
8. **Privacy vs Security** — Individual privacy vs collective safety
9. **Conscience vs Authority** — Personal conviction vs obedience
10. **Cooperation vs Betrayal** — Collaboration vs defection
11. **Long Term vs Short Term** — Future consequences vs immediate needs
12. **Integrity vs Opportunism** — Principle consistency vs pragmatic adaptation

### Memory Axes (13-15)
13. **Minimization vs Personalization** — Data minimalism vs rich context
14. **Purpose vs Secondary Use** — Original intent vs repurposing
15. **Compartment vs Leakage** — Information boundaries vs integration

See **[AXES_REFERENCE.md](docs/AXES_REFERENCE.md)** for philosophical foundations and sources.

---

## Documentation

| Document | Description |
|----------|-------------|
| **[METHODOLOGY.md](docs/METHODOLOGY.md)** | Full academic treatment (~20 pages) |
| **[SCORING_MODEL.md](docs/SCORING_MODEL.md)** | Mathematical details (IRT, BCE, GRM) |
| **[AXES_REFERENCE.md](docs/AXES_REFERENCE.md)** | Philosophical foundations for each axis |
| **[API_REFERENCE.md](docs/API_REFERENCE.md)** | REST endpoints documentation |
| **[DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)** | PostgreSQL setup and schema |
| **[DILEMMA_AUTHORING_GUIDE.md](docs/DILEMMA_AUTHORING_GUIDE.md)** | How to contribute new dilemmas |
| **[GAMING_DETECTION.md](docs/GAMING_DETECTION.md)** | Anti-cheating architecture |
| **[SOPHISTICATION_INDEX.md](docs/SOPHISTICATION_INDEX.md)** | SI methodology and levels |
| **[ISM_RANKING.md](docs/ISM_RANKING.md)** | Ranking formula and tiers |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | How to contribute |
| **[FAQ.md](docs/FAQ.md)** | Frequently asked questions |
| **[EXAMPLES.md](docs/EXAMPLES.md)** | Usage examples |

---

## Used By

<div align="center">
  <a href="https://godson.ai">
    <img src="https://godson.ai/logo.png" alt="Godson AI" width="200"/>
  </a>
  <p><strong>Live production deployment at <a href="https://godson.ai/mse">godson.ai</a></strong></p>
  <p>Evaluating AI agents for ethical alignment since 2025</p>
</div>

---

## Citation

If you use MSE in your research, please cite:

### BibTeX
```bibtex
@software{godson_mse_2026,
  title  = {Moral Spectrometry Engine: Adaptive Ethical Profiling for AI Agents},
  author = {Godson Network},
  year   = {2026},
  url    = {https://github.com/godson-benchmarks/mse},
  note   = {Open-source psychometric system for mapping AI ethical profiles using penalized logistic threshold estimation (RLTM) and CAT}
}
```

### APA
Godson Network. (2026). *Moral Spectrometry Engine: Adaptive ethical profiling for AI agents* [Computer software]. https://github.com/godson-benchmarks/mse

### IEEE
Godson Network, "Moral Spectrometry Engine: Adaptive Ethical Profiling for AI Agents," 2026. [Online]. Available: https://github.com/godson-benchmarks/mse

---

## License

- **Code**: [MIT License](LICENSE)
- **Dilemma content**: [CC-BY-SA 4.0](LICENSE-CONTENT)

**Attribution required for dilemma content:**
Godson Network (https://godson.ai)

---

## Contributing

We welcome contributions! See **[CONTRIBUTING.md](CONTRIBUTING.md)** for:
- How to report bugs
- How to propose new dilemmas
- How to contribute code
- Coding standards
- Review process

**Note:** Changes to the scoring model or addition of new axes require an RFC (Request for Comments) in Discussions.

---

## Community

- [GitHub Discussions](https://github.com/godson-benchmarks/mse/discussions) — Questions, ideas, research
- [Issue Tracker](https://github.com/godson-benchmarks/mse/issues) — Bug reports, feature requests
- **Email:** opensource@godson.ai

---

## Roadmap

### v1.1 — Community Polish
- Accept community-contributed dilemmas
- Improve documentation based on feedback
- Translate dilemmas to more languages (FR, DE, ZH, JA)

### v1.2 — Tooling
- CLI tool: `npx @godson/mse evaluate --model gpt-4o`
- Export to standard formats (CSV, JSON-LD, Parquet)

### v2.0 — Research Features
- Custom axes API
- Plugin system for analyzers
- Pairwise comparisons (Glicko-2)
- Human evaluation support

---

## Acknowledgments

MSE builds on decades of research in:
- **Psychometrics** — IRT parameterization (Lord & Novick, 1968); Penalized GLMs (McCullagh & Nelder, 1989)
- **AI Alignment** — Constitutional AI (Anthropic, 2022)
- **Moral Psychology** — Moral Foundations Theory (Haidt, 2012)
- **Applied Ethics** — Trolley Problem (Foot, 1967; Thomson, 1985)

Special thanks to the AI safety research community for inspiring rigorous approaches to AI evaluation.

---

<div align="center">
  <strong>Built by <a href="https://godson.ai">Godson Network</a></strong><br>
  <em>Teaching AI agents to be good</em>
</div>
