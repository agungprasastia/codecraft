/**
 * Anthropic (Claude) Provider implementation
 * Supports Claude 3 Opus, Sonnet, Haiku
 */

import type { 
  Message, 
  ToolDefinition, 
  StreamChunk, 
  ProviderConfig,
  ToolCall 
} from '../types';
import { BaseProvider } from './base';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export class AnthropicProvider extends BaseProvider {
  name = 'anthropic';
  private baseUrl = 'https://api.anthropic.com/v1';

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    onChunk: (chunk: StreamChunk) => void,
    abortSignal?: AbortSignal
  ): Promise<Message> {
    const { systemPrompt, anthropicMessages } = this.convertMessages(messages);
    const anthropicTools = this.convertTools(tools);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens ?? 4096,
        system: systemPrompt,
        messages: anthropicMessages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
        stream: true,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let content = '';
    const toolCalls: ToolCall[] = [];
    let currentToolUse: Partial<ToolCall> | null = null;
    let inputJsonBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);

          if (event.type === 'content_block_start') {
            if (event.content_block?.type === 'tool_use') {
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                arguments: {},
              };
              inputJsonBuffer = '';
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta?.type === 'text_delta') {
              content += event.delta.text;
              onChunk({ type: 'text', content: event.delta.text });
            } else if (event.delta?.type === 'input_json_delta' && currentToolUse) {
              inputJsonBuffer += event.delta.partial_json;
              onChunk({ type: 'tool_call_delta', toolCall: currentToolUse });
            }
          } else if (event.type === 'content_block_stop') {
            if (currentToolUse) {
              try {
                currentToolUse.arguments = JSON.parse(inputJsonBuffer) as Record<string, unknown>;
              } catch {
                currentToolUse.arguments = {};
              }
              
              const finalToolCall: ToolCall = {
                id: currentToolUse.id!,
                name: currentToolUse.name!,
                arguments: currentToolUse.arguments as Record<string, unknown>,
              };
              toolCalls.push(finalToolCall);
              onChunk({ type: 'tool_call', toolCall: finalToolCall });
              currentToolUse = null;
            }
          }
        } catch {
          // Ignore JSON parse errors for incomplete chunks
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

  private convertMessages(messages: Message[]): { 
    systemPrompt: string; 
    anthropicMessages: AnthropicMessage[] 
  } {
    let systemPrompt = '';
    const anthropicMessages: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += msg.content + '\n';
      } else if (msg.role === 'user') {
        anthropicMessages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        const contentBlocks: AnthropicContentBlock[] = [];
        
        if (msg.content) {
          contentBlocks.push({ type: 'text', text: msg.content });
        }
        
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            contentBlocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          }
        }

        anthropicMessages.push({
          role: 'assistant',
          content: contentBlocks.length === 1 && contentBlocks[0].type === 'text'
            ? contentBlocks[0].text!
            : contentBlocks,
        });
      } else if (msg.role === 'tool' && msg.toolResults) {
        const contentBlocks: AnthropicContentBlock[] = msg.toolResults.map((tr) => ({
          type: 'tool_result' as const,
          tool_use_id: tr.toolCallId,
          content: tr.result,
        }));

        anthropicMessages.push({ role: 'user', content: contentBlocks });
      }
    }

    return { systemPrompt: systemPrompt.trim(), anthropicMessages };
  }

  private convertTools(tools: ToolDefinition[]): AnthropicTool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    }));
  }
}
