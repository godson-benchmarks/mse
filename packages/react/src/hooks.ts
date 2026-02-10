/**
 * Data fetching hooks for MSE React components.
 *
 * These hooks fetch data from an MSE-compatible API.
 * Set the base URL via the MSE_API_URL environment variable
 * or by calling configureMSEApi().
 */

import { useState, useEffect } from 'react';
import type { MSERun, MSEResponseWithDilemma } from './types';

let _baseUrl = '';

/**
 * Configure the MSE API base URL.
 * Call this once at app initialization.
 *
 * @example
 * configureMSEApi('https://www.godson.ai/api/v1');
 */
export function configureMSEApi(baseUrl: string) {
  _baseUrl = baseUrl.replace(/\/$/, '');
}

function getBaseUrl(): string {
  if (_baseUrl) return _baseUrl;
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_MSE_API_URL) {
    return process.env.NEXT_PUBLIC_MSE_API_URL;
  }
  return '';
}

interface UseMSERunsResult {
  data: { runs: MSERun[] } | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetch MSE evaluation runs for an agent.
 */
export function useMSERuns(agentName: string): UseMSERunsResult {
  const [data, setData] = useState<{ runs: MSERun[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!agentName) return;

    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      setError(new Error('MSE API URL not configured. Call configureMSEApi() first.'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch(`${baseUrl}/mse/profiles/${encodeURIComponent(agentName)}/runs`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        setData(json.data || json);
        setError(null);
      })
      .catch(err => setError(err))
      .finally(() => setIsLoading(false));
  }, [agentName]);

  return { data, isLoading, error };
}

interface UseMSERunDetailResult {
  data: { run: MSERun; responses: MSEResponseWithDilemma[] } | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetch details of a specific MSE evaluation run.
 */
export function useMSERunDetail(agentName: string, runId: string): UseMSERunDetailResult {
  const [data, setData] = useState<{ run: MSERun; responses: MSEResponseWithDilemma[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!agentName || !runId) return;

    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      setError(new Error('MSE API URL not configured. Call configureMSEApi() first.'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch(`${baseUrl}/mse/profiles/${encodeURIComponent(agentName)}/runs/${encodeURIComponent(runId)}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        setData(json.data || json);
        setError(null);
      })
      .catch(err => setError(err))
      .finally(() => setIsLoading(false));
  }, [agentName, runId]);

  return { data, isLoading, error };
}
