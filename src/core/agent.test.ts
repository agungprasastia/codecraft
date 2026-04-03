/**
 * Agent Core Tests
 * Tests for mode switching, tool filtering, abort handling, and message flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent, createAgent } from '../core/agent';
import type { AgentConfig, Message, LLMProvider, ToolDefinition } from '../types';

const mockSessionStorage = {
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  getLatest: vi.fn(),
  search: vi.fn(),
};

vi.mock('./session-storage', () => ({
  getSessionStorage: vi.fn(() => mockSessionStorage),
}));

// Mock the providers module
vi.mock('../providers', () => ({
  createProvider: vi.fn(() => mockProvider),
}));

// Mock provider for testing
const mockProvider: LLMProvider = {
  name: 'mock',
  chat: vi.fn(),
};

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
