/**
 * Tool Test Utilities
 * Mock context factory and helpers for testing tools
 */

import { vi } from 'vitest';
import type { ToolContext, ToolExecutionResult, AgentMode } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Creates a mock ToolContext for testing
 */
export function createMockContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    workingDirectory: process.cwd(),
    mode: 'build' as AgentMode,
    abortSignal: undefined,
    ...overrides,
  };
}

/**
 * Creates a mock ToolContext in PLAN mode (read-only)
 */
export function createPlanModeContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return createMockContext({
    mode: 'plan',
    ...overrides,
  });
}

/**
 * Creates a mock ToolContext with abort signal
 */
export function createAbortableContext(): {
  context: ToolContext;
  abort: () => void;
} {
  const controller = new AbortController();
  return {
    context: createMockContext({ abortSignal: controller.signal }),
    abort: () => controller.abort(),
  };
}

/**
 * Creates a temporary directory for testing file operations
 */
export async function createTempDir(prefix = 'codecraft-test-'): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `${prefix}${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Cleans up a temporary directory
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Creates a test file with content
 */
export async function createTestFile(
  dirPath: string,
  filename: string,
  content: string
): Promise<string> {
  const filePath = path.join(dirPath, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Creates multiple test files
 */
export async function createTestFiles(
  dirPath: string,
  files: Record<string, string>
): Promise<Record<string, string>> {
  const paths: Record<string, string> = {};
  for (const [filename, content] of Object.entries(files)) {
    paths[filename] = await createTestFile(dirPath, filename, content);
  }
  return paths;
}

/**
 * Asserts that a tool execution was successful
 */
export function assertSuccess(result: ToolExecutionResult): asserts result is ToolExecutionResult & { success: true } {
  if (!result.success) {
    throw new Error(`Expected success but got error: ${result.error}`);
  }
}

/**
 * Asserts that a tool execution failed
 */
export function assertError(result: ToolExecutionResult): asserts result is ToolExecutionResult & { success: false } {
  if (result.success) {
    throw new Error(`Expected error but got success: ${result.output}`);
  }
}

/**
 * Mock file system for isolated testing
 */
export class MockFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  addFile(filePath: string, content: string): void {
    this.files.set(path.normalize(filePath), content);
    // Add parent directories
    let dir = path.dirname(filePath);
    while (dir && dir !== '.' && dir !== '/') {
      this.directories.add(path.normalize(dir));
      dir = path.dirname(dir);
    }
  }

  addDirectory(dirPath: string): void {
    this.directories.add(path.normalize(dirPath));
  }

  getFile(filePath: string): string | undefined {
    return this.files.get(path.normalize(filePath));
  }

  hasFile(filePath: string): boolean {
    return this.files.has(path.normalize(filePath));
  }

  hasDirectory(dirPath: string): boolean {
    return this.directories.has(path.normalize(dirPath));
  }

  listDirectory(dirPath: string): string[] {
    const normalizedDir = path.normalize(dirPath);
    const entries: string[] = [];
    
    for (const filePath of this.files.keys()) {
      if (path.dirname(filePath) === normalizedDir) {
        entries.push(path.basename(filePath));
      }
    }
    
    for (const dir of this.directories) {
      if (path.dirname(dir) === normalizedDir) {
        entries.push(path.basename(dir));
      }
    }
    
    return [...new Set(entries)];
  }

  clear(): void {
    this.files.clear();
    this.directories.clear();
  }
}

/**
 * Creates a spy on console methods for testing output
 */
export function spyOnConsole() {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  return {
    log,
    error,
    warn,
    restore: () => {
      log.mockRestore();
      error.mockRestore();
      warn.mockRestore();
    },
    getLogCalls: () => log.mock.calls.map(args => args.join(' ')),
    getErrorCalls: () => error.mock.calls.map(args => args.join(' ')),
  };
}

/**
 * Wait for a specified time (useful for async tests)
 */
export const wait = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Create a deferred promise for testing async behavior
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return { promise, resolve, reject };
}
