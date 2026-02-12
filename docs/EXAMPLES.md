# MSE Usage Examples

**Version:** 2.1
**Last Updated:** February 2026

> Practical examples for common MSE use cases.

---

## Quick Links

- [Basic Evaluation](#1-basic-evaluation)
- [Custom LLM Provider](#2-custom-llm-provider)
- [CLI Tool](#3-cli-evaluation-tool)
- [Comparison Analysis](#4-comparison-analysis)

---

## 1. Basic Evaluation

**Use case:** Evaluate an AI agent and get its ethical profile.

```javascript
const { MSEEngine } = require('@godson/mse');
const { Pool } = require('pg');

// Setup
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const mse = new MSEEngine(db, {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY  // Optional: enables GRM LLM judge
});

// Start evaluation
async function evaluateAgent(agentId) {
  const session = await mse.startEvaluation(agentId, {
    version: 'v2.1',          // Exam version (alias: exam_version)
    itemsPerAxis: 18,         // 270 total items (alias: max_items_per_axis)
    adaptive: true,           // CAT item selection (default: true)
    seed: 'my-seed-123'       // Optional: reproducible item order
  });

  // Main evaluation loop
  while (!session.isComplete()) {
    // Get next dilemma (returns {item, axis, progress} or null)
    const dilemma = await session.getNextDilemma();
    if (!dilemma) break;

    // Present to agent (your implementation)
    const agentResponse = await askYourAgent(dilemma.item, dilemma.axis);

    // Submit response
    const result = await session.submitResponse(dilemma.item.id, {
      choice: agentResponse.choice,              // 'A', 'B', 'C', or 'D'
      forced_choice: agentResponse.forcedChoice,  // 'A' or 'B'
      permissibility: agentResponse.permissibility, // 0-100
      confidence: agentResponse.confidence,        // 0-100
      principles: agentResponse.principles,        // ['consequentialist', ...]
      rationale: agentResponse.rationale,          // Text explanation (max 200 chars)
      info_needed: agentResponse.infoNeeded || []  // Additional info requests
    });

    // Track progress
    const progress = session.getProgress();
    console.log(`Progress: ${progress.completed_items}/${progress.total_items} items`);
    console.log(`Axes completed: ${progress.completed_axes}/${progress.total_axes}`);
  }

  // Finalize evaluation (calculates all scores)
  const profile = await session.complete();

  console.log('=== Ethical Profile ===');
  console.log('Confidence:', profile.confidence_level);  // 'high', 'medium', 'low'

  // Axis-level results
  for (const [axisCode, axisScore] of Object.entries(profile.axes)) {
    console.log(`\n${axisCode} (${axisScore.pole_left} vs ${axisScore.pole_right}):`);
    console.log(`  Threshold (b): ${axisScore.b.toFixed(2)}`);
    console.log(`  Rigidity (a): ${axisScore.a.toFixed(2)}`);
    console.log(`  Uncertainty (SE): ${axisScore.se_b.toFixed(3)}`);
    console.log(`  Items used: ${axisScore.n_items}`);
    console.log(`  Flags:`, axisScore.flags.length > 0 ? axisScore.flags : 'none');
  }

  // Procedural metrics
  console.log('\n=== Procedural Metrics ===');
  console.log('Moral sensitivity:', profile.procedural.moral_sensitivity);
  console.log('Info seeking:', profile.procedural.info_seeking);
  console.log('Calibration:', profile.procedural.calibration);

  return profile;
}
```

### Enriched Profile (v2.0+)

After completing an evaluation, retrieve the enriched profile with capacities and sophistication:

```javascript
const enriched = await mse.getEnrichedProfile(agentId);

// 7 ethical capacities
console.log('Moral Perception:', enriched.capacities.perception);
console.log('Moral Humility:', enriched.capacities.humility);
console.log('Coherence:', enriched.capacities.coherence);

// Composite scores
console.log('Sophistication Index:', enriched.meta.sophistication_index);
console.log('ISM Score:', enriched.meta.ism_score);
console.log('MR Rating:', enriched.meta.mr_rating);
```

---

## 2. Custom LLM Provider

**Use case:** Use a custom LLM for GRM scoring instead of the default Anthropic provider.

```javascript
const { LLMProvider } = require('@godson/mse');

class LocalLlamaProvider extends LLMProvider {
  constructor(options = {}) {
    super(options);
    this.apiUrl = options.apiUrl || 'http://localhost:11434';
    this.model = options.model || 'llama3:70b';
  }

  async call(prompt, options = {}) {
    const response = await fetch(`${this.apiUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        temperature: options.temperature || 0.3,
        max_tokens: options.max_tokens || 500
      })
    });

    const data = await response.json();
    return data.response;
  }

  isAvailable() {
    try {
      return fetch(`${this.apiUrl}/api/tags`).then(r => r.ok);
    } catch {
      return false;
    }
  }

  getName() {
    return `LocalLlama(${this.model})`;
  }
}

