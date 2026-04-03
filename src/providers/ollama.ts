/**
 * Ollama Provider implementation
 * Supports local models via Ollama
 */

import type { 
  Message, 
  ToolDefinition, 
  StreamChunk, 
  ProviderConfig,
  ToolCall 
} from '../types';
import { BaseProvider } from './base';

interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export class OllamaProvider extends BaseProvider {
  name = 'ollama';
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    onChunk: (chunk: StreamChunk) => void,
    abortSignal?: AbortSignal
  ): Promise<Message> {
    const ollamaMessages = this.convertMessages(messages);
    const ollamaTools = this.convertTools(tools);

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: ollamaMessages,
        tools: ollamaTools.length > 0 ? ollamaTools : undefined,
        stream: true,
        options: {
          num_predict: this.config.maxTokens ?? 4096,
          temperature: this.config.temperature ?? 0.7,
        },
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let content = '';
    const toolCalls: ToolCall[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const chunk = JSON.parse(line);

          if (chunk.message?.content) {
            content += chunk.message.content;
            onChunk({ type: 'text', content: chunk.message.content });
          }

          if (chunk.message?.tool_calls) {
            for (const tc of chunk.message.tool_calls) {
              const toolCall: ToolCall = {
                id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
                name: tc.function.name,
                arguments: tc.function.arguments || {},
              };
              toolCalls.push(toolCall);
              onChunk({ type: 'tool_call', toolCall });
            }
          }

          if (chunk.done) {
            break;
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
    }

    onChunk({ type: 'done' });

    return {
      id: this.generateId(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  private convertMessages(messages: Message[]): OllamaMessage[] {
    const result: OllamaMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') {
        result.push({
          role: msg.role,
          content: msg.content,
        });
      } else if (msg.role === 'tool' && msg.toolResults) {
        // Ollama doesn't have native tool result format, embed in user message
        const toolResultContent = msg.toolResults
          .map((tr) => `Tool ${tr.name} result: ${tr.result}`)
          .join('\n');
        result.push({
          role: 'user',
          content: toolResultContent,
        });
      }
    }

    return result;
  }

  private convertTools(tools: ToolDefinition[]): OllamaTool[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object' as const,
          properties: tool.parameters.properties,
          required: tool.parameters.required,
        },
      },
    }));
  }
}
