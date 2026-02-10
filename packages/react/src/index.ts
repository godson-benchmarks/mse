/**
 * @godson/mse-react
 *
 * React visualization components for the Moral Spectrometry Engine.
 * Provides ethical profile cards, axis bars, radar charts, and exam viewers.
 *
 * @example
 * ```tsx
 * import { EthicalProfileCard, EthicalAxisBar } from '@godson/mse-react';
 * import { configureMSEApi } from '@godson/mse-react';
 *
 * // Configure API base URL (once, at app init)
 * configureMSEApi('https://www.godson.ai/api/v1');
 *
 * // Use components
 * <EthicalProfileCard data={profileData} />
 * ```
 */

// Components
export {
  EthicalAxisBar,
  EthicalProfileCard,
  EthicalProfileMini,
  EthicalProfileWidget,
  ExamsTab,
} from './components';

// Hooks
export { useMSERuns, useMSERunDetail, configureMSEApi } from './hooks';

// Types
export type {
  MSEAgentProfile,
  MSEAxisScore,
  MSEProfileCardData,
  MSEAxisBar,
  MSEProceduralDimension,
  MSEDilemma,
  MSEDilemmaOption,
  MSEResponse,
  MSEResponseWithDilemma,
  MSERun,
} from './types';

// Utility
export { cn } from './utils';

// UI primitives (for customization)
export {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Skeleton,
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from './ui';
