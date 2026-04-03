/**
 * Mock LLM Provider for Testing
 * Provides deterministic responses for unit tests
 */

import { vi } from 'vitest';
import type { 
  LLMProvider, 
  Message, 
  ToolDefinition, 
  StreamChunk,
  ToolCall 
} from '../../types';

export interface MockProviderConfig {
  /** Default response content */
  defaultResponse?: string;
  /** Queue of responses to return in order */
  responseQueue?: Message[];
  /** Whether to simulate streaming */
  simulateStreaming?: boolean;
  /** Delay in ms before responding */
  responseDelay?: number;
  /** Error to throw on next call */
  throwError?: Error;
  /** Tool calls to include in response */
  toolCalls?: ToolCall[];
}

/**
 * Creates a mock LLM provider for testing
 */
export function createMockProvider(config: MockProviderConfig = {}): LLMProvider & {
  _config: MockProviderConfig;
  _callHistory: Array<{ messages: Message[]; tools?: ToolDefinition[] }>;
  setNextResponse: (response: Partial<Message>) => void;
  setNextToolCalls: (toolCalls: ToolCall[]) => void;
  setError: (error: Error | null) => void;
  reset: () => void;
} {
  const callHistory: Array<{ messages: Message[]; tools?: ToolDefinition[] }> = [];
  let responseIndex = 0;

  const provider = {
    name: 'mock',
    _config: config,
    _callHistory: callHistory,

    async chat(
      messages: Message[],
      tools?: ToolDefinition[],
      onChunk?: (chunk: StreamChunk) => void,
      _signal?: AbortSignal
    ): Promise<Message> {
      // Record the call
      callHistory.push({ messages: [...messages], tools: tools ? [...tools] : undefined });

      // Check for error
      if (config.throwError) {
        const error = config.throwError;
        config.throwError = undefined; // Clear after throwing
        throw error;
      }

      // Add delay if specified
      if (config.responseDelay && config.responseDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, config.responseDelay));
      }

      // Get response from queue or use default
      let response: Message;
      if (config.responseQueue && config.responseQueue.length > responseIndex) {
        response = config.responseQueue[responseIndex++];
      } else {
        response = {
          id: `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: 'assistant',
          content: config.defaultResponse || 'Mock response',
          timestamp: new Date(),
          toolCalls: config.toolCalls,
        };
      }

      // Simulate streaming if requested
      if (config.simulateStreaming && onChunk && response.content) {
        const words = response.content.split(' ');
        for (const word of words) {
          onChunk({ type: 'text', content: word + ' ' });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        onChunk({ type: 'done' });
      }

      return response;
    },

    async listModels(): Promise<string[]> {
      return ['mock-model-1', 'mock-model-2', 'mock-model-3'];
    },

    async validateApiKey(): Promise<boolean> {
      return true;
    },

    // Helper methods for tests
    setNextResponse(partial: Partial<Message>): void {
      const response: Message = {
        id: `mock_${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        ...partial,
      };
      if (!config.responseQueue) {
        config.responseQueue = [];
      }
      config.responseQueue.push(response);
    },

    setNextToolCalls(toolCalls: ToolCall[]): void {
      config.toolCalls = toolCalls;
    },

    setError(error: Error | null): void {
      config.throwError = error || undefined;
    },

    reset(): void {
      callHistory.length = 0;
      responseIndex = 0;
      config.responseQueue = undefined;
      config.toolCalls = undefined;
      config.throwError = undefined;
    },
  };

  return provider;
}

/**
 * Creates a simple mock provider with vi.fn() for easy assertions
 */
export function createSpyProvider(): LLMProvider & {
  chat: ReturnType<typeof vi.fn>;
  listModels: ReturnType<typeof vi.fn>;
  validateApiKey: ReturnType<typeof vi.fn>;
} {
  return {
    name: 'spy-mock',
    chat: vi.fn().mockResolvedValue({
      id: 'mock_response',
      role: 'assistant',
      content: 'Mock response',
      timestamp: new Date(),
    }),
    listModels: vi.fn().mockResolvedValue(['mock-model']),
    validateApiKey: vi.fn().mockResolvedValue(true),
  };
}

/**
 * Creates mock tool calls for testing
 */
export function createMockToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: 'test_tool',
    arguments: {},
    ...overrides,
  };
}

/**
 * Creates a sequence of tool calls for multi-step tests
 */
export function createToolCallSequence(
  tools: Array<{ name: string; arguments?: Record<string, unknown> }>
): ToolCall[] {
  return tools.map((tool, index) => ({
    id: `call_${Date.now()}_${index}`,
    name: tool.name,
    arguments: tool.arguments || {},
  }));
}

/**
 * Asserts that the provider was called with specific messages
 */
export function assertProviderCalledWith(
  provider: ReturnType<typeof createMockProvider>,
  expectedUserMessage: string
): void {
  const lastCall = provider._callHistory[provider._callHistory.length - 1];
  if (!lastCall) {
    throw new Error('Provider was not called');
  }
  
  const userMessage = lastCall.messages.find(m => m.role === 'user');
  if (!userMessage) {
    throw new Error('No user message found in call');
  }
  
  if (userMessage.content !== expectedUserMessage) {
    throw new Error(
      `Expected user message "${expectedUserMessage}" but got "${userMessage.content}"`
    );
  }
}

/**
 * Asserts that tools were passed to the provider
 */
export function assertToolsProvided(
  provider: ReturnType<typeof createMockProvider>,
  expectedToolNames: string[]
): void {
  const lastCall = provider._callHistory[provider._callHistory.length - 1];
  if (!lastCall) {
    throw new Error('Provider was not called');
  }
  
  const toolNames = lastCall.tools?.map(t => t.name) || [];
  for (const expected of expectedToolNames) {
    if (!toolNames.includes(expected)) {
      throw new Error(`Expected tool "${expected}" not found. Got: ${toolNames.join(', ')}`);
    }
  }
}
