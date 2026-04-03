/**
 * List Directory Tool
 * Lists contents of a directory with optional filtering
 */

import { readdir, stat } from 'fs/promises';
import { resolve, isAbsolute, join } from 'path';
import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

interface FileInfo {
  name: string;
  type: 'file' | 'directory';
  size?: number;
}

export const listDirectoryTool: ToolDefinition = {
  name: 'list_directory',
  description: 'List the contents of a directory. Shows files and subdirectories with their types.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the directory to list (relative to working directory or absolute). Defaults to current directory.',
      },
      recursive: {
        type: 'boolean',
        description: 'If true, list contents recursively (default: false, max depth: 3)',
      },
      showHidden: {
        type: 'boolean',
        description: 'If true, show hidden files starting with . (default: false)',
      },
    },
    required: [],
  },

  async execute(
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    const path = (args.path as string) || '.';
    const recursive = args.recursive as boolean | undefined;
    const showHidden = args.showHidden as boolean | undefined;

    try {
      const fullPath = isAbsolute(path)
        ? path
        : resolve(context.workingDirectory, path);

      const entries = await listDir(fullPath, {
        recursive: recursive ?? false,
        showHidden: showHidden ?? false,
        maxDepth: 3,
        currentDepth: 0,
      });

      if (entries.length === 0) {
        return {
          success: true,
          output: `Directory ${path} is empty`,
        };
      }

      const output = formatEntries(entries, fullPath);

      return {
        success: true,
        output: `Contents of ${path}:\n\n${output}`,
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;

      if (err.code === 'ENOENT') {
        return {
          success: false,
          output: '',
          error: `Directory not found: ${path}`,
        };
      }

      if (err.code === 'ENOTDIR') {
        return {
          success: false,
          output: '',
          error: `Path is not a directory: ${path}`,
        };
      }

      return {
        success: false,
        output: '',
        error: `Failed to list directory: ${err.message}`,
      };
    }
  },
};

interface ListOptions {
  recursive: boolean;
  showHidden: boolean;
  maxDepth: number;
  currentDepth: number;
}

interface TreeEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: TreeEntry[];
  relativePath: string;
}

async function listDir(
  dirPath: string,
  options: ListOptions,
  relativePath = ''
): Promise<TreeEntry[]> {
  const entries: TreeEntry[] = [];
  const items = await readdir(dirPath);

  // Common directories to skip for cleaner output
  const skipDirs = ['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build'];

  for (const item of items) {
    // Skip hidden files unless requested
    if (!options.showHidden && item.startsWith('.')) {
      continue;
    }

    const itemPath = join(dirPath, item);
    const itemRelativePath = relativePath ? `${relativePath}/${item}` : item;

    try {
      const stats = await stat(itemPath);
      const isDirectory = stats.isDirectory();

      const entry: TreeEntry = {
        name: item,
        type: isDirectory ? 'directory' : 'file',
        size: isDirectory ? undefined : stats.size,
        relativePath: itemRelativePath,
      };

      if (isDirectory && options.recursive && options.currentDepth < options.maxDepth) {
        // Skip common large directories
        if (!skipDirs.includes(item)) {
          entry.children = await listDir(itemPath, {
            ...options,
            currentDepth: options.currentDepth + 1,
          }, itemRelativePath);
        } else {
          entry.children = []; // Indicate it's a directory but don't recurse
        }
      }

      entries.push(entry);
    } catch {
      // Skip items we can't stat
    }
  }

  // Sort: directories first, then alphabetically
  entries.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return entries;
}

function formatEntries(entries: TreeEntry[], _basePath: string, indent = ''): string {
  const lines: string[] = [];

  for (const entry of entries) {
    const icon = entry.type === 'directory' ? '📁' : '📄';
    const size = entry.size !== undefined ? ` (${formatSize(entry.size)})` : '';
    
    lines.push(`${indent}${icon} ${entry.name}${size}`);

    if (entry.children && entry.children.length > 0) {
      lines.push(formatEntries(entry.children, _basePath, indent + '  '));
    }
  }

  return lines.join('\n');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
