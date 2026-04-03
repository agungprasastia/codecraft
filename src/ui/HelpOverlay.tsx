/**
 * Help Overlay component
 * Shows available commands and shortcuts
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';

interface HelpOverlayProps {
  onClose: () => void;
}

export function HelpOverlay({ onClose }: HelpOverlayProps) {
  useInput((input, key) => {
    if (key.escape || input === 'q' || input === '?') {
      onClose();
    }
  });

  return (
    <Box flexDirection="column" padding={2}>
      <Box paddingX={2} marginBottom={1}>
        <Text color="cyan" bold>
          === Codecraft Help ===
        </Text>
      </Box>

      <Box flexDirection="column" paddingX={2}>
        <Text color="yellow" bold>
          Commands:
        </Text>
        <Box flexDirection="column" marginLeft={2} marginY={1}>
          <HelpItem command="/help" description="Show this help screen" />
          <HelpItem command="/clear" description="Clear conversation history" />
          <HelpItem command="/sessions" description="List saved sessions" />
          <HelpItem command="/resume [id]" description="Resume a saved session or the latest one" />
          <HelpItem command="/delete <id>" description="Delete a saved session" />
          <HelpItem command="/mode build" description="Switch to BUILD mode (full access)" />
          <HelpItem command="/mode plan" description="Switch to PLAN mode (read-only)" />
          <HelpItem command="/exit" description="Exit Codecraft" />
        </Box>

        <Text color="yellow" bold>
          Keyboard Shortcuts:
        </Text>
        <Box flexDirection="column" marginLeft={2} marginY={1}>
          <HelpItem command="Ctrl+C" description="Cancel current operation / Exit" />
          <HelpItem command="Ctrl+L" description="Clear conversation history" />
          <HelpItem command="Escape" description="Cancel current operation" />
          <HelpItem command="?" description="Toggle help screen" />
        </Box>

        <Text color="yellow" bold>
          Modes:
        </Text>
        <Box flexDirection="column" marginLeft={2} marginY={1}>
          <Box>
            <Text color="green" bold>
              BUILD
            </Text>
            <Text color="gray"> - Full access to read/write files and execute commands</Text>
          </Box>
          <Box>
            <Text color="yellow" bold>
              PLAN
            </Text>
            <Text color="gray"> - Read-only mode for exploring and understanding code</Text>
          </Box>
        </Box>

        <Text color="yellow" bold>
          Available Tools:
        </Text>
        <Box flexDirection="column" marginLeft={2} marginY={1}>
          <HelpItem command="read_file" description="Read file contents" />
          <HelpItem command="write_file" description="Write to files (BUILD only)" />
          <HelpItem command="list_directory" description="List directory contents" />
          <HelpItem command="search_files" description="Search for files by pattern" />
          <HelpItem command="grep" description="Search in file contents" />
          <HelpItem command="execute_command" description="Run shell commands (BUILD only)" />
        </Box>
      </Box>

      <Box marginTop={2} justifyContent="center">
        <Text color="gray" italic>
          Press Escape, Q, or ? to close
        </Text>
      </Box>
    </Box>
  );
}

function HelpItem({ command, description }: { command: string; description: string }) {
  return (
    <Box>
      <Box width={20}>
        <Text color="cyan">{command}</Text>
      </Box>
      <Text color="gray">{description}</Text>
    </Box>
  );
}
