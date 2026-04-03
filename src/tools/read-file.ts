/**
 * Read File Tool
 * Reads content from files with optional line range
 */

import { readFile } from 'fs/promises';
import { resolve, isAbsolute } from 'path';
import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file. Can read entire file or specific line range.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read (relative to working directory or absolute)',
      },
      startLine: {
        type: 'number',
        description: 'Starting line number (1-indexed, optional)',
      },
      endLine: {
        type: 'number',
        description: 'Ending line number (inclusive, optional)',
      },
    },
    required: ['path'],
  },

  async execute(
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    const path = args.path as string;
    const startLine = args.startLine as number | undefined;
    const endLine = args.endLine as number | undefined;

    try {
      const fullPath = isAbsolute(path)
        ? path
        : resolve(context.workingDirectory, path);

      const content = await readFile(fullPath, 'utf-8');
      
      let lines = content.split('\n');
      const totalLines = lines.length;

      // Apply line range if specified
      if (startLine !== undefined || endLine !== undefined) {
        const start = Math.max(1, startLine ?? 1) - 1;
        const end = Math.min(totalLines, endLine ?? totalLines);
        lines = lines.slice(start, end);
        
        // Add line numbers
        const output = lines
          .map((line, i) => `${start + i + 1}: ${line}`)
          .join('\n');

        return {
          success: true,
          output: `File: ${path} (lines ${start + 1}-${end} of ${totalLines})\n\n${output}`,
        };
      }

      // For full file, add line numbers if file is small enough
      if (totalLines <= 500) {
        const output = lines
          .map((line, i) => `${i + 1}: ${line}`)
          .join('\n');

        return {
          success: true,
          output: `File: ${path} (${totalLines} lines)\n\n${output}`,
        };
      }

      // For large files, truncate and suggest using line range
      const truncatedOutput = lines
        .slice(0, 100)
        .map((line, i) => `${i + 1}: ${line}`)
        .join('\n');

      return {
        success: true,
        output: `File: ${path} (${totalLines} lines - showing first 100)\n\n${truncatedOutput}\n\n... truncated. Use startLine/endLine to read specific sections.`,
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      
      if (err.code === 'ENOENT') {
        return {
          success: false,
          output: '',
          error: `File not found: ${path}`,
        };
      }
      
      if (err.code === 'EISDIR') {
        return {
          success: false,
          output: '',
          error: `Path is a directory, not a file: ${path}`,
        };
      }

      return {
        success: false,
        output: '',
        error: `Failed to read file: ${err.message}`,
      };
    }
  },
};
