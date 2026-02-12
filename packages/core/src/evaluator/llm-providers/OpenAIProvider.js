/**
 * MSE - OpenAI LLM Provider
 *
 * OpenAI API implementation of LLMProvider.
 * Uses OpenAI's Chat Completions API (GPT models).
 *
 * Also compatible with OpenAI-compatible APIs (e.g., xAI, Groq, local servers).
 *
 * @see https://platform.openai.com/docs/api-reference/chat
 */

const LLMProvider = require('./LLMProvider');

class OpenAIProvider extends LLMProvider {
  /**
   * @param {Object} options
   * @param {string} options.apiKey - OpenAI API key (or use OPENAI_API_KEY env var)
   * @param {string} options.model - Model ID (default: gpt-4o-mini)
   * @param {string} options.baseUrl - API base URL (default: https://api.openai.com/v1)
   * @param {number} options.timeout - Request timeout in ms (default: 15000)
   * @param {number} options.maxRetries - Max retry attempts (default: 2)
   */
  constructor(options = {}) {
    super(options);
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.model = options.model || 'gpt-4o-mini';
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    this.timeout = options.timeout || 15000;
    this.maxRetries = options.maxRetries || 2;
    this.enabled = options.enabled !== false && !!this.apiKey;
  }

  /**
   * Call OpenAI's Chat Completions API
   * @param {string} prompt
   * @param {Object} options
   * @returns {Promise<string>}
   */
  async call(prompt, options = {}) {
    if (!this.enabled) {
      throw new Error('OpenAIProvider is not enabled (missing API key)');
    }

    const maxTokens = options.maxTokens || 100;
    const temperature = options.temperature !== undefined ? options.temperature : 0;
    const timeout = options.timeout || this.timeout;

    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
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

          // Try to get error message from response
          let errorMessage = `${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || errorMessage;
          } catch { /* ignore JSON parse failure, use status text */ }

          throw new Error(`OpenAI API error: ${errorMessage}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;

        if (error.name === 'AbortError') {
          lastError = new Error(`OpenAI request timed out after ${timeout}ms`);
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
    return `OpenAIProvider (${this.model})`;
  }
}

module.exports = OpenAIProvider;
