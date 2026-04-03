/**
 * Core type definitions for Codecraft
 */

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: string;
  isError?: boolean;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolExecutionResult>;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ToolParameterProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ToolParameterProperty;
  default?: unknown;
}

export interface ToolContext {
  workingDirectory: string;
  mode: AgentMode;
  abortSignal?: AbortSignal;
}

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  error?: string;
}

// ============================================================================
// Agent Types
// ============================================================================

export type AgentMode = 'build' | 'plan';

export interface AgentConfig {
  mode: AgentMode;
  provider: string;
  model: string;
  sessionId?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AgentState {
  messages: Message[];
  isProcessing: boolean;
  currentToolCall?: ToolCall;
  error?: string;
}

// ============================================================================
// Provider Types
// ============================================================================

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_call_delta' | 'done' | 'error';
  content?: string;
  toolCall?: Partial<ToolCall>;
  error?: string;
}

export interface LLMProvider {
  name: string;
  chat(
    messages: Message[],
    tools: ToolDefinition[],
    onChunk: (chunk: StreamChunk) => void,
    abortSignal?: AbortSignal
  ): Promise<Message>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AppConfig {
  providers: {
    openai?: { apiKey: string; baseUrl?: string };
    anthropic?: { apiKey: string };
    google?: { apiKey: string };
    ollama?: { baseUrl: string };
  };
  defaultProvider: string;
  defaultModel: string;
  theme: 'dark' | 'light' | 'auto';
}

// ============================================================================
// UI Types
// ============================================================================

export interface ChatInputState {
  value: string;
  isSubmitting: boolean;
}

export interface UIState {
  showHelp: boolean;
  showSettings: boolean;
  scrollPosition: number;
}
