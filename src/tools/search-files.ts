/**
 * Search Files Tool
 * Search for files by name pattern using glob
 */

import { globby } from 'globby';
import { resolve, isAbsolute, relative } from 'path';
import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

export const searchFilesTool: ToolDefinition = {
  name: 'search_files',
  description: 'Search for files matching a glob pattern. Returns list of matching file paths.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to match files (e.g., "**/*.ts", "src/**/*.js", "*.md")',
      },
      cwd: {
        type: 'string',
        description: 'Directory to search in (relative to working directory or absolute). Defaults to current directory.',
      },
      ignore: {
        type: 'array',
        description: 'Patterns to ignore (default: node_modules, .git, dist)',
        items: {
          type: 'string',
          description: 'Glob pattern to ignore',
        },
      },
    },
    required: ['pattern'],
  },

  async execute(
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    const pattern = args.pattern as string;
    const cwd = args.cwd as string | undefined;
    const customIgnore = args.ignore as string[] | undefined;

    try {
      const searchDir = cwd
        ? isAbsolute(cwd)
          ? cwd
          : resolve(context.workingDirectory, cwd)
        : context.workingDirectory;

      const ignorePatterns = customIgnore ?? [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.venv/**',
        '**/venv/**',
        '**/__pycache__/**',
        '**/coverage/**',
      ];

      const files = await globby(pattern, {
        cwd: searchDir,
        ignore: ignorePatterns,
        dot: false,
        onlyFiles: true,
        absolute: false,
      });

      if (files.length === 0) {
        return {
          success: true,
          output: `No files found matching pattern: ${pattern}`,
        };
      }

      // Sort files for consistent output
      files.sort();

      // Group by directory for better readability
      const grouped = new Map<string, string[]>();
      for (const file of files) {
        const dir = file.includes('/') ? file.substring(0, file.lastIndexOf('/')) : '.';
        if (!grouped.has(dir)) {
          grouped.set(dir, []);
        }
        grouped.get(dir)!.push(file);
      }

      let output = `Found ${files.length} file(s) matching "${pattern}":\n\n`;

      // If many files, just list them
      if (files.length <= 50) {
        for (const file of files) {
          output += `  ${file}\n`;
        }
      } else {
        // For many files, show summary by directory
        output += `(Showing summary - ${files.length} files in ${grouped.size} directories)\n\n`;
        for (const [dir, dirFiles] of grouped) {
          output += `${dir}/: ${dirFiles.length} file(s)\n`;
          // Show first few files in each directory
          const preview = dirFiles.slice(0, 3);
          for (const file of preview) {
            output += `  ${file}\n`;
          }
          if (dirFiles.length > 3) {
            output += `  ... and ${dirFiles.length - 3} more\n`;
          }
        }
      }

      return {
        success: true,
        output,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
