/**
 * Execute Command Tool
 * Execute shell commands with safety measures
 */

import { spawn } from 'child_process';
import { resolve, isAbsolute } from 'path';
import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

// Commands that are never allowed
const BLOCKED_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  'format c:',
  'mkfs',
  ':(){:|:&};:',
  'dd if=/dev/zero',
  'chmod -R 777 /',
  '> /dev/sda',
];

// Potentially dangerous commands that need confirmation in a real app
const DANGEROUS_PATTERNS = [
  /rm\s+-rf?\s+[\/~]/,
  /sudo\s+rm/,
  />\s*\/etc\//,
  /chmod\s+-R/,
  /chown\s+-R/,
];

export const executeCommandTool: ToolDefinition = {
  name: 'execute_command',
  description: 'Execute a shell command and return its output. Use for running build commands, tests, git operations, etc.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for the command (default: current directory)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000, max: 300000)',
      },
    },
    required: ['command'],
  },

  async execute(
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    // Check mode - command execution not allowed in plan mode
    if (context.mode === 'plan') {
      return {
        success: false,
        output: '',
        error: 'Command execution is not allowed in PLAN mode. Switch to BUILD mode to run commands.',
      };
    }

    const command = args.command as string;
    const cwd = args.cwd as string | undefined;
    const timeout = Math.min((args.timeout as number) ?? 30000, 300000);

    // Security checks
    const lowerCommand = command.toLowerCase();
    
    for (const blocked of BLOCKED_COMMANDS) {
      if (lowerCommand.includes(blocked.toLowerCase())) {
        return {
          success: false,
          output: '',
          error: `Command blocked for safety: ${command}`,
        };
      }
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return {
          success: false,
          output: '',
          error: `Potentially dangerous command blocked: ${command}. Please review and run manually if intended.`,
        };
      }
    }

    const workDir = cwd
      ? isAbsolute(cwd)
        ? cwd
        : resolve(context.workingDirectory, cwd)
      : context.workingDirectory;

    try {
      const result = await runCommand(command, workDir, timeout, context.abortSignal);
      return result;
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

function runCommand(
  command: string,
  cwd: string,
  timeout: number,
  abortSignal?: AbortSignal
): Promise<ToolExecutionResult> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'powershell.exe' : '/bin/sh';
    const shellArgs = isWindows ? ['-Command', command] : ['-c', command];

    const proc = spawn(shell, shellArgs, {
      cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
    }, timeout);

    const cleanup = () => {
      clearTimeout(timeoutId);
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        killed = true;
        proc.kill('SIGTERM');
      });
    }

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      cleanup();

      if (killed) {
        resolve({
          success: false,
          output: stdout,
          error: 'Command was terminated (timeout or abort)',
        });
        return;
      }

      // Combine stdout and stderr for output
      let output = '';
      if (stdout) output += stdout;
      if (stderr) output += (output ? '\n\n[stderr]:\n' : '[stderr]:\n') + stderr;

      if (code === 0) {
        resolve({
          success: true,
          output: output || '(command completed with no output)',
        });
      } else {
        resolve({
          success: false,
          output,
          error: `Command exited with code ${code}`,
        });
      }
    });

    proc.on('error', (err) => {
      cleanup();
      resolve({
        success: false,
        output: '',
        error: `Failed to execute command: ${err.message}`,
      });
    });
  });
}
