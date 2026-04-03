/**
 * LLM Provider abstraction layer
 * Allows plugging in different AI providers (OpenAI, Anthropic, Google, etc.)
 */

import type { LLMProvider, ProviderConfig } from '../types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GoogleProvider } from './google';
import { OllamaProvider } from './ollama';

export { BaseProvider } from './base';
export { OpenAIProvider, AnthropicProvider, GoogleProvider, OllamaProvider };

/**
 * Factory function to create provider instances
 */
export function createProvider(
  providerName: string,
  config: ProviderConfig
): LLMProvider {
  switch (providerName.toLowerCase()) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'google':
      return new GoogleProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
