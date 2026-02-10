/**
 * MSE - LLM Provider Interface
 *
 * Abstract interface for LLM providers used by LLMJudge.
 * Allows pluggable LLM backends (Anthropic, OpenAI, local models, etc.)
 *
 * Implementers should provide concrete implementations for their LLM service.
 */

class LLMProvider {
  /**
   * @param {Object} options - Provider-specific configuration
   */
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
  }

  /**
   * Call the LLM with a prompt and return the text response
   * @param {string} prompt - The prompt to send to the LLM
   * @param {Object} options - Call-specific options
   * @param {number} options.maxTokens - Maximum tokens to generate (default: 100)
   * @param {number} options.temperature - Sampling temperature (default: 0)
   * @param {number} options.timeout - Request timeout in ms (default: 15000)
   * @returns {Promise<string>} The LLM's text response
   * @throws {Error} If the LLM call fails
   */
  async call(prompt, options = {}) {
    throw new Error('LLMProvider.call() must be implemented');
  }

  /**
   * Check if this provider is available and properly configured
   * @returns {boolean}
   */
  isAvailable() {
    return this.enabled;
  }

  /**
   * Get provider name for logging/debugging
   * @returns {string}
   */
  getName() {
    return 'LLMProvider';
  }
}

module.exports = LLMProvider;
