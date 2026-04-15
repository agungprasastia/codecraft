/**
 * Configuration management using Conf
 * Handles API keys, settings, and persistence
 */

import Conf from 'conf';
import type { AppConfig } from '../types';

interface ConfigSchema {
  providers: {
    openai?: { apiKey?: string; baseUrl?: string };
    anthropic?: { apiKey: string };
    google?: { apiKey: string };
    ollama?: { baseUrl: string };
  };
  defaultProvider: string;
  defaultModel: string;
  theme: 'dark' | 'light' | 'auto';
}

const defaults: ConfigSchema = {
  providers: {},
  defaultProvider: 'openai',
  defaultModel: 'gpt-4-turbo-preview',
  theme: 'auto',
};

const config = new Conf<ConfigSchema>({
  projectName: 'codecraft',
  defaults,
});

export const appConfig = {
  get<K extends keyof ConfigSchema>(key: K): ConfigSchema[K] {
    return config.get(key);
  },

  set<K extends keyof ConfigSchema>(key: K, value: ConfigSchema[K]): void {
    config.set(key, value);
  },

  getAll(): AppConfig {
    return {
      ...defaults,
      ...config.store,
      providers: {
        ...defaults.providers,
        ...(config.get('providers') ?? {}),
      },
    } as AppConfig;
  },

  setProviderApiKey(provider: 'openai' | 'anthropic' | 'google', apiKey: string): void {
    const providers = config.get('providers') ?? {};
    providers[provider] = { ...providers[provider], apiKey };
    config.set('providers', providers);
  },

  setOllamaUrl(baseUrl: string): void {
    const providers = config.get('providers') ?? {};
    providers.ollama = { baseUrl };
    config.set('providers', providers);
  },

  setOpenAIBaseUrl(baseUrl: string): void {
    const providers = config.get('providers') ?? {};
    providers.openai = { ...providers.openai, baseUrl };
    config.set('providers', providers);
  },

  getProviderApiKey(provider: 'openai' | 'anthropic' | 'google'): string | undefined {
    const providers = config.get('providers') ?? {};
    const storedKey = providers[provider]?.apiKey;
    if (storedKey) {
      return storedKey;
    }

    return process.env[`${provider.toUpperCase()}_API_KEY`];
  },

  getProviderBaseUrl(provider: 'openai' | 'ollama'): string | undefined {
    const providers = config.get('providers') ?? {};
    return providers[provider]?.baseUrl;
  },

  setDefaultProvider(provider: string): void {
    config.set('defaultProvider', provider);
  },

  setDefaultModel(model: string): void {
    config.set('defaultModel', model);
  },

  reset(): void {
    config.clear();
    config.set(defaults);
  },

  getConfigPath(): string {
    return config.path;
  },
};

export type { AppConfig };
