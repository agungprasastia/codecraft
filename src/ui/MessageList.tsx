/**
 * Message List component
 * Displays conversation history with streaming support
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { Message } from '../types';

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  isProcessing: boolean;
}

export function MessageList({ messages, streamingContent, isProcessing }: MessageListProps) {
  // Show last N messages to avoid filling the screen
  const visibleMessages = messages.slice(-20);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleMessages.length === 0 && !isProcessing && (
        <Box justifyContent="center" marginY={2}>
          <Text color="gray" italic>
            Start a conversation by typing a message below...
          </Text>
        </Box>
      )}

      {visibleMessages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {/* Streaming content */}
      {streamingContent && (
        <Box marginY={1}>
          <Box marginRight={1}>
            <Text color="green" bold>
              🤖
            </Text>
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            <Text>{streamingContent}</Text>
            <Text color="gray">
              <Spinner type="dots" />
            </Text>
          </Box>
        </Box>
      )}

      {/* Processing indicator when no streaming content yet */}
      {isProcessing && !streamingContent && (
        <Box marginY={1}>
          <Text color="cyan">
            <Spinner type="dots" /> Thinking...
          </Text>
        </Box>
      )}
    </Box>
  );
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';

  if (isSystem) {
    return (
      <Box marginY={1} justifyContent="center">
        <Text color="yellow" italic>
          ⚙ {message.content}
        </Text>
      </Box>
    );
  }

  if (isTool && message.toolResults) {
    return (
      <Box flexDirection="column" marginY={1}>
        {message.toolResults.map((result) => (
          <Box key={result.toolCallId} marginLeft={3}>
            <Text color={result.isError ? 'red' : 'gray'}>
              {result.isError ? '✗' : '✓'} {result.name}:{' '}
              {truncateOutput(result.result, 200)}
            </Text>
          </Box>
        ))}
      </Box>
    );
  }

  const icon = isUser ? '👤' : '🤖';
  const color = isUser ? 'blue' : 'green';

  return (
    <Box marginY={1}>
      <Box marginRight={1}>
        <Text color={color} bold>
          {icon}
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        <Text wrap="wrap">{message.content}</Text>
        
        {/* Show tool calls if any */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {message.toolCalls.map((tool) => (
              <Text key={tool.id} color="magenta">
                🔧 Calling {tool.name}({formatArgs(tool.arguments)})
              </Text>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function truncateOutput(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return '';
  
  return entries
    .map(([key, value]) => {
      const strValue = typeof value === 'string' 
        ? truncateOutput(value, 30)
        : JSON.stringify(value);
      return `${key}=${strValue}`;
    })
    .join(', ');
}
