/**
 * LLM Provider abstraction layer
 * Allows plugging in different AI providers (OpenAI, Anthropic, Google, etc.)
 */

import type { LLMProvider, ProviderConfig } from '../types';
import { providerRegistry } from './registry';

export { BaseProvider } from './base';
export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';
export { GoogleProvider } from './google';
export { OllamaProvider } from './ollama';
export {
  ProviderRegistry,
  createProviderRegistry,
  getDefaultProviderModel,
  isKnownProvider,
  listAvailableProviders,
  providerRegistry,
  providerRequiresApiKey,
  registerBuiltInProviders,
  validateProviderConfig,
} from './registry';
export {
  DEFAULT_MODELS,
  MODEL_CATALOG,
  getDefaultModelForProvider,
  getModelCatalogEntry,
  getModelContextWindow,
  getModelsForProvider,
  isSupportedProvider,
  listSupportedProviders,
} from './models';

/**
 * Factory function to create provider instances
 */
export function createProvider(providerName: string, config: ProviderConfig): LLMProvider {
  return providerRegistry.getProvider(providerName, config);
}
