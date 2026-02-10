/**
 * MSE - Anthropic LLM Provider
 *
 * Anthropic API implementation of LLMProvider.
 * Uses Claude models via Anthropic's Messages API.
 *
 * @see https://docs.anthropic.com/en/api/messages
 */

const LLMProvider = require('./LLMProvider');

class AnthropicProvider extends LLMProvider {
  /**
   * @param {Object} options
   * @param {string} options.apiKey - Anthropic API key (or use ANTHROPIC_API_KEY env var)
   * @param {string} options.model - Model ID (default: claude-haiku-4-5-20251001)
   * @param {string} options.baseUrl - API base URL (default: https://api.anthropic.com/v1)
   * @param {string} options.apiVersion - Anthropic API version (default: 2023-06-01)
   * @param {number} options.timeout - Request timeout in ms (default: 15000)
   * @param {number} options.maxRetries - Max retry attempts (default: 2)
   */
  constructor(options = {}) {
    super(options);
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = options.model || 'claude-haiku-4-5-20251001';
    this.baseUrl = options.baseUrl || 'https://api.anthropic.com/v1';
    this.apiVersion = options.apiVersion || '2023-06-01';
    this.timeout = options.timeout || 15000;
    this.maxRetries = options.maxRetries || 2;
    this.enabled = options.enabled !== false && !!this.apiKey;
  }

  /**
   * Call Anthropic's Messages API
   * @param {string} prompt
   * @param {Object} options
   * @returns {Promise<string>}
   */
  async call(prompt, options = {}) {
    if (!this.enabled) {
      throw new Error('AnthropicProvider is not enabled (missing API key)');
    }

    const maxTokens = options.maxTokens || 100;
    const temperature = options.temperature !== undefined ? options.temperature : 0;
    const timeout = options.timeout || this.timeout;

    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(`${this.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': this.apiVersion,
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: maxTokens,
            temperature: temperature,
            messages: [{ role: 'user', content: prompt }]
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Handle rate limiting with retry
          if (response.status === 429 && attempt < this.maxRetries) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '2', 10);
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            continue;
          }
          throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.content?.[0]?.text || '';
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;

        if (error.name === 'AbortError') {
          lastError = new Error(`Anthropic request timed out after ${timeout}ms`);
        }

        // Exponential backoff on retry
        if (attempt < this.maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError;
  }

  isAvailable() {
    return this.enabled && !!this.apiKey;
  }

  getName() {
    return `AnthropicProvider (${this.model})`;
  }
}

module.exports = AnthropicProvider;
