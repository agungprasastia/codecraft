/**
 * Vitest Global Setup
 * Configures test environment and global mocks
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock environment variables for testing
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Mock API keys for testing (not real keys)
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  process.env.GOOGLE_API_KEY = 'test-google-key';
});

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
});

afterAll(() => {
  // Cleanup
  vi.restoreAllMocks();
});

// Global test utilities
export const createMockMessage = (overrides = {}) => ({
  id: `msg_${Date.now()}`,
  role: 'user' as const,
  content: 'Test message',
  timestamp: new Date(),
  ...overrides,
});

export const createMockToolCall = (overrides = {}) => ({
  id: `call_${Date.now()}`,
  name: 'test_tool',
  arguments: {},
  ...overrides,
});

export const createMockToolResult = (overrides = {}) => ({
  toolCallId: `call_${Date.now()}`,
  name: 'test_tool',
  result: 'Test result',
  isError: false,
  ...overrides,
});

// Wait utility for async tests
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Console spy helper
export const spyConsole = () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  
  return {
    log,
    error,
    warn,
    restore: () => {
      log.mockRestore();
      error.mockRestore();
      warn.mockRestore();
    },
  };
};
