/**
 * Base Provider abstract class
 * All LLM providers extend this class
 */

import type { LLMProvider, ProviderConfig, Message, ToolDefinition, StreamChunk } from '../types';

export abstract class BaseProvider implements LLMProvider {
  abstract name: string;
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract chat(
    messages: Message[],
    tools: ToolDefinition[],
    onChunk: (chunk: StreamChunk) => void,
    abortSignal?: AbortSignal
  ): Promise<Message>;

  protected generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
