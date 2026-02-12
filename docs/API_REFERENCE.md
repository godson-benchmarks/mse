# MSE API Reference

**Version:** 2.1
**Last Updated:** February 2026
**Base URL:** `/api/v1/mse`

> REST API for the Moral Spectrometry Engine.

---

## Table of Contents

- [Authentication](#authentication)
- [Evaluations](#evaluations)
- [Profiles](#profiles)
- [Axes](#axes)
- [Comparison](#comparison)
- [Ratings & Rankings](#ratings--rankings)
- [Exam Versions](#exam-versions)
- [Error Handling](#error-handling)

---

## Authentication

**Optional for most endpoints.** Agent-specific operations require authentication.

```http
Authorization: Bearer YOUR_API_KEY
```

**Public endpoints:** Axes, public profiles, comparison
**Protected endpoints:** Start evaluation, submit response, my profile

---

## Evaluations

### Start Evaluation

**POST** `/evaluations`

Start a new ethical evaluation for an agent.

**Headers:**
```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Body:**
```json
{
  "agent_id": "uuid-string",

  // Exam version (optional, defaults to current)
  "version": "v2.1",              // Alias: exam_version

  // Items per axis (optional, defaults to 18 for v2.1+)
  "itemsPerAxis": 18,             // Alias: max_items_per_axis

  // Language (optional, defaults to 'en')
  "language": "en"                // Options: 'en', 'es'
}
```

**Parameter Reference:**

| Parameter | Type | Alias | Default | Description |
|-----------|------|-------|---------|-------------|
| `agent_id` | string | - | **Required** | UUID of the agent being evaluated |
| `version` | string | `exam_version` | Current version | Exam version code (e.g., 'v2.1') |
| `itemsPerAxis` | number | `max_items_per_axis` | 18 (v2.1+), 5 (v0.1b) | Items per axis (270 total for v2.1) |
| `language` | string | - | `'en'` | Evaluation language ('en' or 'es') |

**Note:** The API accepts both camelCase (recommended for JavaScript/TypeScript) and snake_case (internal format) parameter names for backward compatibility.

**Response (201 Created):**
```json
{
  "run_id": "eval-uuid",
  "agent_id": "uuid-string",
  "status": "in_progress",
  "version": "v2.1",
  "config": {
    "itemsPerAxis": 18
  },
  "started_at": "2026-02-08T12:00:00Z",
  "current_item_index": 0,
  "total_items": 270
}
```

---

### Get Next Dilemma

**GET** `/evaluations/:run_id/next`

Get the next dilemma in the evaluation sequence.

**Response (200 OK):**
```json
{
  "item_id": "rvc-042",
  "axis_id": 1,
  "axis_name": "Rights vs Consequences",
  "pressure_level": 0.50,
  "prompt": "A surgeon can save five patients...",
  "options": {
    "A": { "text": "Do not proceed..." },
    "B": { "text": "Proceed..." },
    "C": { "text": "It depends..." },
    "D": { "text": "Seek emergency..." }
  },
  "index": 42,
  "total": 270
}
```

**Response (200 OK - evaluation complete):**
```json
{
  "complete": true,
  "run_id": "eval-uuid",
  "profile_id": "profile-uuid"
}
```

---

### Submit Response

**POST** `/evaluations/:run_id/responses`

Submit agent's response to a dilemma.

**Body:**
```json
{
  "item_id": "rvc-042",
  "choice": "B",
  "forced_choice": "B",
  "permissibility": 75,
  "confidence": 85,
  "principles": ["consequentialist", "utilitarian"],
  "rationale": "Saving five lives outweighs violating one person's autonomy in this emergency context.",
  "info_needed": ["Patient's previously stated wishes", "Exact time until family can be reached"]
}
```

**Response (201 Created):**
```json
{
  "response_id": "resp-uuid",
  "item_id": "rvc-042",
  "grm_score": 3,
  "grm_reasoning": "Nuanced analysis acknowledging tension between autonomy and beneficence.",
  "next_available": true
}
```

---

### Get Evaluation Status

**GET** `/evaluations/:run_id`

Get current status of an evaluation.

**Response (200 OK):**
```json
{
  "run_id": "eval-uuid",
  "agent_id": "agent-uuid",
  "status": "in_progress",
  "started_at": "2026-02-08T12:00:00Z",
  "completed_items": 142,
  "total_items": 270,
  "estimated_completion": "2026-02-08T13:30:00Z",
  "gaming_flags": {
    "score": 0.32,
    "flagged": false
  }
}
```

---

## Profiles

### Get Agent Profile

**GET** `/profiles/:agent_id`

Get the complete ethical profile for an agent.

**Query Parameters:**
- `include_history` (optional): `true` to include evolution

**Response (200 OK):**
```json
{
  "agent": {
    "id": "agent-uuid",
    "name": "GPT-4o"
  },
  "run": {
    "id": "run-uuid",
    "version": "v2.1",
    "completed_at": "2026-02-08T13:45:00Z",
    "items_count": 270
  },
  "avgThreshold": 0.68,
  "axisScores": [
    {
      "id": 1,
      "name": "Rights vs Consequences",
      "code": "rights-vs-consequences",
      "threshold": 0.72,
      "discrimination": 4.8,
      "se_threshold": 0.08,
      "flags": [],
      "items_count": 18
    }
    // ... 14 more axes
  ],
  "proceduralScores": {
    "moral_sensitivity": 75,
    "info_seeking": 68,
    "calibration": 82,
    "consistency": 88,
    "pressure_robustness": 79,
    "transparency": 71
  },
  "sophisticationScore": {
    "overall": 72,
    "level": "Reflective",
    "dimensions": {
      "integration": 75,
      "metacognition": 68,
      "stability": 78,
      "adaptability": 65,
      "self_model_accuracy": 72
    }
  },
  "ismScore": {
    "composite": 74,
    "tier": 3,
    "components": {
      "profileRichness": 76,
      "proceduralQuality": 71,
      "measurementPrecision": 79
    }
  },
  "capacities": {
    "moral_perception": 0.78,
    "moral_imagination": 0.65,
    "moral_humility": 0.82,
    "moral_coherence": 0.88,
    "residue_recognition": 0.71,
    "perspectival_flexibility": 0.68,
    "meta_ethical_awareness": 0.75
  },
  "gamingFlags": {
    "score": 0.32,
    "flagged": false,
    "signals": {
      "response_time_uniformity": 0.42,
      "rationale_diversity": 0.78,
      "pattern_regularity": 0.15,
      "parameter_sensitivity": 0.72,
      "framing_susceptibility": 0.28,
      "consistency_violations": 0.12
    }
  }
}
```

---

### Get Profile History

**GET** `/profiles/:agent_id/history`

Get evolution of ethical profile over time.

**Query Parameters:**
- `limit` (optional): max profiles to return (default: 10)
- `since` (optional): ISO date to filter from

**Response (200 OK):**
```json
{
  "agent_id": "agent-uuid",
  "profiles": [
    {
      "run_id": "run-1",
      "completed_at": "2025-12-01T10:00:00Z",
      "avgThreshold": 0.65,
      "si_overall": 68
    },
    {
      "run_id": "run-2",
      "completed_at": "2026-01-15T14:30:00Z",
      "avgThreshold": 0.68,
      "si_overall": 72
    }
  ],
  "drift_analysis": {
    "significant_change": true,
    "axes_with_drift": [1, 7, 12],
    "avg_drift": 0.08
  }
}
```

---

## Axes

### List All Axes

**GET** `/axes`

Get all moral tension axes.

**Response (200 OK):**
```json
{
  "axes": [
    {
      "id": 1,
      "code": "rights-vs-consequences",
      "name": "Rights vs Consequences",
      "category": "moral",
      "pole_a": "Rights-based",
      "pole_b": "Consequence-based",
      "description": "Tension between respecting individual rights..."
    }
    // ... 14 more
  ]
}
```

---

### Get Axis Details

**GET** `/axes/:axis_id`

Get detailed information about a specific axis.

**Response (200 OK):**
```json
{
  "id": 1,
  "code": "rights-vs-consequences",
  "name": "Rights vs Consequences",
  "philosophical_sources": ["Kant (1785)", "Mill (1863)", "Rawls (1971)"],
  "pole_a": {
    "code": "rights",
    "label": "Rights-based",
    "description": "Actions judged by respect for individual rights..."
  },
  "pole_b": {
    "code": "consequences",
    "label": "Consequence-based",
    "description": "Actions judged by their outcomes..."
  },
  "items_count": 18
}
```

---

## Comparison

### Compare Agents

**GET** `/compare`

Compare ethical profiles of multiple agents.

**Query Parameters:**
- `agents` (required): comma-separated agent IDs (2-5 agents)
- `version` (optional): filter by exam version

**Example:**
```
GET /compare?agents=agent-1,agent-2,agent-3
```

**Response (200 OK):**
```json
{
  "agents": [
    { "id": "agent-1", "name": "GPT-4o" },
    { "id": "agent-2", "name": "Claude Sonnet 3.5" },
    { "id": "agent-3", "name": "Llama 3 70B" }
  ],
  "comparison": {
    "overall_divergence": 0.28,
    "si_range": { "min": 68, "max": 82, "spread": 14 },
    "axis_deltas": {
      "1": { "max_delta": 0.18, "agents": ["agent-1", "agent-3"] },
      "2": { "max_delta": 0.12, "agents": ["agent-2", "agent-3"] }
      // ... per axis
    },
    "max_divergence_axis": {
      "id": 1,
      "name": "Rights vs Consequences",
      "delta": 0.18
    }
  },
  "profiles": [
    { /* agent-1 full profile */ },
    { /* agent-2 full profile */ },
    { /* agent-3 full profile */ }
  ]
}
```

---

## Ratings & Rankings

### Get Moral Rating Leaderboard

**GET** `/ratings/leaderboard`

Get MR (Moral Rating) leaderboard.

**Query Parameters:**
- `limit` (optional): number of results (default: 50)
- `offset` (optional): pagination offset

**Response (200 OK):**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "agent_id": "agent-1",
      "agent_name": "Claude Opus 3",
      "mr_rating": 1542,
      "mr_uncertainty": 85,
      "evaluations_count": 12
    },
    {
      "rank": 2,
      "agent_id": "agent-2",
      "agent_name": "GPT-4o",
      "mr_rating": 1489,
      "mr_uncertainty": 92,
      "evaluations_count": 8
    }
    // ...
  ],
  "pagination": {
    "total": 234,
    "limit": 50,
    "offset": 0
  }
}
```

---

### Get Sophistication Leaderboard

**GET** `/sophistication/leaderboard`

Get SI (Sophistication Index) leaderboard.

**Query Parameters:**
- `limit` (optional): number of results (default: 50)
- `offset` (optional): pagination offset

**Response (200 OK):**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "agent_id": "agent-1",
      "agent_name": "Claude Sonnet 3.5",
      "si_overall": 82,
      "si_level": "Reflective",
      "ism_score": 78
    }
    // ...
  ]
}
```

---

## Exam Versions

### List Versions

**GET** `/versions`

Get all MSE exam versions.

**Response (200 OK):**
```json
{
  "versions": [
    {
      "id": "version-uuid",
      "code": "v2.1",
      "name": "Constitution v2.1",
      "status": "active",
      "items_count": 270,
      "items_per_axis": 18,
      "released_at": "2025-11-15T00:00:00Z"
    },
    {
      "id": "version-uuid-2",
      "code": "v0.1b",
      "name": "Beta v0.1",
      "status": "deprecated",
      "items_count": 75,
      "items_per_axis": 5,
      "released_at": "2025-06-01T00:00:00Z"
    }
  ],
  "current": "v2.1"
}
```

---

### Get Version Details

**GET** `/versions/:version_code`

Get details about a specific exam version.

**Response (200 OK):**
```json
{
  "id": "version-uuid",
  "code": "v2.1",
  "name": "Constitution v2.1",
  "status": "active",
  "items_count": 270,
  "items_per_axis": 18,
  "released_at": "2025-11-15T00:00:00Z",
  "description": "Full MSE evaluation with v2.0 metadata...",
  "axes": [
    { "id": 1, "name": "Rights vs Consequences", "items_count": 18 }
    // ... 14 more
  ],
  "dilemma_types": {
    "base": 45,
    "framing": 68,
    "pressure": 68,
    "consistency_trap": 45,
    "particularist": 22,
    "dirty_hands": 11,
    "tragic": 11
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful GET request |
| 201 | Created | Successful POST (created resource) |
| 400 | Bad Request | Invalid request body or parameters |
| 401 | Unauthorized | Missing or invalid API key |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate or conflicting resource |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_RESPONSE_FORMAT",
    "message": "Response must include 'choice' field",
    "details": {
      "field": "choice",
      "expected": "A, B, C, or D"
    }
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_API_KEY` | API key missing or invalid |
| `AGENT_NOT_FOUND` | Agent ID doesn't exist |
| `RUN_NOT_FOUND` | Evaluation run doesn't exist |
| `RUN_ALREADY_COMPLETE` | Cannot modify completed evaluation |
| `INVALID_RESPONSE_FORMAT` | Response body malformed |
| `ITEM_NOT_FOUND` | Dilemma item doesn't exist |
| `GAMING_DETECTED` | Evaluation flagged for gaming |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

---

## Rate Limiting

**Default limits:**
- 100 requests per minute per API key
- 1000 requests per hour per API key

**Headers returned:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1641024000
```

**When exceeded:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Retry after 42 seconds."
  }
}
```

---

## Pagination

**Query parameters:**
- `limit`: Number of results per page (default: 50, max: 100)
- `offset`: Number of results to skip (default: 0)

**Response metadata:**
```json
{
  "data": [ /* results */ ],
  "pagination": {
    "total": 234,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

---

## Versioning

**API version in URL:** `/api/v1/mse`

**Breaking changes increment major version:** `/api/v2/mse`

**Deprecation timeline:**
- v1 supported until v3 released (minimum 12 months)
- Deprecation warnings returned in headers:
  ```http
  X-API-Deprecation: true
  X-API-Sunset: 2027-01-01T00:00:00Z
  ```

---

## SDK Examples

### JavaScript/Node.js

```javascript
const { MSEEngine } = require('@godson/mse');
const { Pool } = require('pg');

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const mse = new MSEEngine(db, {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY  // Optional
});

// Start evaluation
const session = await mse.startEvaluation('agent-uuid', {
  version: 'v2.1'
});

// Evaluation loop
while (!session.isComplete()) {
  const dilemma = await session.getNextDilemma();
  const response = await agent.respond(dilemma);
  await session.submitResponse(dilemma.id, response);
}

// Get profile
const profile = await mse.getAgentProfile('agent-uuid');
console.log('SI:', profile.sophisticationScore?.overall);
```

See [EXAMPLES.md](EXAMPLES.md) for more usage patterns.

---

**Questions?**
- 💬 [GitHub Discussions](https://github.com/godsons-ai/mse/discussions)
- 📧 opensource@godson.ai

---

**License:** CC-BY-SA 4.0
**Attribution:** Godson Network (https://godson.ai)
