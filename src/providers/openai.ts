/**
 * OpenAI Provider implementation
 * Supports GPT-4, GPT-4 Turbo, GPT-3.5 Turbo, and compatible APIs
 */

import OpenAI from 'openai';
import type { 
  Message, 
  ToolDefinition, 
  StreamChunk, 
  ProviderConfig,
  ToolCall 
} from '../types';
import { BaseProvider } from './base';

export class OpenAIProvider extends BaseProvider {
  name = 'openai';
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    onChunk: (chunk: StreamChunk) => void,
    abortSignal?: AbortSignal
  ): Promise<Message> {
    const openaiMessages = this.convertMessages(messages);
    const openaiTools = this.convertTools(tools);

    const stream = await this.client.chat.completions.create(
      {
        model: this.config.model,
        messages: openaiMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        max_tokens: this.config.maxTokens ?? 4096,
        temperature: this.config.temperature ?? 0.7,
        stream: true,
      },
      { signal: abortSignal }
    );

    let content = '';
    const toolCalls: ToolCall[] = [];
    const toolCallDeltas: Map<number, Partial<ToolCall>> = new Map();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        content += delta.content;
        onChunk({ type: 'text', content: delta.content });
      }

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          const index = toolCall.index;
          
          if (!toolCallDeltas.has(index)) {
            toolCallDeltas.set(index, {
              id: toolCall.id,
              name: toolCall.function?.name,
              arguments: {},
            });
          }

          const existing = toolCallDeltas.get(index)!;
          
          if (toolCall.id) {
            existing.id = toolCall.id;
          }
          if (toolCall.function?.name) {
            existing.name = toolCall.function.name;
          }
          if (toolCall.function?.arguments) {
            const currentArgs = JSON.stringify(existing.arguments || {});
            const argsStr = currentArgs === '{}' 
              ? toolCall.function.arguments 
              : currentArgs.slice(0, -1) + toolCall.function.arguments;
            
            try {
              existing.arguments = JSON.parse(argsStr);
            } catch {
              // Arguments still incomplete, store as partial
              (existing as unknown as { _rawArgs: string })._rawArgs = 
                ((existing as unknown as { _rawArgs: string })._rawArgs || '') + toolCall.function.arguments;
            }
          }

          onChunk({ type: 'tool_call_delta', toolCall: existing });
        }
      }

      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        // Finalize tool calls
        for (const [_, delta] of toolCallDeltas) {
          if (delta.id && delta.name) {
            let args = delta.arguments || {};
            
            // Try to parse raw args if they exist
            const rawArgs = (delta as unknown as { _rawArgs?: string })._rawArgs;
            if (rawArgs) {
              try {
                args = JSON.parse(rawArgs);
              } catch {
                args = {};
              }
            }

            const finalToolCall: ToolCall = {
              id: delta.id,
              name: delta.name,
              arguments: args as Record<string, unknown>,
            };
            toolCalls.push(finalToolCall);
            onChunk({ type: 'tool_call', toolCall: finalToolCall });
          }
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

  private convertMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: msg.content || null,
        };

        if (msg.toolCalls && msg.toolCalls.length > 0) {
          assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          }));
        }

        result.push(assistantMsg);
      } else if (msg.role === 'system') {
        result.push({ role: 'system', content: msg.content });
      } else if (msg.role === 'tool' && msg.toolResults) {
        for (const toolResult of msg.toolResults) {
          result.push({
            role: 'tool',
            tool_call_id: toolResult.toolCallId,
            content: toolResult.result,
          });
        }
      }
    }

    return result;
  }

  private convertTools(tools: ToolDefinition[]): OpenAI.ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.properties,
          required: tool.parameters.required || [],
        },
      },
    }));
  }
}
