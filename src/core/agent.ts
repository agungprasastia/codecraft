/**
 * Core Agent implementation
 * Orchestrates conversation flow, tool execution, and mode switching
 */

import type {
  Message,
  ToolDefinition,
  ToolCall,
  ToolResult,
  ToolContext,
  AgentConfig,
  AgentState,
  LLMProvider,
  StreamChunk,
} from '../types';
import { createProvider } from '../providers';
import { getAllTools, getPlanModeTools } from '../tools';
import { appConfig } from './config';
import { getSessionStorage } from './session-storage';
import type { SessionMetadata } from './session';
import { countMessagesTokens, getModelContextLimit } from './token-counter';

// ============================================================================
// Constants
// ============================================================================

/**
 * Truncate context when usage exceeds this percentage of the limit
 */
const TRUNCATION_THRESHOLD = 0.8;

/**
 * Minimum number of recent messages to keep (excluding system message)
 */
const MIN_RECENT_MESSAGES = 10;

export interface AgentEvents {
  onMessage: (message: Message) => void;
  onStreamChunk: (chunk: StreamChunk) => void;
  onToolStart: (toolCall: ToolCall) => void;
  onToolEnd: (result: ToolResult) => void;
  onError: (error: Error) => void;
  onStateChange: (state: AgentState) => void;
}

export class Agent {
  private config: AgentConfig;
  private provider: LLMProvider;
  private tools: ToolDefinition[];
  private state: AgentState;
  private events: Partial<AgentEvents>;
  private abortController: AbortController | null = null;
  private sessionStorage = getSessionStorage();
  private sessionId?: string;

  constructor(config: AgentConfig, events: Partial<AgentEvents> = {}) {
    this.config = config;
    this.events = events;
    this.sessionId = config.sessionId;
    this.state = {
      messages: [],
      isProcessing: false,
    };

    // Initialize provider
    const apiKey = this.getApiKey(config.provider);
    this.provider = createProvider(config.provider, {
      apiKey,
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });

    // Initialize tools based on mode
    this.tools = config.mode === 'plan' ? getPlanModeTools() : getAllTools();

    // Add system prompt
    this.state.messages.push(this.createSystemMessage());
  }

  async initializeSession(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    const existingSession = await this.sessionStorage.get(this.sessionId);

    if (!existingSession) {
      await this.sessionStorage.create(this.getSessionMetadata(), this.sessionId);
      return;
    }

    this.state.messages = [
      this.createSystemMessage(),
      ...existingSession.messages.filter((message) => message.role !== 'system'),
    ];
  }

  private getDefaultSystemPrompt(): string {
    const modeDescription =
      this.config.mode === 'plan'
        ? 'You are in PLAN mode. You can ONLY read files and explore the codebase. You cannot modify any files or execute commands that change the system.'
        : 'You are in BUILD mode. You have full access to read/write files and execute shell commands.';

    return `You are Codecraft, an AI coding assistant running in a terminal.

${modeDescription}

Guidelines:
- Be concise and direct in your responses
- When asked to perform tasks, use the available tools
- Always explain what you're doing before taking actions
- If a task requires multiple steps, break it down clearly
- Ask for clarification if the request is ambiguous

Current working directory: ${process.cwd()}
Mode: ${this.config.mode.toUpperCase()}`;
  }

