/**
 * Header component
 * Shows app title and current configuration
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { AgentMode } from '../types';

interface HeaderProps {
  mode: AgentMode;
  model: string;
  provider: string;
}

export function Header({ mode, model, provider }: HeaderProps) {
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box>
        <Text color="cyan" bold>
          Codecraft
        </Text>
        <Text color="gray"> | AI Coding Agent</Text>
      </Box>

      <Box>
        <Text color="gray">
          {provider}/{model}
        </Text>
        <Text color="gray"> | </Text>
        <Text color={mode === 'build' ? 'green' : 'yellow'} bold>
          {mode.toUpperCase()}
        </Text>
      </Box>
    </Box>
  );
}
