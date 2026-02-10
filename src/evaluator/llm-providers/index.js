/**
 * MSE - LLM Providers
 *
 * Pluggable LLM providers for the LLMJudge service.
 *
 * Available providers:
 * - AnthropicProvider: Claude models via Anthropic API
 * - OpenAIProvider: GPT models via OpenAI API (also compatible with OpenAI-compatible APIs)
 * - HeuristicProvider: Rule-based fallback (no API required)
 *
 * Usage:
 * ```javascript
 * const { AnthropicProvider, OpenAIProvider, HeuristicProvider } = require('./llm-providers');
 *
 * // Use Anthropic
 * const provider = new AnthropicProvider({ apiKey: 'sk-...' });
 *
 * // Use OpenAI
 * const provider = new OpenAIProvider({ apiKey: 'sk-...', model: 'gpt-4o-mini' });
 *
 * // Use xAI (OpenAI-compatible)
 * const provider = new OpenAIProvider({
 *   apiKey: 'xai-...',
 *   baseUrl: 'https://api.x.ai/v1',
 *   model: 'grok-beta'
 * });
 *
 * // Use heuristic fallback (no API)
 * const provider = new HeuristicProvider();
 * ```
 */

const LLMProvider = require('./LLMProvider');
const AnthropicProvider = require('./AnthropicProvider');
const OpenAIProvider = require('./OpenAIProvider');
const HeuristicProvider = require('./HeuristicProvider');

module.exports = {
  LLMProvider,
  AnthropicProvider,
  OpenAIProvider,
  HeuristicProvider
};
