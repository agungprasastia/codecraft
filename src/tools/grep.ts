/**
 * Grep Tool
 * Search for patterns in file contents
 */

import { readFile } from 'fs/promises';
import { globby } from 'globby';
import { resolve, isAbsolute } from 'path';
import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

export const grepTool: ToolDefinition = {
  name: 'grep',
  description: 'Search for a pattern in file contents. Returns matching lines with file names and line numbers.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Text or regex pattern to search for',
      },
      filePattern: {
        type: 'string',
        description: 'Glob pattern for files to search (default: "**/*")',
      },
      cwd: {
        type: 'string',
        description: 'Directory to search in (default: current directory)',
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Case-sensitive search (default: false)',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 50)',
      },
      context: {
        type: 'number',
        description: 'Number of context lines before and after match (default: 0)',
      },
    },
    required: ['pattern'],
  },

  async execute(
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    const pattern = args.pattern as string;
    const filePattern = (args.filePattern as string) || '**/*';
    const cwd = args.cwd as string | undefined;
    const caseSensitive = (args.caseSensitive as boolean) ?? false;
    const maxResults = (args.maxResults as number) ?? 50;
    const contextLines = (args.context as number) ?? 0;

    try {
      const searchDir = cwd
        ? isAbsolute(cwd)
          ? cwd
          : resolve(context.workingDirectory, cwd)
        : context.workingDirectory;

      // Find files to search
      const files = await globby(filePattern, {
        cwd: searchDir,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/*.min.js',
          '**/*.min.css',
          '**/package-lock.json',
          '**/yarn.lock',
          '**/pnpm-lock.yaml',
        ],
        dot: false,
        onlyFiles: true,
        absolute: true,
      });

      // Create regex
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      } catch {
        // If invalid regex, treat as literal string
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
      }

      const matches: GrepMatch[] = [];
      let filesSearched = 0;
      let totalMatches = 0;

      for (const file of files) {
        if (matches.length >= maxResults) break;

        try {
          const content = await readFile(file, 'utf-8');
          const lines = content.split('\n');
          filesSearched++;

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              totalMatches++;
              
              if (matches.length < maxResults) {
                const relativePath = file.startsWith(searchDir)
                  ? file.slice(searchDir.length + 1)
                  : file;

                // Add context if requested
                if (contextLines > 0) {
                  const start = Math.max(0, i - contextLines);
                  const end = Math.min(lines.length - 1, i + contextLines);
                  const contextContent = lines
                    .slice(start, end + 1)
                    .map((line, idx) => {
                      const lineNum = start + idx + 1;
                      const marker = lineNum === i + 1 ? '>' : ' ';
                      return `${marker} ${lineNum}: ${line}`;
                    })
                    .join('\n');

                  matches.push({
                    file: relativePath,
                    line: i + 1,
                    content: contextContent,
                  });
                } else {
                  matches.push({
                    file: relativePath,
                    line: i + 1,
                    content: lines[i],
                  });
                }
              }
            }
            
            // Reset regex lastIndex for global patterns
            regex.lastIndex = 0;
          }
        } catch {
          // Skip files we can't read (binary, permissions, etc.)
        }
      }

      if (matches.length === 0) {
        return {
          success: true,
          output: `No matches found for "${pattern}" in ${filesSearched} files`,
        };
      }

      let output = `Found ${totalMatches} match(es) for "${pattern}"`;
      if (totalMatches > maxResults) {
        output += ` (showing first ${maxResults})`;
      }
      output += `:\n\n`;

      for (const match of matches) {
        if (contextLines > 0) {
          output += `${match.file}:\n${match.content}\n\n`;
        } else {
          output += `${match.file}:${match.line}: ${match.content}\n`;
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
        error: `Grep failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
