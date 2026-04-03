/**
 * Chat Input component
 * Text input with submit handling
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface ChatInputProps {
  onSubmit: (value: string) => void;
  isDisabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSubmit, isDisabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (input: string) => {
    const trimmed = input.trim();
    if (trimmed && !isDisabled) {
      onSubmit(trimmed);
      setValue('');
    }
  };

  return (
    <Box paddingX={1}>
      <Text color={isDisabled ? 'gray' : 'cyan'} bold>
        {'> '}
      </Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={placeholder}
      />
    </Box>
  );
}
