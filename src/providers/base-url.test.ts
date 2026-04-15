import { describe, expect, it } from 'vitest';
import { validateProviderBaseUrl } from './base-url';

describe('validateProviderBaseUrl', () => {
  it('should allow undefined/empty baseUrl', () => {
    expect(() => validateProviderBaseUrl('openai', undefined)).not.toThrow();
    expect(() => validateProviderBaseUrl('ollama', '')).not.toThrow();
  });

  it('should reject invalid URL strings', () => {
    expect(() => validateProviderBaseUrl('openai', 'not-a-url')).toThrow(
      'Provider openai baseUrl must be a valid absolute URL'
    );
  });

  it('should reject URL credentials for all providers', () => {
    expect(() => validateProviderBaseUrl('openai', 'https://user:pass@api.openai.com/v1')).toThrow(
      'must not include credentials'
    );

    expect(() => validateProviderBaseUrl('ollama', 'http://user:pass@localhost:11434')).toThrow(
      'must not include credentials'
    );
  });

  it('should enforce https and public host for openai', () => {
    expect(() => validateProviderBaseUrl('openai', 'http://api.openai.com/v1')).toThrow(
      'must use https://'
    );

    expect(() => validateProviderBaseUrl('openai', 'https://localhost:11434/v1')).toThrow(
      'must target a public host'
    );

    expect(() => validateProviderBaseUrl('openai', 'https://127.0.0.1:11434/v1')).toThrow(
      'must target a public host'
    );
  });

  it('should allow secure public openai-compatible endpoints', () => {
    expect(() => validateProviderBaseUrl('openai', 'https://api.openai.com/v1')).not.toThrow();
    expect(() => validateProviderBaseUrl('openai', 'https://openrouter.ai/api/v1')).not.toThrow();
  });

  it('should allow local ollama URLs only', () => {
    expect(() => validateProviderBaseUrl('ollama', 'http://localhost:11434')).not.toThrow();
    expect(() => validateProviderBaseUrl('ollama', 'http://127.0.0.1:11434')).not.toThrow();
    expect(() => validateProviderBaseUrl('ollama', 'http://[::1]:11434')).not.toThrow();
    expect(() => validateProviderBaseUrl('ollama', 'http://0.0.0.0:11434')).not.toThrow();
  });

  it('should reject non-local ollama targets', () => {
    expect(() => validateProviderBaseUrl('ollama', 'http://example.com:11434')).toThrow(
      'must use a local host'
    );

    expect(() => validateProviderBaseUrl('ollama', 'https://10.0.0.10:11434')).toThrow(
      'must use a local host'
    );
  });
});
