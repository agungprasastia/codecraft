/**
 * Status Bar component
 * Shows current status, mode, and tool execution
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ToolCall, AgentMode } from '../types';

interface StatusBarProps {
  isProcessing: boolean;
  currentTool: ToolCall | null;
  mode: AgentMode;
  sessionId?: string;
}

export function StatusBar({ isProcessing, currentTool, mode, sessionId }: StatusBarProps) {
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box>
        {isProcessing ? (
          currentTool ? (
            <Text color="yellow">
              <Spinner type="dots" /> Running {currentTool.name}...
            </Text>
          ) : (
            <Text color="cyan">
              <Spinner type="dots" /> Processing...
            </Text>
          )
        ) : (
          <Text color="gray">Ready</Text>
        )}
      </Box>

      <Box>
        <Text color="gray">
          Mode:{' '}
          <Text color={mode === 'build' ? 'green' : 'yellow'} bold>
            {mode.toUpperCase()}
          </Text>
        </Text>
        <Text color="gray"> | </Text>
        <Text color="gray">Session: {sessionId ?? 'none'}</Text>
        <Text color="gray"> | </Text>
        <Text color="gray">Ctrl+C: Exit | /help: Commands</Text>
      </Box>
    </Box>
  );
}
