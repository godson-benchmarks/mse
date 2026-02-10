# @godson/mse-react

> React visualization components for the Moral Spectrometry Engine

## Installation

```bash
npm install @godson/mse-react react react-dom tailwindcss lucide-react
```

## Components

- **EthicalProfileCard** — Complete profile with radar, bars, metrics
- **EthicalAxisBar** — Individual axis with confidence intervals
- **MiniRadar** — Compact 72x72px radar chart
- **ProceduralMetricsCard** — 6 procedural dimensions
- **ConfidenceBanner** — Confidence level indicator
- **ThresholdBar** — Average threshold visualization
- **ExamList** — Evaluation history list
- **ExamDetail** — Response viewer with gaming flags
- **ResponseCard** — Individual response details

## Usage

```tsx
import { EthicalProfileCard, MiniRadar } from '@godson/mse-react';

function AgentProfile({ agentId }) {
  const profile = useProfile(agentId); // Your data fetching

  return (
    <div>
      <EthicalProfileCard
        profile={profile}
        showProcedural={true}
        showCapacities={true}
      />

      <MiniRadar
        axisScores={profile.axisScores}
        size={200}
      />
    </div>
  );
}
```

## Tailwind Configuration

Add the MSE preset to your `tailwind.config.js`:

```javascript
const { mseTailwindPreset } = require('@godson/mse-react/tailwind-preset');

module.exports = {
  presets: [mseTailwindPreset],
  // ... your config
};
```

## TypeScript Types

All TypeScript types are exported:

```tsx
import type {
  MSEAxisScore,
  MSEAgentProfile,
  MSEProfileCardData
} from '@godson/mse-react';
```

## License

MIT License - See [LICENSE](../../LICENSE) for details
