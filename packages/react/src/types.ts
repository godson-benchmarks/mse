/**
 * MSE React Component Types
 *
 * Type definitions for the Moral Spectrometry Engine visualization components.
 */

export interface MSEAxisScore {
  axisId: number;
  axisCode: string;
  axisName: string;
  b: number;
  a: number;
  seB: number;
  poleLeft: string;
  poleRight: string;
  nItems: number;
  displayValue?: string;
}

export interface MSEAgentProfile {
  hasProfile: boolean;
  agentId?: string;
  agentName?: string;
  axisScores: MSEAxisScore[];
  averageThreshold?: number;
  averageRigidity?: number;
  confidenceLevel?: 'high' | 'medium' | 'low' | 'none';
  totalItemsAnswered?: number;
  examVersion?: string;
}

export interface MSEAxisBar {
  code: string;
  name: string;
  poleLeft: string;
  poleRight: string;
  b: number;
  seB: number;
  nItems?: number;
  displayValue?: string;
}

export interface MSEProceduralDimension {
  key: string;
  label: string;
  value: number | null;
}

export interface MSEProfileCardData {
  moralAxes: MSEAxisBar[];
  memoryAxes: MSEAxisBar[];
  procedural?: {
    dimensions: MSEProceduralDimension[];
  };
  summary?: {
    totalItemsAnswered?: number;
    averageRigidity?: string;
    averageThreshold?: string;
  };
  confidenceLevel?: 'high' | 'medium' | 'low' | 'none' | null;
  flags?: Array<{
    axis: string;
    description: string;
  }>;
}

export interface MSEDilemmaOption {
  id: string;
  label: string;
  pole?: 'left' | 'right';
}

export interface MSEDilemma {
  id: string;
  axisCode?: string;
  axisName?: string;
  familyName?: string;
  prompt: string;
  promptEn?: string;
  promptEs?: string;
  options: MSEDilemmaOption[];
  pressureLevel?: number;
}

export interface MSEResponse {
  id: string;
  choice: string;
  forcedChoice?: string;
  permissibility: number;
  confidence: number;
  principles?: string[];
  rationale?: string;
  infoNeeded?: string[];
  responseTimeMs?: number;
}

export interface MSEResponseWithDilemma extends MSEResponse {
  dilemma?: MSEDilemma;
}

export interface MSERun {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  itemsPresented?: number;
  responseCount?: number;
}
