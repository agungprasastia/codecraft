import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODELS,
  MODEL_CONTEXT_LIMITS,
  getDefaultModelForProvider,
  getModelCatalogEntry,
  getModelContextWindow,
  getModelsForProvider,
  isSupportedProvider,
  listSupportedProviders,
} from './models';

describe('provider model catalog', () => {
  it('should list built-in providers', () => {
    expect(listSupportedProviders()).toEqual(['openai', 'anthropic', 'google', 'ollama']);
  });

  it('should list OpenAI models with context window sizes', () => {
    const models = getModelsForProvider('openai');
    expect(models.map((model) => model.modelId)).toEqual(
      expect.arrayContaining(['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'])
    );
    expect(models.every((model) => model.contextWindow > 0)).toBe(true);
  });

  it('should list Anthropic models with context window sizes', () => {
    const models = getModelsForProvider('anthropic');
    expect(models.map((model) => model.modelId)).toEqual(
      expect.arrayContaining(['claude-3-opus-20240229', 'claude-3-sonnet-20240229'])
    );
    expect(models.every((model) => model.contextWindow === 200000)).toBe(true);
  });

  it('should list Google models with context window sizes', () => {
    const models = getModelsForProvider('google');
    expect(models.map((model) => model.modelId)).toEqual(
      expect.arrayContaining(['gemini-pro', 'gemini-1.5-pro'])
    );
    expect(models.every((model) => model.contextWindow > 0)).toBe(true);
  });

  it('should expose default models per provider', () => {
    expect(DEFAULT_MODELS.openai).toBe('gpt-4-turbo-preview');
    expect(getDefaultModelForProvider('ollama')).toBe('llama2');
  });

  it('should match exact and prefix model lookups', () => {
    expect(getModelCatalogEntry('gpt-4-turbo')?.contextWindow).toBe(128000);
    expect(getModelContextWindow('gpt-4-turbo-2024-04-09')).toBe(128000);
  });

  it('should expose context limit lookup with default fallback', () => {
    expect(MODEL_CONTEXT_LIMITS['claude-3-opus-20240229']).toBe(200000);
    expect(getModelContextWindow('unknown-model')).toBe(MODEL_CONTEXT_LIMITS.default);
  });

  it('should validate supported providers', () => {
    expect(isSupportedProvider('openai')).toBe(true);
    expect(isSupportedProvider('bedrock')).toBe(false);
  });
});
