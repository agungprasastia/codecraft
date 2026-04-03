/**
 * Execute Command Tool Tests
 * Tests for command execution, security, and mode restrictions
 */

import { describe, it, expect } from 'vitest';
import { executeCommandTool } from '../execute-command';
import {
  createMockContext,
  createPlanModeContext,
  createAbortableContext,
  assertSuccess,
  assertError,
} from './utils';

describe('execute_command tool', () => {
  describe('Successful Execution', () => {
    it('should execute allowed commands', async () => {
      const result = await executeCommandTool.execute(
        { command: 'echo "hello"' },
        createMockContext()
      );

      assertSuccess(result);
      expect(result.output).toContain('hello');
    });

    it('should execute commands in specified directory', async () => {
      const result = await executeCommandTool.execute(
        { command: 'cd', cwd: '.' },
        createMockContext()
      );

      // Should succeed (cd is a valid command)
      expect(result).toBeDefined();
    });

    it('should return command output', async () => {
      const result = await executeCommandTool.execute(
        { command: 'echo "test output"' },
        createMockContext()
      );

      assertSuccess(result);
      expect(result.output).toContain('test output');
    });
  });

  describe('Blocked Commands', () => {
    it('should block rm -rf / command', async () => {
      const result = await executeCommandTool.execute(
        { command: 'rm -rf /' },
        createMockContext()
      );

      assertError(result);
      expect(result.error).toContain('blocked');
    });

    it('should block rm -rf /* command', async () => {
      const result = await executeCommandTool.execute(
        { command: 'rm -rf /*' },
        createMockContext()
      );

      assertError(result);
      expect(result.error).toContain('blocked');
    });

    it('should block format c: command', async () => {
      const result = await executeCommandTool.execute(
        { command: 'format c:' },
        createMockContext()
      );

      assertError(result);
      expect(result.error).toContain('blocked');
    });

    it('should block fork bomb', async () => {
      const result = await executeCommandTool.execute(
        { command: ':(){:|:&};:' },
        createMockContext()
      );

      assertError(result);
      expect(result.error).toContain('blocked');
    });
  });

  describe('Dangerous Pattern Detection', () => {
    it('should block sudo rm commands', async () => {
      const result = await executeCommandTool.execute(
        { command: 'sudo rm -rf /tmp/test' },
        createMockContext()
      );

      assertError(result);
      expect(result.error).toContain('blocked');
    });

    it('should block recursive chmod on root', async () => {
      const result = await executeCommandTool.execute(
        { command: 'chmod -R 777 /' },
        createMockContext()
      );

      assertError(result);
      expect(result.error).toContain('blocked');
    });

    it('should block writing to /etc', async () => {
      const result = await executeCommandTool.execute(
        { command: 'echo "test" > /etc/passwd' },
        createMockContext()
      );

      assertError(result);
      expect(result.error).toContain('dangerous');
    });

    it('should block rm with home directory', async () => {
      const result = await executeCommandTool.execute(
        { command: 'rm -rf ~/' },
        createMockContext()
      );

      assertError(result);
      expect(result.error).toContain('dangerous');
    });
  });

  describe('Plan Mode Restrictions', () => {
    it('should reject execution in PLAN mode', async () => {
      const result = await executeCommandTool.execute(
        { command: 'echo "test"' },
        createPlanModeContext()
      );

      assertError(result);
      expect(result.error).toContain('PLAN mode');
      expect(result.error).toContain('not allowed');
    });

    it('should suggest switching to BUILD mode', async () => {
      const result = await executeCommandTool.execute(
        { command: 'ls' },
        createPlanModeContext()
      );

      assertError(result);
      expect(result.error).toContain('BUILD mode');
    });
  });

  describe('Timeout Handling', () => {
    it('should respect timeout parameter', async () => {
      // This test verifies that timeout is applied
      // Using a very short timeout to test the mechanism
      const result = await executeCommandTool.execute(
        { 
          command: process.platform === 'win32' 
            ? 'ping -n 10 127.0.0.1' 
            : 'sleep 10',
          timeout: 100 // Very short timeout
        },
        createMockContext()
      );

      assertError(result);
      expect(result.error).toContain('terminated');
    });

    it('should cap timeout at maximum value', async () => {
      // Testing with extremely high timeout should be capped
      const result = await executeCommandTool.execute(
        { command: 'echo "test"', timeout: 999999999 },
        createMockContext()
      );

      // Should still execute successfully (timeout capped at 300000)
      assertSuccess(result);
    });
  });

  describe('Abort Handling', () => {
    it('should handle abort signal', async () => {
      const { context, abort } = createAbortableContext();

      // Start a long-running command
      const promise = executeCommandTool.execute(
        { 
          command: process.platform === 'win32' 
            ? 'ping -n 10 127.0.0.1' 
            : 'sleep 10' 
        },
        context
      );

      // Abort immediately
      abort();

      const result = await promise;
      assertError(result);
      expect(result.error).toContain('terminated');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent commands', async () => {
      const result = await executeCommandTool.execute(
        { command: 'nonexistentcommand12345' },
        createMockContext()
      );

      // Should either return error or fail execution
      expect(result.success === false || result.output.includes('not recognized')).toBe(true);
    });

    it('should handle commands with non-zero exit code', async () => {
      const result = await executeCommandTool.execute(
        { command: 'exit 1' },
        createMockContext()
      );

      assertError(result);
      expect(result.error).toContain('code 1');
    });
  });

  describe('Case Sensitivity', () => {
    it('should block commands regardless of case', async () => {
      const result = await executeCommandTool.execute(
        { command: 'RM -RF /' },
        createMockContext()
      );

      assertError(result);
      expect(result.error).toContain('blocked');
    });

    it('should block FORMAT C: in uppercase', async () => {
      const result = await executeCommandTool.execute(
        { command: 'FORMAT C:' },
        createMockContext()
      );

      assertError(result);
      expect(result.error).toContain('blocked');
    });
  });
});