  async chat(userMessage: string): Promise<Message> {
    if (this.state.isProcessing) {
      throw new Error('Agent is already processing a message');
    }

    this.abortController = new AbortController();
    this.updateState({ isProcessing: true, error: undefined });

    // Add user message
    const userMsg: Message = {
      id: this.generateId(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    this.state.messages.push(userMsg);
    this.events.onMessage?.(userMsg);
    await this.persistSession();

    try {
      // Process message and handle tool calls
      const response = await this.processConversation();
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.updateState({ error: err.message });
      this.events.onError?.(err);
      throw err;
    } finally {
      this.updateState({ isProcessing: false, currentToolCall: undefined });
      this.abortController = null;
    }
  }

  private async processConversation(): Promise<Message> {
    while (true) {
      // Truncate context if needed before API call
      this.truncateContextIfNeeded();

      // Get LLM response
      const assistantMessage = await this.provider.chat(
        this.state.messages,
        this.tools,
        (chunk) => this.events.onStreamChunk?.(chunk),
        this.abortController?.signal
      );

      this.state.messages.push(assistantMessage);
      this.events.onMessage?.(assistantMessage);
      await this.persistSession();

      // If no tool calls, we're done
      if (!assistantMessage.toolCalls || assistantMessage.toolCalls.length === 0) {
        return assistantMessage;
      }

      // Execute tool calls
      const toolResults = await this.executeToolCalls(assistantMessage.toolCalls);

      // Add tool results as a message
      const toolResultMessage: Message = {
        id: this.generateId(),
        role: 'tool',
        content: '',
        timestamp: new Date(),
        toolResults,
      };
      this.state.messages.push(toolResultMessage);
      this.events.onMessage?.(toolResultMessage);
      await this.persistSession();

      // Continue the loop to get the next response
    }
  }

  private async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      this.updateState({ currentToolCall: toolCall });
      this.events.onToolStart?.(toolCall);

      const tool = this.tools.find((t) => t.name === toolCall.name);

      let result: ToolResult;

      if (!tool) {
        result = {
          toolCallId: toolCall.id,
          name: toolCall.name,
          result: `Error: Unknown tool "${toolCall.name}"`,
          isError: true,
        };
      } else {
        try {
          const context: ToolContext = {
            workingDirectory: process.cwd(),
            mode: this.config.mode,
            abortSignal: this.abortController?.signal,
          };

          const executionResult = await tool.execute(toolCall.arguments, context);

          result = {
            toolCallId: toolCall.id,
            name: toolCall.name,
            result: executionResult.success
              ? executionResult.output
              : `Error: ${executionResult.error}`,
            isError: !executionResult.success,
          };
        } catch (error) {
          result = {
            toolCallId: toolCall.id,
            name: toolCall.name,
            result: `Error: ${error instanceof Error ? error.message : String(error)}`,
            isError: true,
          };
        }
      }

      results.push(result);
      this.events.onToolEnd?.(result);
    }

    return results;
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  getState(): AgentState {
    return { ...this.state };
  }

  getMessages(): Message[] {
    return [...this.state.messages];
  }

  clearHistory(): void {
    // Keep only the system message
    this.state.messages = this.state.messages.filter((m) => m.role === 'system');
    this.updateState({});
    this.persistSessionInBackground();
  }

  setMode(mode: 'build' | 'plan'): void {
    this.config.mode = mode;
    this.tools = mode === 'plan' ? getPlanModeTools() : getAllTools();

    // Update system prompt
    const systemMsgIndex = this.state.messages.findIndex((m) => m.role === 'system');
    if (systemMsgIndex !== -1) {
      this.state.messages[systemMsgIndex] = {
        ...this.state.messages[systemMsgIndex],
        content: this.config.systemPrompt ?? this.getDefaultSystemPrompt(),
      };
    }

    this.persistSessionInBackground();
  }

  private updateState(partial: Partial<AgentState>): void {
    this.state = { ...this.state, ...partial };
    this.events.onStateChange?.(this.state);
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private createSystemMessage(): Message {
    return {
      id: this.generateId(),
      role: 'system',
      content: this.config.systemPrompt ?? this.getDefaultSystemPrompt(),
      timestamp: new Date(),
    };
  }

  private getSessionMetadata(): Omit<SessionMetadata, 'messageCount'> {
    return {
      mode: this.config.mode,
      provider: this.config.provider,
      model: this.config.model,
      workingDirectory: process.cwd(),
    };
  }

  private getPersistedMessages(): Message[] {
    return this.state.messages.filter((message) => message.role !== 'system');
  }

  private async persistSession(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    const existingSession = await this.sessionStorage.get(this.sessionId);
    const metadata = this.getSessionMetadata();

    if (!existingSession) {
      await this.sessionStorage.create(metadata, this.sessionId);
    }

    await this.sessionStorage.update(this.sessionId, this.getPersistedMessages(), metadata);
  }

  private persistSessionInBackground(): void {
    void this.persistSession().catch((error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      this.events.onError?.(err);
    });
  }

  /**
   * Truncate old messages when context exceeds threshold
   * Keeps system message and minimum recent messages
   */
  private truncateContextIfNeeded(): void {
    const contextLimit = getModelContextLimit(this.config.model);
    const threshold = contextLimit * TRUNCATION_THRESHOLD;
    const currentTokens = countMessagesTokens(this.state.messages);

    // No truncation needed if under threshold
    if (currentTokens <= threshold) {
      return;
    }

    // Separate system message and other messages
    const systemMessage = this.state.messages.find((m) => m.role === 'system');
    const otherMessages = this.state.messages.filter((m) => m.role !== 'system');

    // Must keep at least MIN_RECENT_MESSAGES
    if (otherMessages.length <= MIN_RECENT_MESSAGES) {
      return;
    }

    // Calculate how many tokens we need to remove
    const targetTokens = threshold * 0.7; // Target 70% to leave room
    let tokensToRemove = currentTokens - targetTokens;

    // Remove oldest messages until under threshold or at minimum
    const messagesToRemove: number[] = [];
    let removedTokens = 0;

    for (let i = 0; i < otherMessages.length - MIN_RECENT_MESSAGES; i++) {
      if (removedTokens >= tokensToRemove) {
        break;
      }
      const msgTokens = countMessagesTokens([otherMessages[i]]);
      removedTokens += msgTokens;
      messagesToRemove.push(i);
    }

    // If no messages to remove, nothing to do
    if (messagesToRemove.length === 0) {
      return;
    }

    // Build new message array
    const keptMessages = otherMessages.filter((_, idx) => !messagesToRemove.includes(idx));

    // Add truncation notice
    const truncationNotice: Message = {
      id: this.generateId(),
      role: 'system',
      content: `[Context truncated: ${messagesToRemove.length} older messages removed to stay within token limits]`,
      timestamp: new Date(),
    };

    // Rebuild messages: system + truncation notice + kept messages
    this.state.messages = systemMessage
      ? [systemMessage, truncationNotice, ...keptMessages]
      : [truncationNotice, ...keptMessages];
  }

  private getApiKey(provider: string): string {
    // For providers that support API keys, use appConfig which checks env + stored config
    if (provider === 'openai' || provider === 'anthropic' || provider === 'google') {
      return appConfig.getProviderApiKey(provider) || '';
    }
    // Ollama doesn't need API key
    return '';
  }
}

export function createAgent(config: AgentConfig, events?: Partial<AgentEvents>): Agent {
  return new Agent(config, events);
}
