/**
 * Google (Gemini) Provider implementation
 * Supports Gemini Pro, Gemini Flash, etc.
 */

import type { 
  Message, 
  ToolDefinition, 
  StreamChunk, 
  ProviderConfig,
  ToolCall 
} from '../types';
import { BaseProvider } from './base';

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: { result: string };
  };
}

interface GeminiTool {
  functionDeclarations: GeminiFunctionDeclaration[];
}

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export class GoogleProvider extends BaseProvider {
  name = 'google';
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
    onChunk: (chunk: StreamChunk) => void,
    abortSignal?: AbortSignal
  ): Promise<Message> {
    const { systemInstruction, contents } = this.convertMessages(messages);
    const geminiTools = this.convertTools(tools);

    const url = `${this.baseUrl}/models/${this.config.model}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`;
    
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: this.config.maxTokens ?? 4096,
        temperature: this.config.temperature ?? 0.7,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (geminiTools.length > 0) {
      body.tools = geminiTools;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let content = '';
    const toolCalls: ToolCall[] = [];
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // SSE format: "data: {...}\n\n"
      const lines = buffer.split('\n');
      buffer = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // If this line doesn't end a complete message, buffer it
        if (i === lines.length - 1 && line !== '') {
          buffer = line;
          continue;
        }

        if (!line.startsWith('data: ')) continue;
        
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const chunk = JSON.parse(jsonStr);
          
          if (chunk.candidates?.[0]?.content?.parts) {
            for (const part of chunk.candidates[0].content.parts) {
              if (part.text) {
                content += part.text;
                onChunk({ type: 'text', content: part.text });
              }
              
              if (part.functionCall) {
                const toolCall: ToolCall = {
                  id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
                  name: part.functionCall.name,
                  arguments: part.functionCall.args || {},
                };
                toolCalls.push(toolCall);
                onChunk({ type: 'tool_call', toolCall });
              }
            }
          }
        } catch {
          // Ignore JSON parse errors for incomplete chunks
        }
      }
    }

    // Process any remaining buffer
    if (buffer.startsWith('data: ')) {
      const jsonStr = buffer.slice(6).trim();
      if (jsonStr && jsonStr !== '[DONE]') {
        try {
          const chunk = JSON.parse(jsonStr);
          if (chunk.candidates?.[0]?.content?.parts) {
            for (const part of chunk.candidates[0].content.parts) {
              if (part.text) {
                content += part.text;
                onChunk({ type: 'text', content: part.text });
              }
            }
          }
        } catch {
          // Ignore
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
    systemInstruction: string; 
    contents: GeminiContent[] 
  } {
    let systemInstruction = '';
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction += msg.content + '\n';
      } else if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        const parts: GeminiPart[] = [];
        
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            parts.push({
              functionCall: {
                name: tc.name,
                args: tc.arguments,
              },
            });
          }
        }

        if (parts.length > 0) {
          contents.push({ role: 'model', parts });
        }
      } else if (msg.role === 'tool' && msg.toolResults) {
        const parts: GeminiPart[] = msg.toolResults.map((tr) => ({
          functionResponse: {
            name: tr.name,
            response: { result: tr.result },
          },
        }));

        contents.push({ role: 'user', parts });
      }
    }

    return { systemInstruction: systemInstruction.trim(), contents };
  }

  private convertTools(tools: ToolDefinition[]): GeminiTool[] {
    if (tools.length === 0) return [];

    return [{
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object' as const,
          properties: tool.parameters.properties,
          required: tool.parameters.required,
        },
      })),
    }];
  }
}
