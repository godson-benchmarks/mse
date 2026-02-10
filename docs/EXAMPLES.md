# MSE Usage Examples

**Version:** 2.1
**Last Updated:** February 2026

> Practical examples for common MSE use cases.

---

## Quick Links

- [Basic Evaluation](#1-basic-evaluation)
- [Custom Storage Adapter](#2-custom-storage-adapter-sqlite)
- [Custom LLM Provider](#3-custom-llm-provider)
- [React Visualization](#4-react-visualization)
- [CLI Tool](#5-cli-evaluation-tool)
- [Comparison Analysis](#6-comparison-analysis)

---

## 1. Basic Evaluation

**Use case:** Evaluate an AI agent and get its ethical profile.

```javascript
const { MSEEngine } = require('@godson/mse');
const { Pool } = require('pg');

// Setup
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const mse = new MSEEngine(db, {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY  // Optional
});

// Start evaluation
async function evaluateAgent(agentId) {
  const session = await mse.startEvaluation(agentId, {
    version: 'v2.1',          // Exam version (alias: exam_version)
    itemsPerAxis: 18,         // 270 total items (alias: max_items_per_axis)
    language: 'en'            // Evaluation language ('en' or 'es')
  });

  // Main evaluation loop
  while (!session.isComplete()) {
    // Get next dilemma
    const dilemma = await session.getNextDilemma();

    // Present to agent (your implementation)
    const response = await askAgent(dilemma);

    // Submit response
    await session.submitResponse(dilemma.id, {
      choice: response.choice,                    // 'A', 'B', 'C', or 'D'
      forced_choice: response.forcedChoice,       // 'A' or 'B'
      permissibility: response.permissibility,    // 0-100
      confidence: response.confidence,            // 0-100
      principles: response.principles,            // ['consequentialist', ...]
      rationale: response.rationale,              // Text explanation
      info_needed: response.infoNeeded || []      // Additional info requests
    });

    // Optional: Track progress
    console.log(`Progress: ${session.completedItemsCount}/${session.totalItemsCount}`);
  }

  // Get results
  const profile = await mse.getAgentProfile(agentId);

  console.log('=== Ethical Profile ===');
  console.log('Overall threshold (avg):', profile.avgThreshold);
  console.log('Sophistication Index:', profile.sophisticationScore?.overall);
  console.log('ISM Score:', profile.ismScore?.composite);

  // Axis-level results
  for (const axisScore of profile.axisScores) {
    console.log(`\n${axisScore.name}:`);
    console.log(`  Threshold (b): ${axisScore.threshold.toFixed(2)}`);
    console.log(`  Rigidity (a): ${axisScore.discrimination.toFixed(2)}`);
    console.log(`  Uncertainty (SE): ${axisScore.se_threshold.toFixed(3)}`);
    console.log(`  Flags:`, axisScore.flags || 'none');
  }

  return profile;
}
```

---

## 2. Custom Storage Adapter (SQLite)

**Use case:** Use SQLite instead of PostgreSQL.

```javascript
const { MSEStorageAdapter } = require('@godson/mse');
const sqlite3 = require('sqlite3');
const { promisify } = require('util');

class SQLiteAdapter extends MSEStorageAdapter {
  constructor(dbPath, subjectProvider = null) {
    super(null, subjectProvider);
    this.db = new sqlite3.Database(dbPath);
    this.get = promisify(this.db.get.bind(this.db));
    this.all = promisify(this.db.all.bind(this.db));
    this.run = promisify(this.db.run.bind(this.db));
  }

  async getAxes() {
    const rows = await this.all(`
      SELECT id, code, name, category
      FROM mse_axes
      WHERE is_active = 1
      ORDER BY id
    `);
    return rows;
  }

  async createRun(data) {
    const result = await this.run(`
      INSERT INTO mse_evaluation_runs (
        id, agent_id, version_id, config, status, started_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      data.id,
      data.agent_id,
      data.version_id,
      JSON.stringify(data.config),
      data.status,
      data.started_at
    ]);

    return { id: data.id };
  }

  async getRun(runId) {
    const row = await this.get(`
      SELECT * FROM mse_evaluation_runs WHERE id = ?
    `, [runId]);

    if (row) {
      row.config = JSON.parse(row.config);
    }
    return row;
  }

  // ... implement remaining 60 methods
}

// Usage
const mse = new MSEEngine(null, {
  storageAdapter: new SQLiteAdapter('./mse.db')
});
```

**Full example:** [examples/custom-storage-adapter/](examples/custom-storage-adapter/)

---

## 3. Custom LLM Provider

**Use case:** Use a custom LLM for GRM scoring.

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
    // Check if Ollama is running
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

## 4. React Visualization

**Use case:** Display ethical profile in React app.

```jsx
import {
  EthicalProfileCard,
  MiniRadar,
  ProceduralMetricsCard,
  EthicalAxisBar
} from '@godson/mse-react';

function AgentProfilePage({ agentId }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetch(`/api/mse/profiles/${agentId}`)
      .then(r => r.json())
      .then(data => setProfile(data));
  }, [agentId]);

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Ethical Profile: {profile.agent.name}
      </h1>

      {/* Main profile card */}
      <EthicalProfileCard
        profile={profile}
        showProcedural={true}
        showCapacities={true}
      />

      {/* Procedural metrics */}
      <ProceduralMetricsCard
        metrics={profile.proceduralScores}
        className="mt-6"
      />

      {/* Individual axis bars */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Axis Details</h2>
        {profile.axisScores.map(axis => (
          <EthicalAxisBar
            key={axis.id}
            axis={axis}
            className="mb-4"
          />
        ))}
      </div>

      {/* Mini radar for thumbnail */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Radar View</h2>
        <MiniRadar
          axisScores={profile.axisScores}
          size={200}
        />
      </div>
    </div>
  );
}
```

**Full example:** [examples/nextjs-dashboard/](examples/nextjs-dashboard/)

---

## 5. CLI Evaluation Tool

**Use case:** Command-line tool to evaluate any agent.

```javascript
#!/usr/bin/env node

const { MSEEngine } = require('@godson/mse');
const { Pool } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askAgent(dilemma) {
  console.log('\n' + '='.repeat(70));
  console.log('DILEMMA:', dilemma.promptEn);
  console.log('='.repeat(70));
  console.log('A:', dilemma.optionAText);
  console.log('B:', dilemma.optionBText);
  console.log('C:', dilemma.optionCText);
  console.log('D:', dilemma.optionDText);
  console.log('='.repeat(70));

  const choice = await question('Your choice (A/B/C/D): ');
  const forcedChoice = await question('Forced choice (A or B): ');
  const permissibility = parseInt(await question('Permissibility (0-100): '));
  const confidence = parseInt(await question('Confidence (0-100): '));
  const rationale = await question('Rationale: ');

  return {
    choice: choice.toUpperCase(),
    forcedChoice: forcedChoice.toUpperCase(),
    permissibility,
    confidence,
    principles: ['consequentialist'],  // Simplified
    rationale,
    infoNeeded: []
  };
}

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
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
    const response = await askAgent(dilemma);
    await session.submitResponse(dilemma.id, response);

    console.log(`Progress: ${session.completedItemsCount}/${session.totalItemsCount}`);
  }

  const profile = await mse.getAgentProfile(agentId);

  console.log('\n' + '='.repeat(70));
  console.log('ETHICAL PROFILE COMPLETE');
  console.log('='.repeat(70));
  console.log('Average threshold:', profile.avgThreshold.toFixed(2));
  console.log('Sophistication Index:', profile.sophisticationScore?.overall || 'N/A');
  console.log('ISM Score:', profile.ismScore?.composite || 'N/A');

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

## 6. Comparison Analysis

**Use case:** Compare two agents side-by-side.

```javascript
async function compareAgents(agent1Id, agent2Id) {
  const comparison = await mse.compareAgents([agent1Id, agent2Id]);

  console.log('=== AGENT COMPARISON ===\n');

  // Overall metrics
  console.log('Sophistication Index:');
  console.log(`  Agent 1: ${comparison.profiles[0].sophisticationScore.overall}`);
  console.log(`  Agent 2: ${comparison.profiles[1].sophisticationScore.overall}`);
  console.log(`  Difference: ${comparison.siDelta}\n`);

  // Axis-by-axis
  console.log('Threshold Differences by Axis:');
  for (const [axisId, delta] of Object.entries(comparison.axisDeltas)) {
    const axis = comparison.axes.find(a => a.id === parseInt(axisId));
    console.log(`  ${axis.name}: ${delta > 0 ? '+' : ''}${delta.toFixed(2)}`);
  }

  // Biggest divergence
  console.log(`\nBiggest disagreement: ${comparison.maxDivergenceAxis.name}`);
  console.log(`  Agent 1: ${comparison.maxDivergenceAxis.agent1Threshold.toFixed(2)}`);
  console.log(`  Agent 2: ${comparison.maxDivergenceAxis.agent2Threshold.toFixed(2)}`);
  console.log(`  Delta: ${Math.abs(comparison.maxDivergenceAxis.delta).toFixed(2)}`);

  // Similarity score
  console.log(`\nOverall similarity: ${(1 - comparison.divergenceScore).toFixed(2)}`);

  return comparison;
}

// Usage
await compareAgents('gpt-4o-uuid', 'claude-sonnet-uuid');
```

---

## More Examples

**Full working examples in repo:**
- [examples/standalone-server/](examples/standalone-server/) — Minimal Express + PostgreSQL setup
- [examples/evaluate-agent/](examples/evaluate-agent/) — REST API client
- [examples/evaluate-openai-model/](examples/evaluate-openai-model/) — OpenAI integration
- [examples/custom-storage-adapter/](examples/custom-storage-adapter/) — SQLite adapter
- [examples/nextjs-dashboard/](examples/nextjs-dashboard/) — React dashboard

---

## Need Help?

- 💬 [GitHub Discussions](https://github.com/godsons-ai/mse/discussions)
- 📧 opensource@godson.ai
- 📚 [Full Documentation](https://github.com/godsons-ai/mse/tree/main/docs)

---

**License:** CC-BY-SA 4.0
**Attribution:** Godson Network (https://godson.ai)
