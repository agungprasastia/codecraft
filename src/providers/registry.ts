/**
 * Provider registry
 * Centralizes provider construction, validation, and instance caching.
 */

import type { LLMProvider, ProviderConfig } from '../types';
import {
  getDefaultModelForProvider,
  isSupportedProvider,
  listSupportedProviders,
  type SupportedProvider,
} from './models';
import { validateProviderBaseUrl } from './base-url';
import { AnthropicProvider } from './anthropic';
import { GoogleProvider } from './google';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';

export interface ProviderRegistration {
  name: SupportedProvider;
  create: (config: ProviderConfig) => LLMProvider;
  requiresApiKey: boolean;
  aliases?: string[];
}

const BUILT_IN_PROVIDERS: ProviderRegistration[] = [
  { name: 'openai', create: (config) => new OpenAIProvider(config), requiresApiKey: true },
  { name: 'anthropic', create: (config) => new AnthropicProvider(config), requiresApiKey: true },
  { name: 'google', create: (config) => new GoogleProvider(config), requiresApiKey: true },
  { name: 'ollama', create: (config) => new OllamaProvider(config), requiresApiKey: false },
];

function normalizeProviderName(providerName: string): string {
  return providerName.trim().toLowerCase();
}

function createCacheKey(providerName: string, config: ProviderConfig): string {
  return JSON.stringify({
    providerName,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });
}

export class ProviderRegistry {
  private registrations = new Map<SupportedProvider, ProviderRegistration>();
  private aliases = new Map<string, SupportedProvider>();
  private providerCache = new Map<string, LLMProvider>();

  constructor(registrations: ProviderRegistration[] = BUILT_IN_PROVIDERS) {
    for (const registration of registrations) {
      this.register(registration);
    }
  }

  register(registration: ProviderRegistration): void {
    this.registrations.set(registration.name, registration);
    this.aliases.set(registration.name, registration.name);

    for (const alias of registration.aliases ?? []) {
      this.aliases.set(normalizeProviderName(alias), registration.name);
    }
  }

  getProvider(providerName: string, config: ProviderConfig): LLMProvider {
    const registration = this.getRegistration(providerName);
    this.validateProviderConfig(registration.name, config);

    const cacheKey = createCacheKey(registration.name, config);
    const cachedProvider = this.providerCache.get(cacheKey);
    if (cachedProvider) {
      return cachedProvider;
    }

    const provider = registration.create(config);
    this.providerCache.set(cacheKey, provider);
    return provider;
  }

  listProviders(): SupportedProvider[] {
    return [...this.registrations.keys()].sort();
  }

  getDefaultModel(providerName: string): string {
    const registration = this.getRegistration(providerName);
    return getDefaultModelForProvider(registration.name);
  }

  requiresApiKey(providerName: string): boolean {
    return this.getRegistration(providerName).requiresApiKey;
  }

  validateProviderConfig(providerName: string, config: ProviderConfig): void {
    const registration = this.getRegistration(providerName);

    if (!config.model.trim()) {
      throw new Error(`Provider ${registration.name} requires a model name`);
    }

    if (registration.requiresApiKey && !config.apiKey.trim()) {
      throw new Error(`Provider ${registration.name} requires an API key`);
    }

    validateProviderBaseUrl(registration.name, config.baseUrl);
  }

  clearCache(): void {
    this.providerCache.clear();
  }

  private getRegistration(providerName: string): ProviderRegistration {
    const normalizedProvider = normalizeProviderName(providerName);
    const canonicalProvider = this.aliases.get(normalizedProvider);

    if (!canonicalProvider) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    return this.registrations.get(canonicalProvider)!;
  }
}

export const providerRegistry = new ProviderRegistry();

export function createProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry();
}

export function listAvailableProviders(): SupportedProvider[] {
  return providerRegistry.listProviders();
}

export function isKnownProvider(providerName: string): providerName is SupportedProvider {
  return isSupportedProvider(normalizeProviderName(providerName));
}

export function getDefaultProviderModel(providerName: string): string {
  return providerRegistry.getDefaultModel(providerName);
}

export function providerRequiresApiKey(providerName: string): boolean {
  return providerRegistry.requiresApiKey(providerName);
}

export function validateProviderConfig(providerName: string, config: ProviderConfig): void {
  providerRegistry.validateProviderConfig(providerName, config);
}

export function registerBuiltInProviders(): SupportedProvider[] {
  return listSupportedProviders();
}
