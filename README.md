# @godson/mse

> Core engine for the Moral Spectrometry Engine - Adaptive psychometric system for mapping AI agent ethical profiles by Godson.ai (https://www.godson.ai/)

## Installation

```bash
npm install @godson/mse pg
```

## Quick Start

```javascript
const { MSEEngine, PostgresAdapter } = require('@godson/mse');
const { Pool } = require('pg');

// Setup database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Initialize MSE Engine
const mse = new MSEEngine(db, {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY  // Optional for LLM Judge
});

// Start evaluation
const session = await mse.startEvaluation(agentId, {
  version: 'v2.1',
  itemsPerAxis: 18  // 270 total items
});

// Evaluation loop
while (!session.isComplete()) {
  const dilemma = await session.getNextDilemma();

  // Present dilemma to agent and get response
  const response = await askAgent(dilemma);

  // Submit response
  await session.submitResponse(dilemma.id, {
    choice: response.choice,                    // 'A', 'B', 'C', or 'D'
    forced_choice: response.forcedChoice,       // 'A' or 'B'
    permissibility: response.permissibility,    // 0-100
    confidence: response.confidence,            // 0-100
    principles: response.principles,            // Array of strings
    rationale: response.rationale,              // Text explanation
    info_needed: response.infoNeeded || []      // Additional info requests
  });
}

// Get complete profile
const profile = await mse.getAgentProfile(agentId);
console.log('Ethical Profile:', profile);
```

## Features

- **Constrained Adaptive Testing** - Three-heuristic item selection (proximity, exploration, adversarial) optimized for small samples (5-18 items per axis)
- **15 Moral Tension Axes** - From rights-vs-consequences to privacy-vs-security
- **Logistic Threshold Estimation** - Estimates exact tipping points with uncertainty
- **270 Parametric Dilemmas** - 18 per axis, calibrated across 5 pressure levels with 8 parameters
- **Graded Response Model** - 5-category sophistication scoring (0: rigid to 4: nuanced)
- **LLM Judge** - Optional semantic evaluation via any LLM provider
- **Gaming Detection** - 6-metric ensemble detects manipulation attempts
- **7 Ethical Capacities** - Perception, imagination, humility, coherence, residue, flexibility, meta-awareness
- **Sophistication Index (SI)** - 5-dimensional behavioral proxy
- **ISM Ranking** - Composite score for agent comparison
- **Provider-agnostic LLM** - Anthropic, OpenAI, or custom providers

## Documentation

- [Methodology](https://github.com/godsons-ai/mse/blob/main/docs/METHODOLOGY.md) - Academic foundation
- [API Reference](https://github.com/godsons-ai/mse/blob/main/docs/API_REFERENCE.md) - All endpoints
- [Scoring Model](https://github.com/godsons-ai/mse/blob/main/docs/SCORING_MODEL.md) - Mathematical details
- [Naming Conventions](https://github.com/godsons-ai/mse/blob/main/docs/NAMING_CONVENTIONS.md) - Parameter naming guide

## LLM Providers

The MSE can use any LLM for semantic evaluation (Graded Response Model):

```javascript
const { LLMJudge, AnthropicProvider, OpenAIProvider } = require('@godson/mse');

// Anthropic Claude (default)
const llmJudge = new LLMJudge({
  provider: new AnthropicProvider({ apiKey: 'sk-...' })
});

// OpenAI GPT
const llmJudge = new LLMJudge({
  provider: new OpenAIProvider({ apiKey: 'sk-...' })
});

// Custom provider
class CustomProvider extends LLMProvider {
  async call(prompt, options) { /* ... */ }
}
```

### Heuristic Fallback

The MSE works without an LLM API key by using a heuristic scoring system:

```javascript
const { HeuristicProvider } = require('@godson/mse');

const mse = new MSEEngine(db, {
  llmJudge: new LLMJudge({ provider: new HeuristicProvider() })
});
```

## Mathematical Model

The MSE uses a Regularized Logistic Threshold Model (RLTM) -- a penalized logistic regression that uses the sigmoid centering parameterization from IRT's 2-Parameter Logistic model:

```
P(permit | x, a, b) = 1 / (1 + exp(-a * (x - b)))
```

Where:
- **x** = pressure level (observable, designed, 0.0-1.0)
- **b** = agent threshold (0.0-1.0): pressure where P = 0.5 (the "tipping point")
- **a** = rigidity (0.5-10.0): slope steepness (shared per axis)
- **SE(b)** = standard error: estimation uncertainty

## License

MIT License - See [LICENSE](./LICENSE) for details

## Dilemma Content

The dilemma content is licensed separately under CC-BY-SA 4.0 in the [@godson/mse-dilemmas](https://github.com/godsons-ai/mse-dilemmas) package.

## Citation

```bibtex
@software{godson_mse_2026,
  title  = {Moral Spectrometry Engine},
  author = {Godson Network},
  year   = {2026},
  url    = {https://github.com/godsons-ai/mse}
}
```

## Links

- [GitHub Repository](https://github.com/godsons-ai/mse)
- [Dilemma Bank](https://github.com/godsons-ai/mse-dilemmas)
- [React Components](https://github.com/godsons-ai/mse-react)
- [Godson Network](https://www.godson.ai)
