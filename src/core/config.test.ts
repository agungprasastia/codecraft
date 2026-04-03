/**
 * Config Tests
 * Tests for configuration get/set, env var fallback, and provider keys
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appConfig } from './config';

describe('appConfig', () => {
  // Store original env vars
  const originalEnv = { ...process.env };

  beforeEach(() => {
    appConfig.reset();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    appConfig.reset();
    process.env = { ...originalEnv };
  });

  describe('get/set values', () => {
    it('should get default values', () => {
      const defaultProvider = appConfig.get('defaultProvider');
      expect(defaultProvider).toBeDefined();
      expect(typeof defaultProvider).toBe('string');
    });

    it('should set and retrieve values', () => {
      const originalModel = appConfig.get('defaultModel');

      appConfig.set('defaultModel', 'test-model');
      expect(appConfig.get('defaultModel')).toBe('test-model');

      // Restore
      appConfig.set('defaultModel', originalModel);
    });

    it('should get all config values', () => {
      const all = appConfig.getAll();

      expect(all).toHaveProperty('providers');
      expect(all).toHaveProperty('defaultProvider');
      expect(all).toHaveProperty('defaultModel');
      expect(all).toHaveProperty('theme');
    });
  });

  describe('provider API key retrieval', () => {
    it('should return env var for provider API key when no stored config exists', () => {
      process.env.OPENAI_API_KEY = 'env-test-key';

      const key = appConfig.getProviderApiKey('openai');
      expect(key).toBe('env-test-key');
    });

    it('should return stored config when env var not set', () => {
      delete process.env.OPENAI_API_KEY;
      appConfig.setProviderApiKey('openai', 'stored-test-key');

      const key = appConfig.getProviderApiKey('openai');
      expect(key).toBe('stored-test-key');
    });

    it('should prioritize stored config over env var', () => {
      process.env.ANTHROPIC_API_KEY = 'env-key';
      appConfig.setProviderApiKey('anthropic', 'stored-key');

      const key = appConfig.getProviderApiKey('anthropic');
      expect(key).toBe('stored-key');
    });

    it('should return undefined when no key exists', () => {
      delete process.env.GOOGLE_API_KEY;

      const key = appConfig.getProviderApiKey('google');
      expect(key).toBeUndefined();
    });
  });

  describe('setProviderApiKey', () => {
    it('should store API key for openai', () => {
      appConfig.setProviderApiKey('openai', 'new-openai-key');

      delete process.env.OPENAI_API_KEY;

      const key = appConfig.getProviderApiKey('openai');
      expect(key).toBe('new-openai-key');
    });

    it('should store API key for anthropic', () => {
      appConfig.setProviderApiKey('anthropic', 'new-anthropic-key');

      delete process.env.ANTHROPIC_API_KEY;
      const key = appConfig.getProviderApiKey('anthropic');
      expect(key).toBe('new-anthropic-key');
    });

    it('should store API key for google', () => {
      appConfig.setProviderApiKey('google', 'new-google-key');

      delete process.env.GOOGLE_API_KEY;
      const key = appConfig.getProviderApiKey('google');
      expect(key).toBe('new-google-key');
    });
  });

  describe('setDefaultProvider', () => {
    it('should set default provider', () => {
      const original = appConfig.get('defaultProvider');

      appConfig.setDefaultProvider('anthropic');
      expect(appConfig.get('defaultProvider')).toBe('anthropic');

      // Restore
      appConfig.setDefaultProvider(original);
    });
  });

  describe('setDefaultModel', () => {
    it('should set default model', () => {
      const original = appConfig.get('defaultModel');

      appConfig.setDefaultModel('claude-3-opus');
      expect(appConfig.get('defaultModel')).toBe('claude-3-opus');

      // Restore
      appConfig.setDefaultModel(original);
    });
  });

  describe('setOllamaUrl', () => {
    it('should set Ollama base URL', () => {
      appConfig.setOllamaUrl('http://localhost:11434');

      const providers = appConfig.get('providers');
      expect(providers.ollama?.baseUrl).toBe('http://localhost:11434');
    });
  });

  describe('getConfigPath', () => {
    it('should return config file path', () => {
      const path = appConfig.getConfigPath();

      expect(path).toBeDefined();
      expect(typeof path).toBe('string');
      expect(path.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string API keys', () => {
      appConfig.setProviderApiKey('openai', '');
      delete process.env.OPENAI_API_KEY;

      const key = appConfig.getProviderApiKey('openai');
      // Empty string is falsy, so might return undefined or empty
      expect(key === '' || key === undefined).toBe(true);
    });

    it('should handle special characters in API keys', () => {
      const specialKey = 'sk-test-key-with-special-chars-!@#$%^&*()';
      appConfig.setProviderApiKey('openai', specialKey);
      delete process.env.OPENAI_API_KEY;

      const key = appConfig.getProviderApiKey('openai');
      expect(key).toBe(specialKey);
    });
  });
});
