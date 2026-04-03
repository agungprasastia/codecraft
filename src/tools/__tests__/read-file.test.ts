/**
 * Read File Tool Tests
 * Tests for reading files with various scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileTool } from '../read-file';
import {
  createMockContext,
  createTempDir,
  cleanupTempDir,
  createTestFile,
  assertSuccess,
  assertError,
} from './utils';

describe('read_file tool', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('read-file-test-');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('Success Cases', () => {
    it('should read existing file content', async () => {
      const content = 'Hello, World!\nThis is line 2.\nThis is line 3.';
      const filePath = await createTestFile(tempDir, 'test.txt', content);

      const result = await readFileTool.execute(
        { path: filePath },
        createMockContext({ workingDirectory: tempDir })
      );

      assertSuccess(result);
      expect(result.output).toContain('Hello, World!');
      expect(result.output).toContain('This is line 2.');
      expect(result.output).toContain('This is line 3.');
    });

    it('should read file with relative path', async () => {
      const content = 'Relative path test';
      await createTestFile(tempDir, 'relative.txt', content);

      const result = await readFileTool.execute(
        { path: 'relative.txt' },
        createMockContext({ workingDirectory: tempDir })
      );

      assertSuccess(result);
      expect(result.output).toContain('Relative path test');
    });

    it('should read specific line range', async () => {
      const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`);
      const content = lines.join('\n');
      const filePath = await createTestFile(tempDir, 'lines.txt', content);

      const result = await readFileTool.execute(
        { path: filePath, startLine: 3, endLine: 5 },
        createMockContext({ workingDirectory: tempDir })
      );

      assertSuccess(result);
      expect(result.output).toContain('Line 3');
      expect(result.output).toContain('Line 4');
      expect(result.output).toContain('Line 5');
      expect(result.output).not.toContain('Line 2');
      expect(result.output).not.toContain('Line 6');
    });

    it('should add line numbers to output', async () => {
      const content = 'First\nSecond\nThird';
      const filePath = await createTestFile(tempDir, 'numbered.txt', content);

      const result = await readFileTool.execute(
        { path: filePath },
        createMockContext({ workingDirectory: tempDir })
      );

      assertSuccess(result);
      expect(result.output).toMatch(/1:.*First/);
      expect(result.output).toMatch(/2:.*Second/);
      expect(result.output).toMatch(/3:.*Third/);
    });

    it('should truncate large files', async () => {
      const lines = Array.from({ length: 600 }, (_, i) => `Line ${i + 1}`);
      const content = lines.join('\n');
      const filePath = await createTestFile(tempDir, 'large.txt', content);

      const result = await readFileTool.execute(
        { path: filePath },
        createMockContext({ workingDirectory: tempDir })
      );

      assertSuccess(result);
      expect(result.output).toContain('showing first 100');
      expect(result.output).toContain('truncated');
      expect(result.output).toContain('startLine/endLine');
    });
  });

  describe('Error Cases', () => {
    it('should return error for non-existent file', async () => {
      const result = await readFileTool.execute(
        { path: 'nonexistent.txt' },
        createMockContext({ workingDirectory: tempDir })
      );

      assertError(result);
      expect(result.error).toContain('File not found');
    });

    it('should return error when reading a directory', async () => {
      const result = await readFileTool.execute(
        { path: tempDir },
        createMockContext({ workingDirectory: tempDir })
      );

      assertError(result);
      expect(result.error).toContain('directory');
    });

    it('should handle invalid path characters gracefully', async () => {
      const result = await readFileTool.execute(
        { path: '\0invalid' },
        createMockContext({ workingDirectory: tempDir })
      );

      assertError(result);
      expect(result.error).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file', async () => {
      const filePath = await createTestFile(tempDir, 'empty.txt', '');

      const result = await readFileTool.execute(
        { path: filePath },
        createMockContext({ workingDirectory: tempDir })
      );

      assertSuccess(result);
      expect(result.output).toContain('1 lines');
    });

    it('should handle file with only newlines', async () => {
      const filePath = await createTestFile(tempDir, 'newlines.txt', '\n\n\n');

      const result = await readFileTool.execute(
        { path: filePath },
        createMockContext({ workingDirectory: tempDir })
      );

      assertSuccess(result);
    });

    it('should handle unicode content', async () => {
      const content = '你好世界\n🎉 Emoji test\nCafé résumé';
      const filePath = await createTestFile(tempDir, 'unicode.txt', content);

      const result = await readFileTool.execute(
        { path: filePath },
        createMockContext({ workingDirectory: tempDir })
      );

      assertSuccess(result);
      expect(result.output).toContain('你好世界');
      expect(result.output).toContain('🎉');
      expect(result.output).toContain('Café');
    });

    it('should handle startLine beyond file length', async () => {
      const content = 'Line 1\nLine 2';
      const filePath = await createTestFile(tempDir, 'short.txt', content);

      const result = await readFileTool.execute(
        { path: filePath, startLine: 100 },
        createMockContext({ workingDirectory: tempDir })
      );

      assertSuccess(result);
      // Should return empty or end of file
    });
  });
});
