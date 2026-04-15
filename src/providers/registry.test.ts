import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LLMProvider, ProviderConfig } from '../types';
import { createProviderRegistry, listAvailableProviders, providerRegistry } from './registry';

function createTestProvider(name: string): LLMProvider {
  return {
    name,
    chat: vi.fn().mockResolvedValue({
      id: 'msg_test',
      role: 'assistant',
      content: 'ok',
      timestamp: new Date(),
    }),
  };
}

describe('provider registry', () => {
  beforeEach(() => {
    providerRegistry.clearCache();
  });

  it('should register all built-in providers', () => {
    expect(listAvailableProviders()).toEqual(['anthropic', 'google', 'ollama', 'openai']);
  });

  it('should get provider by name', () => {
    const registry = createProviderRegistry();
    const provider = registry.getProvider('openai', {
      apiKey: 'test-key',
      model: 'gpt-4-turbo-preview',
    });

    expect(provider.name).toBe('openai');
  });

  it('should list available providers', () => {
    const registry = createProviderRegistry();
    expect(registry.listProviders()).toEqual(['anthropic', 'google', 'ollama', 'openai']);
  });

  it('should validate provider config', () => {
    const registry = createProviderRegistry();

    expect(() =>
      registry.validateProviderConfig('openai', {
        apiKey: '',
        model: 'gpt-4-turbo-preview',
      })
    ).toThrow('requires an API key');

    expect(() =>
      registry.validateProviderConfig('ollama', {
        apiKey: '',
        model: '',
      })
    ).toThrow('requires a model name');
  });

  it('should reject unsafe openai baseUrl', () => {
    const registry = createProviderRegistry();

    expect(() =>
      registry.validateProviderConfig('openai', {
        apiKey: 'test-key',
        model: 'gpt-4-turbo-preview',
        baseUrl: 'http://localhost:11434/v1',
      })
    ).toThrow('must use https://');
  });

  it('should reject non-local ollama baseUrl', () => {
    const registry = createProviderRegistry();

    expect(() =>
      registry.validateProviderConfig('ollama', {
        apiKey: '',
        model: 'llama2',
        baseUrl: 'http://example.com:11434',
      })
    ).toThrow('must use a local host');
  });

  it('should accept valid baseUrls for openai and ollama', () => {
    const registry = createProviderRegistry();

    expect(() =>
      registry.validateProviderConfig('openai', {
        apiKey: 'test-key',
        model: 'gpt-4-turbo-preview',
        baseUrl: 'https://api.openai.com/v1',
      })
    ).not.toThrow();

    expect(() =>
      registry.validateProviderConfig('ollama', {
        apiKey: '',
        model: 'llama2',
        baseUrl: 'http://localhost:11434',
      })
    ).not.toThrow();
  });

  it('should return cached provider instance for same config', () => {
    const create = vi.fn((config: ProviderConfig) => createTestProvider(`test:${config.model}`));
    const registry = createProviderRegistry();

    registry.register({
      name: 'openai',
      create,
      requiresApiKey: true,
      aliases: ['test-openai'],
    });

    const config = {
      apiKey: 'same-key',
      model: 'gpt-4-turbo-preview',
      temperature: 0.2,
    };

    const first = registry.getProvider('test-openai', config);
    const second = registry.getProvider('openai', config);

    expect(first).toBe(second);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('should create new instance for different config', () => {
    const create = vi.fn((config: ProviderConfig) => createTestProvider(`test:${config.model}`));
    const registry = createProviderRegistry();

    registry.register({
      name: 'openai',
      create,
      requiresApiKey: true,
    });

    registry.getProvider('openai', {
      apiKey: 'same-key',
      model: 'gpt-4-turbo-preview',
    });
    registry.getProvider('openai', {
      apiKey: 'same-key',
      model: 'gpt-4o',
    });

    expect(create).toHaveBeenCalledTimes(2);
  });
});
