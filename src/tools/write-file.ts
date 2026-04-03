/**
 * Write File Tool
 * Writes or creates files with content
 */

import { writeFile, mkdir } from 'fs/promises';
import { resolve, isAbsolute, dirname } from 'path';
import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

export const writeFileTool: ToolDefinition = {
  name: 'write_file',
  description: 'Write content to a file. Creates the file if it does not exist, overwrites if it does. Creates parent directories if needed.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to write (relative to working directory or absolute)',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
      append: {
        type: 'boolean',
        description: 'If true, append to file instead of overwriting (default: false)',
      },
    },
    required: ['path', 'content'],
  },

  async execute(
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    // Check mode - write is not allowed in plan mode
    if (context.mode === 'plan') {
      return {
        success: false,
        output: '',
        error: 'Write operations are not allowed in PLAN mode. Switch to BUILD mode to modify files.',
      };
    }

    const path = args.path as string;
    const content = args.content as string;
    const append = args.append as boolean | undefined;

    try {
      const fullPath = isAbsolute(path)
        ? path
        : resolve(context.workingDirectory, path);

      // Ensure parent directory exists
      const dir = dirname(fullPath);
      await mkdir(dir, { recursive: true });

      // Write or append to file
      if (append) {
        const { appendFile } = await import('fs/promises');
        await appendFile(fullPath, content, 'utf-8');
        return {
          success: true,
          output: `Appended ${content.length} characters to ${path}`,
        };
      }

      await writeFile(fullPath, content, 'utf-8');
      
      const lineCount = content.split('\n').length;
      return {
        success: true,
        output: `Wrote ${content.length} characters (${lineCount} lines) to ${path}`,
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      
      if (err.code === 'EACCES') {
        return {
          success: false,
          output: '',
          error: `Permission denied: ${path}`,
        };
      }

      return {
        success: false,
        output: '',
        error: `Failed to write file: ${err.message}`,
      };
    }
  },
};
