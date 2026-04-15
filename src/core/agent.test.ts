/**
 * Agent Core Tests
 * Tests for mode switching, tool filtering, abort handling, and message flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent, createAgent } from '../core/agent';
import type { AgentConfig, Message, LLMProvider, ToolDefinition } from '../types';

const {
  mockCountMessagesTokens,
  mockCreateProvider,
  mockGetModelContextLimit,
  mockProvider,
  mockSessionStorage,
} = vi.hoisted(() => {
  const provider: LLMProvider = {
    name: 'mock',
    chat: vi.fn(),
  };

  return {
    mockCountMessagesTokens: vi.fn(),
    mockCreateProvider: vi.fn(() => provider),
    mockGetModelContextLimit: vi.fn(),
    mockProvider: provider,
    mockSessionStorage: {
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      getLatest: vi.fn(),
      search: vi.fn(),
    },
  };
});

vi.mock('./token-counter', () => ({
  countMessagesTokens: (messages: Message[]) => mockCountMessagesTokens(messages),
  getModelContextLimit: (model: string) => mockGetModelContextLimit(model),
}));

vi.mock('./session-storage', () => ({
  getSessionStorage: vi.fn(() => mockSessionStorage),
}));

// Mock the providers module
vi.mock('../providers', () => ({
  createProvider: mockCreateProvider,
}));

// Mock the tools module
vi.mock('../tools', () => ({
  getAllTools: vi.fn(() => [
    { name: 'read_file', description: 'Read file', parameters: {}, execute: vi.fn() },
    { name: 'write_file', description: 'Write file', parameters: {}, execute: vi.fn() },
    { name: 'execute_command', description: 'Execute command', parameters: {}, execute: vi.fn() },
  ]),
  getPlanModeTools: vi.fn(() => [
    { name: 'read_file', description: 'Read file', parameters: {}, execute: vi.fn() },
  ]),
}));

describe('Agent', () => {
  let agent: Agent;
  let defaultConfig: AgentConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    defaultConfig = {
      mode: 'build',
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
    };

    // Reset mock provider
    (mockProvider.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'msg_response',
      role: 'assistant',
      content: 'Test response',
      timestamp: new Date(),
    });

    // Default token counter mocks - under threshold
    mockCountMessagesTokens.mockReturnValue(1000);
    mockGetModelContextLimit.mockReturnValue(8192);

    mockSessionStorage.get.mockResolvedValue(null);
    mockSessionStorage.create.mockImplementation(async (metadata, sessionId) => ({
      id: sessionId ?? 'generated-session',
      title: 'New Session',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      metadata: {
        ...metadata,
        messageCount: 0,
      },
    }));
    mockSessionStorage.update.mockImplementation(async (sessionId, messages, metadata) => ({
      id: sessionId,
      title: 'Updated Session',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages,
      metadata: {
        ...metadata,
        messageCount: messages.length,
      },
    }));

    mockCreateProvider.mockImplementation(() => mockProvider);
  });

  describe('Initialization', () => {
    it('should start in BUILD mode by default', () => {
      agent = createAgent({ ...defaultConfig, mode: 'build' });
      const state = agent.getState();

      expect(state.messages).toHaveLength(1); // System message
      expect(state.messages[0].role).toBe('system');
      expect(state.messages[0].content).toContain('BUILD mode');
    });

    it('should start in PLAN mode when specified', () => {
      agent = createAgent({ ...defaultConfig, mode: 'plan' });
      const state = agent.getState();

      expect(state.messages[0].content).toContain('PLAN mode');
    });

    it('should use custom system prompt when provided', () => {
      const customPrompt = 'You are a custom assistant.';
      agent = createAgent({ ...defaultConfig, systemPrompt: customPrompt });
      const state = agent.getState();

      expect(state.messages[0].content).toBe(customPrompt);
    });

    it('should restore an existing session when initialized', async () => {
      mockSessionStorage.get.mockResolvedValueOnce({
        id: 'session-1',
        title: 'Saved Session',
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          { id: 'user-1', role: 'user', content: 'Saved question', timestamp: new Date() },
          { id: 'assistant-1', role: 'assistant', content: 'Saved answer', timestamp: new Date() },
        ],
        metadata: {
          mode: 'plan',
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          workingDirectory: process.cwd(),
          messageCount: 2,
        },
      });

      agent = createAgent({ ...defaultConfig, sessionId: 'session-1' });
      await agent.initializeSession();

      const messages = agent.getMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('system');
      expect(messages[1].content).toBe('Saved question');
      expect(messages[2].content).toBe('Saved answer');
    });

    it('should keep explicit mode when restoring a saved session', async () => {
      mockSessionStorage.get.mockResolvedValueOnce({
        id: 'session-plan-check',
        title: 'Saved Session',
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [],
        metadata: {
          mode: 'build',
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          workingDirectory: process.cwd(),
          messageCount: 0,
        },
      });

      agent = createAgent({ ...defaultConfig, mode: 'plan', sessionId: 'session-plan-check' });
      await agent.initializeSession();

      expect(agent.getState().messages[0].content).toContain('PLAN mode');
    });

    it('should create a named session when missing', async () => {
      agent = createAgent({ ...defaultConfig, sessionId: 'session-2' });

      await agent.initializeSession();

      expect(mockSessionStorage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'build',
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
        }),
        'session-2'
      );
    });
  });

  describe('Mode Switching', () => {
    it('should switch from BUILD to PLAN mode', () => {
      agent = createAgent({ ...defaultConfig, mode: 'build' });

      agent.setMode('plan');
      const state = agent.getState();

      expect(state.messages[0].content).toContain('PLAN mode');
    });

    it('should switch from PLAN to BUILD mode', () => {
      agent = createAgent({ ...defaultConfig, mode: 'plan' });

      agent.setMode('build');
      const state = agent.getState();

      expect(state.messages[0].content).toContain('BUILD mode');
    });

    it('should filter tools based on mode', async () => {
      const { getAllTools, getPlanModeTools } = await import('../tools');

      // BUILD mode - all tools
      agent = createAgent({ ...defaultConfig, mode: 'build' });
      expect(getAllTools).toHaveBeenCalled();

      // PLAN mode - limited tools
      agent = createAgent({ ...defaultConfig, mode: 'plan' });
      expect(getPlanModeTools).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('should add user message to history', async () => {
      agent = createAgent(defaultConfig);

      await agent.chat('Hello');
      const messages = agent.getMessages();

      // System + User + Assistant
      expect(messages).toHaveLength(3);
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('Hello');
    });

    it('should add assistant response to history', async () => {
      agent = createAgent(defaultConfig);

      await agent.chat('Hello');
      const messages = agent.getMessages();

      expect(messages[2].role).toBe('assistant');
      expect(messages[2].content).toBe('Test response');
    });

    it('should call onMessage event for each message', async () => {
      const onMessage = vi.fn();
      agent = createAgent(defaultConfig, { onMessage });

      await agent.chat('Hello');

      // Called for user message and assistant message
      expect(onMessage).toHaveBeenCalledTimes(2);
    });

    it('should autosave session history after chat', async () => {
      agent = createAgent({ ...defaultConfig, sessionId: 'session-3' });
      await agent.initializeSession();

      await agent.chat('Persist this');

      expect(mockSessionStorage.update).toHaveBeenCalledWith(
        'session-3',
        expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Persist this' }),
          expect.objectContaining({ role: 'assistant', content: 'Test response' }),
        ]),
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
        })
      );
    });

    it('should pass configured baseUrl when creating the provider', () => {
      agent = createAgent({ ...defaultConfig, provider: 'ollama' });

      expect(mockCreateProvider).toHaveBeenCalledWith(
        'ollama',
        expect.objectContaining({
          baseUrl: undefined,
          model: 'gpt-4-turbo-preview',
        })
      );
    });
  });

  describe('Stream batching', () => {
    it('should batch consecutive text chunks before done', async () => {
      const onStreamChunk = vi.fn();
      agent = createAgent(defaultConfig, { onStreamChunk });

      (mockProvider.chat as ReturnType<typeof vi.fn>).mockImplementationOnce(
        async (_messages, _tools, onChunk) => {
          onChunk({ type: 'text', content: 'Hello ' });
          onChunk({ type: 'text', content: 'world' });
          onChunk({ type: 'done' });

          return {
            id: 'msg_response',
            role: 'assistant',
            content: 'Hello world',
            timestamp: new Date(),
          };
        }
      );

      await agent.chat('Stream please');

      expect(onStreamChunk.mock.calls).toEqual([
        [{ type: 'text', content: 'Hello world' }],
        [{ type: 'done' }],
      ]);
    });

    it('should flush buffered text before tool call events', async () => {
      const onStreamChunk = vi.fn();
      agent = createAgent(defaultConfig, { onStreamChunk });

      (mockProvider.chat as ReturnType<typeof vi.fn>).mockImplementationOnce(
        async (_messages, _tools, onChunk) => {
          onChunk({ type: 'text', content: 'Preparing ' });
          onChunk({ type: 'text', content: 'tool' });
          onChunk({
            type: 'tool_call',
            toolCall: { id: 'call_1', name: 'read_file', arguments: { path: 'src/index.ts' } },
          });
          onChunk({ type: 'done' });

          return {
            id: 'msg_response',
            role: 'assistant',
            content: 'Preparing tool',
            timestamp: new Date(),
          };
        }
      );

      await agent.chat('Use a tool');

      expect(onStreamChunk.mock.calls).toEqual([
        [{ type: 'text', content: 'Preparing tool' }],
        [
          {
            type: 'tool_call',
            toolCall: { id: 'call_1', name: 'read_file', arguments: { path: 'src/index.ts' } },
          },
        ],
        [{ type: 'done' }],
      ]);
    });

    it('should flush buffered text when provider errors', async () => {
      const onStreamChunk = vi.fn();
      const onError = vi.fn();
      agent = createAgent(defaultConfig, { onError, onStreamChunk });

      (mockProvider.chat as ReturnType<typeof vi.fn>).mockImplementationOnce(
        async (_messages, _tools, onChunk) => {
          onChunk({ type: 'text', content: 'Partial ' });
          onChunk({ type: 'text', content: 'response' });
          throw new Error('stream failed');
        }
      );

      await expect(agent.chat('Break')).rejects.toThrow('stream failed');

      expect(onStreamChunk).toHaveBeenCalledWith({ type: 'text', content: 'Partial response' });
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'stream failed' }));
    });

    it('should flush buffered text on timer without waiting for done', async () => {
      vi.useFakeTimers();

      const onStreamChunk = vi.fn();
      agent = createAgent(defaultConfig, { onStreamChunk });

      (mockProvider.chat as ReturnType<typeof vi.fn>).mockImplementationOnce(
        async (_messages, _tools, onChunk) =>
          new Promise((resolve) => {
            onChunk({ type: 'text', content: 'Buffered ' });
            onChunk({ type: 'text', content: 'output' });

            setTimeout(() => {
              resolve({
                id: 'msg_response',
                role: 'assistant',
                content: 'Buffered output',
                timestamp: new Date(),
              });
            }, 50);
          })
      );

      const chatPromise = agent.chat('Timer test');

      await Promise.resolve();

      await vi.advanceTimersByTimeAsync(20);

      expect(onStreamChunk).toHaveBeenCalledWith({ type: 'text', content: 'Buffered output' });

      await vi.advanceTimersByTimeAsync(50);
      await chatPromise;
    });
  });

  describe('Abort Handling', () => {
    it('should abort processing when abort() is called', async () => {
      agent = createAgent(defaultConfig);

      // Start a chat that we'll abort
      const chatPromise = agent.chat('Long task');

      // Immediately abort
      agent.abort();

      // Should complete (abort is handled gracefully)
      await expect(chatPromise).resolves.toBeDefined();
    });

    it('should set isProcessing to false after abort', async () => {
      agent = createAgent(defaultConfig);

      await agent.chat('Test');
      agent.abort();

      const state = agent.getState();
      expect(state.isProcessing).toBe(false);
    });
  });

  describe('History Management', () => {
    it('should clear history but keep system message', async () => {
      agent = createAgent(defaultConfig);

      await agent.chat('Hello');
      expect(agent.getMessages()).toHaveLength(3);

      agent.clearHistory();
      const messages = agent.getMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('system');
    });
  });

  describe('State Management', () => {
    it('should track processing state', async () => {
      const onStateChange = vi.fn();
      agent = createAgent(defaultConfig, { onStateChange });

      const chatPromise = agent.chat('Test');

      // Should have called onStateChange with isProcessing: true
      expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ isProcessing: true }));

      await chatPromise;

      // Should have called onStateChange with isProcessing: false
      expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ isProcessing: false }));
    });

    it('should throw error if chat called while processing', async () => {
      agent = createAgent(defaultConfig);

      // Make the mock provider slow
      (mockProvider.chat as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  id: 'msg_response',
                  role: 'assistant',
                  content: 'Test response',
                  timestamp: new Date(),
                }),
              100
            )
          )
      );

      const firstChat = agent.chat('First');

      // Try to chat again immediately
      await expect(agent.chat('Second')).rejects.toThrow('already processing');

      await firstChat;
    });
  });

  describe('Error Handling', () => {
    it('should call onError when provider fails', async () => {
      const onError = vi.fn();
      agent = createAgent(defaultConfig, { onError });

      const error = new Error('Provider error');
      (mockProvider.chat as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      await expect(agent.chat('Test')).rejects.toThrow('Provider error');
      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should set error in state when processing fails', async () => {
      agent = createAgent(defaultConfig);

      (mockProvider.chat as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Test error')
      );

      try {
        await agent.chat('Test');
      } catch {
        // Expected
      }

      const state = agent.getState();
      expect(state.error).toBe('Test error');
    });
  });
});

describe('createAgent', () => {
  it('should create an Agent instance', () => {
    const agent = createAgent({
      mode: 'build',
      provider: 'openai',
      model: 'gpt-4',
    });

    expect(agent).toBeInstanceOf(Agent);
  });
});

describe('Context Truncation', () => {
  let agent: Agent;
  let defaultConfig: AgentConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    defaultConfig = {
      mode: 'build',
      provider: 'openai',
      model: 'gpt-4',
    };

    // Reset mock provider
    (mockProvider.chat as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'msg_response',
      role: 'assistant',
      content: 'Test response',
      timestamp: new Date(),
    });

    mockSessionStorage.get.mockResolvedValue(null);
    mockSessionStorage.create.mockResolvedValue({
      id: 'test-session',
      title: 'Test Session',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      metadata: {
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '.',
        messageCount: 0,
      },
    });
    mockSessionStorage.update.mockResolvedValue({
      id: 'test-session',
      title: 'Test Session',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      metadata: {
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '.',
        messageCount: 0,
      },
    });
  });

  it('should not truncate when under threshold', async () => {
    // Under 80% of 8192 = 6553 threshold
    mockCountMessagesTokens.mockReturnValue(5000);
    mockGetModelContextLimit.mockReturnValue(8192);

    agent = createAgent(defaultConfig);
    await agent.chat('Hello');

    const messages = agent.getMessages();
    // Should have system + user + assistant (no truncation notice)
    expect(messages).toHaveLength(3);
    expect(messages.every((m) => !m.content.includes('Context truncated'))).toBe(true);
  });

  it('should truncate oldest messages when over 80% of limit', async () => {
    // Set up to be over threshold: 80% of 8192 = 6553
    mockGetModelContextLimit.mockReturnValue(8192);

    // First call (before chat): return high value to trigger truncation
    // Subsequent calls: return lower value
    let callCount = 0;
    mockCountMessagesTokens.mockImplementation((messages: Message[]) => {
      callCount++;
      // First call during processConversation - over threshold
      if (callCount === 1) return 7000;
      // After truncation - under threshold
      return 4000;
    });

    // Create agent with many messages to simulate long conversation
    agent = createAgent(defaultConfig);

    // Manually add messages to simulate long conversation (more than MIN_RECENT_MESSAGES=10)
    const state = agent.getState();
    for (let i = 0; i < 15; i++) {
      state.messages.push({
        id: `user_${i}`,
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date(),
      });
      state.messages.push({
        id: `assistant_${i}`,
        role: 'assistant',
        content: `Response ${i}`,
        timestamp: new Date(),
      });
    }

    await agent.chat('Trigger truncation');

    const messages = agent.getMessages();
    // Should have truncation notice in messages
    const truncationNotice = messages.find((m) => m.content.includes('Context truncated'));
    expect(truncationNotice).toBeDefined();
  });

  it('should keep system message intact', async () => {
    mockGetModelContextLimit.mockReturnValue(8192);
    mockCountMessagesTokens.mockReturnValueOnce(7000).mockReturnValue(3000);

    agent = createAgent(defaultConfig);

    // Add messages
    const state = agent.getState();
    for (let i = 0; i < 20; i++) {
      state.messages.push({
        id: `msg_${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(),
      });
    }

    await agent.chat('Test');

    const messages = agent.getMessages();
    // System message should be first
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('BUILD mode');
  });

  it('should keep last 10 messages minimum', async () => {
    mockGetModelContextLimit.mockReturnValue(8192);
    mockCountMessagesTokens.mockReturnValueOnce(7500).mockReturnValue(3000);

    agent = createAgent(defaultConfig);

    // Add exactly 12 non-system messages
    const state = agent.getState();
    for (let i = 0; i < 12; i++) {
      state.messages.push({
        id: `msg_${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(),
      });
    }

    await agent.chat('Test');

    const messages = agent.getMessages();
    const nonSystemMessages = messages.filter(
      (m) => m.role !== 'system' && !m.content.includes('Context truncated')
    );

    // Should have at least 10 recent messages + the new user/assistant pair
    // Plus potential truncation notice
    expect(nonSystemMessages.length).toBeGreaterThanOrEqual(10);
  });
});
