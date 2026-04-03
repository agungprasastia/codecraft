/**
 * Token Counter
 * Estimates token counts for text and messages
 *
 * Uses a simple approximation: ~4 characters ≈ 1 token
 * This is a reasonable estimate for English text with GPT-style tokenizers.
 * For more accuracy, consider using js-tiktoken in the future.
 */

import type { Message, ToolCall, ToolResult } from '../types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Average characters per token for GPT-style tokenizers
 * This is an approximation - actual ratio varies by language and content
 */
const CHARS_PER_TOKEN = 4;

/**
 * Overhead tokens per message (role, formatting, etc.)
 * OpenAI models add ~4 tokens per message for metadata
 */
const MESSAGE_OVERHEAD = 4;

/**
 * Default context limits by model family
 * These are conservative estimates leaving room for response
 */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // OpenAI
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,

  // Anthropic
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,
  'claude-3-5-sonnet-20240620': 200000,
  'claude-3-5-sonnet-20241022': 200000,

  // Google
  'gemini-pro': 32760,
  'gemini-1.5-pro': 1000000,
  'gemini-1.5-flash': 1000000,

  // Ollama (common models)
  llama2: 4096,
  'llama2:70b': 4096,
  mistral: 8192,
  'mixtral:8x7b': 32768,
  codellama: 16384,

  // Default fallback
  default: 8192,
};

// ============================================================================
// Token Counting Functions
// ============================================================================

/**
 * Count tokens in a text string using character approximation
 * @param text - The text to count tokens for
 * @returns Estimated token count
 */
export function countTokens(text: string): number {
  if (!text) {
    return 0;
  }
  // Simple approximation: ~4 characters per token
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Count tokens in a tool call
 * @param toolCall - The tool call to count
 * @returns Estimated token count
 */
export function countToolCallTokens(toolCall: ToolCall): number {
  // Tool name + arguments serialized
  const argsStr = JSON.stringify(toolCall.arguments);
  return countTokens(toolCall.name) + countTokens(argsStr) + MESSAGE_OVERHEAD;
}

/**
 * Count tokens in a tool result
 * @param toolResult - The tool result to count
 * @returns Estimated token count
 */
export function countToolResultTokens(toolResult: ToolResult): number {
  return countTokens(toolResult.name) + countTokens(toolResult.result) + MESSAGE_OVERHEAD;
}

/**
 * Count tokens in a single message including tool calls/results
 * @param message - The message to count
 * @returns Estimated token count
 */
export function countMessageTokens(message: Message): number {
  let tokens = MESSAGE_OVERHEAD;

  // Content tokens
  tokens += countTokens(message.content);

  // Tool calls tokens
  if (message.toolCalls) {
    for (const toolCall of message.toolCalls) {
      tokens += countToolCallTokens(toolCall);
    }
  }

  // Tool results tokens
  if (message.toolResults) {
    for (const toolResult of message.toolResults) {
      tokens += countToolResultTokens(toolResult);
    }
  }

  return tokens;
}

/**
 * Count total tokens in an array of messages
 * @param messages - The messages to count
 * @returns Estimated total token count
 */
export function countMessagesTokens(messages: Message[]): number {
  let total = 0;
  for (const message of messages) {
    total += countMessageTokens(message);
  }
  return total;
}

/**
 * Get the context limit for a model
 * @param model - The model name
 * @returns The context limit in tokens
 */
export function getModelContextLimit(model: string): number {
  // Try exact match first
  if (MODEL_CONTEXT_LIMITS[model]) {
    return MODEL_CONTEXT_LIMITS[model];
  }

  // Try prefix match (e.g., "gpt-4-turbo-2024-04-09" matches "gpt-4-turbo")
  const normalizedModel = model.toLowerCase();
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (normalizedModel.startsWith(key.toLowerCase())) {
      return limit;
    }
  }

  // Return default
  return MODEL_CONTEXT_LIMITS.default;
}

// ============================================================================
// Token Usage Info
// ============================================================================

export interface TokenUsage {
  current: number;
  limit: number;
  remaining: number;
  percentUsed: number;
}

/**
 * Calculate token usage for current conversation
 * @param messages - Current conversation messages
 * @param model - The model being used
 * @returns Token usage information
 */
export function getTokenUsage(messages: Message[], model: string): TokenUsage {
  const current = countMessagesTokens(messages);
  const limit = getModelContextLimit(model);
  const remaining = Math.max(0, limit - current);
  const percentUsed = Math.round((current / limit) * 100);

  return {
    current,
    limit,
    remaining,
    percentUsed,
  };
}

/**
 * Format token usage for display
 * @param usage - Token usage info
 * @returns Formatted string for TUI display
 */
export function formatTokenUsage(usage: TokenUsage): string {
  const formatNumber = (n: number): string => n.toLocaleString();

  return [
    'Token Usage:',
    `  Current: ${formatNumber(usage.current)} tokens`,
    `  Model limit: ${formatNumber(usage.limit)} tokens`,
    `  Remaining: ${formatNumber(usage.remaining)} tokens (${100 - usage.percentUsed}%)`,
  ].join('\n');
}
