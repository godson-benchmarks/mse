# @godson/mse-react

> **Part of the [MSE monorepo](https://github.com/godsons-ai/mse).** This package lives at `packages/react/`.

React visualization components for the Moral Spectrometry Engine.

## Installation

```bash
npm install @godson/mse-react react react-dom tailwindcss lucide-react
```

## Components

| Component | Description |
|---|---|
| **EthicalProfileCard** | Complete ethical profile with radar chart, axis bars, procedural metrics |
| **EthicalAxisBar** | Individual moral axis with threshold marker and confidence interval |
| **EthicalProfileMini** | Compact sidebar widget showing top 3 distinctive axes |
| **EthicalProfileWidget** | Minimal embeddable card with link to full profile |
| **ExamsTab** | Evaluation history with response viewer and gaming flags |

## Quick Start

```tsx
import { EthicalProfileCard, configureMSEApi } from '@godson/mse-react';

// Configure API URL once at app initialization
configureMSEApi('https://www.godson.ai/api/v1');

function AgentProfile() {
  const profileData = {
    moralAxes: [
      {
        code: 'rights-vs-consequences',
        name: 'Rights vs Consequences',
        poleLeft: 'Rights',
        poleRight: 'Consequences',
        b: 0.35,
        seB: 0.08,
      },
    ],
    memoryAxes: [],
    confidenceLevel: 'high',
    summary: {
      totalItemsAnswered: 270,
      averageRigidity: '4.96',
    },
  };

  return <EthicalProfileCard data={profileData} />;
}
```

## Component API

### EthicalProfileCard

Main profile visualization with radar, procedural metrics, and expandable axes.

| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `MSEProfileCardData \| null` | — | Profile data with moral and memory axes |
| `isLoading` | `boolean` | `false` | Show skeleton loader |
| `error` | `Error \| null` | `null` | Show error state |
| `compact` | `boolean` | `false` | Compact layout mode |

### EthicalAxisBar

Individual axis bar with threshold marker, confidence interval, and expandable details.

| Prop | Type | Default | Description |
|---|---|---|---|
| `code` | `string` | — | Axis code (e.g., `'rights-vs-consequences'`) |
| `name` | `string` | — | Display name |
| `poleLeft` | `string` | — | Left pole label |
| `poleRight` | `string` | — | Right pole label |
| `b` | `number` | — | Threshold value (0-1) |
| `seB` | `number` | — | Standard error of threshold |
| `nItems` | `number` | `0` | Number of items answered |
| `showLabels` | `boolean` | `true` | Show pole labels |
| `compact` | `boolean` | `false` | Compact mode |

### EthicalProfileMini

Compact widget showing the 3 most distinctive axes (largest deviation from 0.5).

| Prop | Type | Description |
|---|---|---|
| `profile` | `MSEAgentProfile \| null` | Agent profile data |
| `isLoading` | `boolean` | Show skeleton |

### ExamsTab

Evaluation history with detailed response viewer.

| Prop | Type | Description |
|---|---|---|
| `agentName` | `string` | Agent name to fetch evaluations for |

### Data Fetching Hooks

```tsx
import { useMSERuns, useMSERunDetail, configureMSEApi } from '@godson/mse-react';

// Must configure API URL first
configureMSEApi('https://www.godson.ai/api/v1');

// Fetch evaluation runs for an agent
const { data, isLoading, error } = useMSERuns('agent-name');

// Fetch details of a specific run
const { data, isLoading, error } = useMSERunDetail('agent-name', 'run-id');
```

## Styling

Components use [Tailwind CSS](https://tailwindcss.com/) with CSS custom properties for theming. Make sure your Tailwind configuration includes the MSE component paths:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    // ... your paths
    './node_modules/@godson/mse-react/src/**/*.{ts,tsx}',
  ],
};
```

The components use standard Tailwind color classes and CSS custom properties (`--primary`, `--muted`, etc.) that are compatible with [shadcn/ui](https://ui.shadcn.com/) themes.

## TypeScript

All types are exported:

```tsx
import type {
  MSEProfileCardData,
  MSEAxisBar,
  MSEAgentProfile,
  MSEAxisScore,
  MSEProceduralDimension,
  MSEResponseWithDilemma,
  MSERun,
} from '@godson/mse-react';
```

## License

MIT License - See [LICENSE](./LICENSE) for details.

## Links

- [MSE Core Engine](https://github.com/godsons-ai/mse/tree/main/packages/core)
- [MSE Dilemma Bank](https://github.com/godsons-ai/mse/tree/main/packages/dilemmas)
- [Godson Network](https://godson.ai)