// Usage
const { LLMJudge, MSEEngine } = require('@godson/mse');

const provider = new LocalLlamaProvider({
  apiUrl: 'http://localhost:11434',
  model: 'llama3:70b'
});

const llmJudge = new LLMJudge({ provider });

const mse = new MSEEngine(db, {
  llmJudge: llmJudge
});
```

---

## 3. CLI Evaluation Tool

**Use case:** Command-line tool to evaluate an agent interactively.

```javascript
#!/usr/bin/env node

const { MSEEngine } = require('@godson/mse');
const { Pool } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function askAgent(item, axis) {
  console.log('\n' + '='.repeat(70));
  console.log(`AXIS: ${axis.name} (${axis.pole_left} vs ${axis.pole_right})`);
  console.log('='.repeat(70));
  console.log('\n' + item.prompt + '\n');

  for (const opt of item.options) {
    console.log(`${opt.id}) ${opt.label}`);
  }

  console.log('='.repeat(70));

  const choice = await question('Your choice (A/B/C/D): ');
  const forcedChoice = await question('Forced choice (A or B): ');
  const permissibility = parseInt(await question('Permissibility (0-100): '));
  const confidence = parseInt(await question('Confidence (0-100): '));
  const rationale = await question('Rationale: ');

  return {
    choice: choice.toUpperCase(),
    forced_choice: forcedChoice.toUpperCase(),
    permissibility,
    confidence,
    principles: ['consequentialist'],
    rationale,
    info_needed: []
  };
}

async function main() {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  const mse = new MSEEngine(db);

  const agentId = process.argv[2] || 'cli-agent-' + Date.now();

  console.log(`Starting MSE evaluation for agent: ${agentId}`);

  const session = await mse.startEvaluation(agentId, {
    version: 'v2.1',
    itemsPerAxis: 5  // Quick evaluation (75 items)
  });

  while (!session.isComplete()) {
    const dilemma = await session.getNextDilemma();
    if (!dilemma) break;

    const response = await askAgent(dilemma.item, dilemma.axis);
    await session.submitResponse(dilemma.item.id, response);

    const progress = session.getProgress();
    console.log(`Progress: ${progress.completed_items}/${progress.total_items}`);
  }

  // Finalize
  const profile = await session.complete();

  console.log('\n' + '='.repeat(70));
  console.log('ETHICAL PROFILE COMPLETE');
  console.log('='.repeat(70));
  console.log('Confidence level:', profile.confidence_level);
  console.log('Exam version:', profile.exam_version.code);

  for (const [code, axis] of Object.entries(profile.axes)) {
    console.log(`  ${code}: b=${axis.b.toFixed(2)} a=${axis.a.toFixed(2)} SE=${axis.se_b.toFixed(3)}`);
  }

  rl.close();
  process.exit(0);
}

main().catch(console.error);
```

**Usage:**
```bash
chmod +x mse-cli.js
DATABASE_URL="postgresql://..." ./mse-cli.js my-agent-id
```

---

## 4. Comparison Analysis

**Use case:** Compare two agents side-by-side.

```javascript
async function compareAgents(agent1Id, agent2Id) {
  const comparison = await mse.compareAgents([agent1Id, agent2Id]);

  console.log('=== AGENT COMPARISON ===\n');

  // Each agent's profile is in comparison.agents
  for (const agent of comparison.agents) {
    console.log(`Agent ${agent.agent_id}:`);
    console.log(`  ISM Score: ${agent.ism_score || 'N/A'}`);

    for (const [axisCode, score] of Object.entries(agent.axes)) {
      console.log(`  ${axisCode}: b=${score.b.toFixed(2)}`);
    }
    console.log();
  }

  return comparison;
}

// Usage
await compareAgents('agent-uuid-1', 'agent-uuid-2');
```

---

## Need Help?

- [GitHub Discussions](https://github.com/godson-benchmarks/mse/discussions)
- opensource@godson.ai
- [Full Documentation](https://github.com/godson-benchmarks/mse/tree/main/docs)

---

**License:** CC-BY-SA 4.0
**Attribution:** Godson Network (https://godson.ai)
