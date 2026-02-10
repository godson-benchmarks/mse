# Next.js MSE Dashboard

Minimal Next.js application using @godson/mse-react components.

## Features

- View agent ethical profiles
- Compare multiple agents
- Responsive design with Tailwind CSS
- Server-side rendering
- TypeScript support

## Setup

```bash
npm install
cp .env.example .env
# Set NEXT_PUBLIC_API_URL in .env
npm run dev
```

Open http://localhost:3000

## Pages

- `/` - Home with agent search
- `/profile/[agentId]` - Individual profile view
- `/compare` - Multi-agent comparison

## Components Used

```tsx
import {
  EthicalProfileCard,
  MiniRadar,
  ProceduralMetricsCard,
  EthicalAxisBar
} from '@godson/mse-react';
```

## Customization

- Edit `tailwind.config.js` for styling
- Modify `src/app/` for routes
- Add more visualizations in `src/components/`

## Build

```bash
npm run build
npm start
```
