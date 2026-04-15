/**
 * Token Counter
 * Estimates token counts for text and messages
 *
 * Uses a simple approximation: ~4 characters ≈ 1 token
 * This is a reasonable estimate for English text with GPT-style tokenizers.
 * For more accuracy, consider using js-tiktoken in the future.
 */

import type { Message, ToolCall, ToolResult } from '../types';
import { MODEL_CONTEXT_LIMITS, getModelContextWindow } from '../providers/models';

export { MODEL_CONTEXT_LIMITS };

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
  return getModelContextWindow(model);
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
