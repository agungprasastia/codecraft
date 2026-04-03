/**
 * Token Counter Tests
 */

import { describe, it, expect } from 'vitest';
import {
  countTokens,
  countMessageTokens,
  countMessagesTokens,
  countToolCallTokens,
  countToolResultTokens,
  getModelContextLimit,
  getTokenUsage,
  formatTokenUsage,
  MODEL_CONTEXT_LIMITS,
} from './token-counter';
import type { Message, ToolCall, ToolResult } from '../types';

describe('countTokens', () => {
  it('should return 0 for empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  it('should return 0 for null/undefined-ish input', () => {
    expect(countTokens(undefined as unknown as string)).toBe(0);
    expect(countTokens(null as unknown as string)).toBe(0);
  });

  it('should count tokens in simple string', () => {
    // "Hello world" = 11 chars / 4 = 2.75, rounded up = 3
    expect(countTokens('Hello world')).toBe(3);
  });

  it('should count tokens in longer text', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    // 43 chars / 4 = 10.75, rounded up = 11
    expect(countTokens(text)).toBe(11);
  });

  it('should be within reasonable range of actual token count', () => {
    // "Hello world" is typically 2 tokens in GPT tokenizers
    // Our approximation gives 3, which is within 50% - acceptable for estimates
    const tokens = countTokens('Hello world');
    expect(tokens).toBeGreaterThanOrEqual(2);
    expect(tokens).toBeLessThanOrEqual(4);
  });
});

describe('countToolCallTokens', () => {
  it('should count tokens in tool call', () => {
    const toolCall: ToolCall = {
      id: 'call_123',
      name: 'read_file',
      arguments: { path: '/src/index.ts' },
    };

    const tokens = countToolCallTokens(toolCall);
    // Should include name, serialized args, and overhead
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(50); // Reasonable upper bound
  });

  it('should count tokens for complex arguments', () => {
    const toolCall: ToolCall = {
      id: 'call_456',
      name: 'execute_command',
      arguments: {
        command: 'npm install',
        cwd: '/home/user/project',
        timeout: 30000,
      },
    };

    const tokens = countToolCallTokens(toolCall);
    expect(tokens).toBeGreaterThan(10);
  });
});

describe('countToolResultTokens', () => {
  it('should count tokens in tool result', () => {
    const toolResult: ToolResult = {
      toolCallId: 'call_123',
      name: 'read_file',
      result: 'file contents here',
    };

    const tokens = countToolResultTokens(toolResult);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should count tokens for large results', () => {
    const largeResult = 'a'.repeat(1000);
    const toolResult: ToolResult = {
      toolCallId: 'call_123',
      name: 'read_file',
      result: largeResult,
    };

    const tokens = countToolResultTokens(toolResult);
    // 1000 chars / 4 = 250 + overhead
    expect(tokens).toBeGreaterThanOrEqual(250);
  });
});

describe('countMessageTokens', () => {
  it('should count tokens in user message', () => {
    const message: Message = {
      id: 'msg_1',
      role: 'user',
      content: 'Hello, can you help me?',
      timestamp: new Date(),
    };

    const tokens = countMessageTokens(message);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should count tokens in assistant message with tool calls', () => {
    const message: Message = {
      id: 'msg_2',
      role: 'assistant',
      content: 'I will read that file for you.',
      timestamp: new Date(),
      toolCalls: [
        {
          id: 'call_1',
          name: 'read_file',
          arguments: { path: '/src/index.ts' },
        },
      ],
    };

    const tokens = countMessageTokens(message);
    // Should be more than just content tokens due to tool calls
    const contentOnlyTokens = countTokens(message.content);
    expect(tokens).toBeGreaterThan(contentOnlyTokens);
  });

  it('should count tokens in tool result message', () => {
    const message: Message = {
      id: 'msg_3',
      role: 'tool',
      content: '',
      timestamp: new Date(),
      toolResults: [
        {
          toolCallId: 'call_1',
          name: 'read_file',
          result: 'export function hello() { return "world"; }',
        },
      ],
    };

    const tokens = countMessageTokens(message);
    expect(tokens).toBeGreaterThan(0);
  });
});

describe('countMessagesTokens', () => {
  it('should return 0 for empty array', () => {
    expect(countMessagesTokens([])).toBe(0);
  });

  it('should count tokens in Message array', () => {
    const messages: Message[] = [
      {
        id: 'msg_1',
        role: 'system',
        content: 'You are a helpful assistant.',
        timestamp: new Date(),
      },
      {
        id: 'msg_2',
        role: 'user',
        content: 'Hello!',
        timestamp: new Date(),
      },
      {
        id: 'msg_3',
        role: 'assistant',
        content: 'Hi there! How can I help you today?',
        timestamp: new Date(),
      },
    ];

    const tokens = countMessagesTokens(messages);
    expect(tokens).toBeGreaterThan(0);

    // Should equal sum of individual message tokens
    const expectedTotal = messages.reduce((sum, msg) => sum + countMessageTokens(msg), 0);
    expect(tokens).toBe(expectedTotal);
  });
});

describe('getModelContextLimit', () => {
  it('should return correct limit for known models', () => {
    expect(getModelContextLimit('gpt-4-turbo')).toBe(128000);
    expect(getModelContextLimit('claude-3-opus-20240229')).toBe(200000);
    expect(getModelContextLimit('gemini-1.5-pro')).toBe(1000000);
  });

  it('should return default limit for unknown models', () => {
    expect(getModelContextLimit('unknown-model-xyz')).toBe(MODEL_CONTEXT_LIMITS.default);
  });

  it('should match model prefixes', () => {
    // "gpt-4-turbo-2024-04-09" should match "gpt-4-turbo"
    expect(getModelContextLimit('gpt-4-turbo-2024-04-09')).toBe(128000);
  });
});

describe('getTokenUsage', () => {
  it('should calculate token usage correctly', () => {
    const messages: Message[] = [
      {
        id: 'msg_1',
        role: 'user',
        content: 'Hello!',
        timestamp: new Date(),
      },
    ];

    const usage = getTokenUsage(messages, 'gpt-4-turbo');

    expect(usage.current).toBeGreaterThan(0);
    expect(usage.limit).toBe(128000);
    expect(usage.remaining).toBe(usage.limit - usage.current);
    expect(usage.percentUsed).toBeLessThan(1); // Tiny message
  });

  it('should handle empty messages', () => {
    const usage = getTokenUsage([], 'gpt-4');

    expect(usage.current).toBe(0);
    expect(usage.limit).toBe(8192);
    expect(usage.remaining).toBe(8192);
    expect(usage.percentUsed).toBe(0);
  });
});

describe('formatTokenUsage', () => {
  it('should format token usage for display', () => {
    const usage = {
      current: 1234,
      limit: 8000,
      remaining: 6766,
      percentUsed: 15,
    };

    const formatted = formatTokenUsage(usage);

    expect(formatted).toContain('Token Usage:');
    expect(formatted).toContain('Current:');
    expect(formatted).toContain('tokens');
    expect(formatted).toContain('Model limit:');
    expect(formatted).toContain('Remaining:');
    expect(formatted).toContain('85%'); // 100 - 15

    // Verify all values are present (locale-independent check)
    expect(formatted).toMatch(/1[.,]?234/); // 1234 or 1,234 or 1.234
    expect(formatted).toMatch(/8[.,]?000/); // 8000 or 8,000 or 8.000
    expect(formatted).toMatch(/6[.,]?766/); // 6766 or 6,766 or 6.766
  });
});
