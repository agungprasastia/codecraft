/**
 * Session Storage Tests
 * Tests for JSON file-based session persistence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createSessionStorage, JsonSessionStorage } from './session-storage';
import {
  generateSessionId,
  generateSessionTitle,
  generateSessionPreview,
  serializeSession,
  deserializeSession,
  isValidSession,
  Session,
} from './session';
import type { Message } from '../types';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: 'Test message content',
    timestamp: new Date(),
    ...overrides,
  };
}

function createTestSession(overrides: Partial<Session> = {}): Session {
  const now = new Date();
  return {
    id: generateSessionId(),
    title: 'Test Session',
    createdAt: now,
    updatedAt: now,
    messages: [],
    metadata: {
      mode: 'build',
      provider: 'openai',
      model: 'gpt-4',
      workingDirectory: '/test',
      messageCount: 0,
    },
    ...overrides,
  };
}

// ============================================================================
// Session Utilities Tests
// ============================================================================

describe('Session Utilities', () => {
  describe('generateSessionId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
    });

    it('should start with ses_ prefix', () => {
      const id = generateSessionId();
      expect(id).toMatch(/^ses_/);
    });

    it('should be alphanumeric with underscores', () => {
      const id = generateSessionId();
      expect(id).toMatch(/^ses_[a-z0-9_]+$/);
    });
  });

  describe('generateSessionTitle', () => {
    it('should return "New Session" for empty messages', () => {
      expect(generateSessionTitle([])).toBe('New Session');
    });

    it('should use first user message as title', () => {
      const messages: Message[] = [
        createTestMessage({ role: 'system', content: 'System prompt' }),
        createTestMessage({ role: 'user', content: 'Hello, help me with coding' }),
      ];
      expect(generateSessionTitle(messages)).toBe('Hello, help me with coding');
    });

    it('should truncate long messages', () => {
      const longContent = 'A'.repeat(100);
      const messages: Message[] = [createTestMessage({ role: 'user', content: longContent })];
      const title = generateSessionTitle(messages);
      expect(title.length).toBeLessThanOrEqual(50);
      expect(title).toContain('...');
    });
  });

  describe('generateSessionPreview', () => {
    it('should return "No response yet" for no assistant messages', () => {
      const messages: Message[] = [createTestMessage({ role: 'user', content: 'Hello' })];
      expect(generateSessionPreview(messages)).toBe('No response yet');
    });

    it('should use last assistant message', () => {
      const messages: Message[] = [
        createTestMessage({ role: 'assistant', content: 'First response' }),
        createTestMessage({ role: 'user', content: 'Another question' }),
        createTestMessage({ role: 'assistant', content: 'Final response' }),
      ];
      expect(generateSessionPreview(messages)).toBe('Final response');
    });

    it('should truncate long previews', () => {
      const longContent = 'B'.repeat(200);
      const messages: Message[] = [createTestMessage({ role: 'assistant', content: longContent })];
      const preview = generateSessionPreview(messages);
      expect(preview.length).toBeLessThanOrEqual(100);
      expect(preview).toContain('...');
    });
  });

  describe('serializeSession / deserializeSession', () => {
    it('should preserve Date objects through serialization', () => {
      const session = createTestSession();
      const serialized = serializeSession(session);
      const deserialized = deserializeSession(serialized);

      expect(deserialized.createdAt).toBeInstanceOf(Date);
      expect(deserialized.updatedAt).toBeInstanceOf(Date);
      expect(deserialized.createdAt.getTime()).toBe(session.createdAt.getTime());
    });

    it('should preserve message timestamps', () => {
      const messages = [createTestMessage(), createTestMessage()];
      const session = createTestSession({ messages });

      const serialized = serializeSession(session);
      const deserialized = deserializeSession(serialized);

      expect(deserialized.messages[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('isValidSession', () => {
    it('should return true for valid sessions', () => {
      const session = createTestSession();
      expect(isValidSession(session)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidSession(null)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isValidSession({ id: 'test' })).toBe(false);
      expect(isValidSession({ id: 'test', title: 'Test' })).toBe(false);
    });
  });
});

// ============================================================================
// JsonSessionStorage Tests
// ============================================================================

describe('JsonSessionStorage', () => {
  let storage: JsonSessionStorage;
  let tempDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codecraft-test-'));
    storage = createSessionStorage(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('create', () => {
    it('should create a new session with generated ID', async () => {
      const session = await storage.create({
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '/test',
      });

      expect(session.id).toMatch(/^ses_/);
      expect(session.title).toBe('New Session');
      expect(session.messages).toEqual([]);
      expect(session.metadata.messageCount).toBe(0);
    });

    it('should persist session to disk', async () => {
      const session = await storage.create({
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '/test',
      });

      const filePath = path.join(tempDir, `${session.id}.json`);
      const exists = await fs
        .stat(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should create a session with a custom ID when provided', async () => {
      const session = await storage.create(
        {
          mode: 'build',
          provider: 'openai',
          model: 'gpt-4',
          workingDirectory: '/test',
        },
        'custom-session'
      );

      expect(session.id).toBe('custom-session');

      const filePath = path.join(tempDir, 'custom-session.json');
      const exists = await fs
        .stat(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should reject unsafe custom session IDs', async () => {
      await expect(
        storage.create(
          {
            mode: 'build',
            provider: 'openai',
            model: 'gpt-4',
            workingDirectory: '/test',
          },
          '../escape-attempt'
        )
      ).rejects.toThrow('Invalid session ID');
    });
  });

  describe('get', () => {
    it('should retrieve an existing session', async () => {
      const created = await storage.create({
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '/test',
      });

      const retrieved = await storage.get(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
    });

    it('should return null for non-existent session', async () => {
      const result = await storage.get('non_existent_id');
      expect(result).toBeNull();
    });

    it('should reject unsafe session IDs when loading', async () => {
      await expect(storage.get('../escape-attempt')).rejects.toThrow('Invalid session ID');
    });
  });

  describe('update', () => {
    it('should update session messages', async () => {
      const session = await storage.create({
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '/test',
      });

      const messages = [
        createTestMessage({ role: 'user', content: 'Hello' }),
        createTestMessage({ role: 'assistant', content: 'Hi there!' }),
      ];

      const updated = await storage.update(session.id, messages);
      expect(updated.messages).toHaveLength(2);
      expect(updated.metadata.messageCount).toBe(2);
      expect(updated.title).toBe('Hello');
    });

    it('should update metadata', async () => {
      const session = await storage.create({
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '/test',
      });

      const updated = await storage.update(session.id, [], { tokenCount: 1500 });
      expect(updated.metadata.tokenCount).toBe(1500);
    });

    it('should throw for non-existent session', async () => {
      await expect(storage.update('non_existent', [])).rejects.toThrow('Session not found');
    });
  });

  describe('delete', () => {
    it('should delete an existing session', async () => {
      const session = await storage.create({
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '/test',
      });

      const deleted = await storage.delete(session.id);
      expect(deleted).toBe(true);

      const retrieved = await storage.get(session.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent session', async () => {
      const deleted = await storage.delete('non_existent');
      expect(deleted).toBe(false);
    });

    it('should reject unsafe session IDs when deleting', async () => {
      await expect(storage.delete('../escape-attempt')).rejects.toThrow('Invalid session ID');
    });
  });

  describe('list', () => {
    it('should return empty array when no sessions', async () => {
      const sessions = await storage.list();
      expect(sessions).toEqual([]);
    });

    it('should list all sessions', async () => {
      await storage.create({
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '/test',
      });
      await storage.create({
        mode: 'plan',
        provider: 'anthropic',
        model: 'claude-3',
        workingDirectory: '/test',
      });

      const sessions = await storage.list();
      expect(sessions).toHaveLength(2);
    });

    it('should respect limit option', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.create({
          mode: 'build',
          provider: 'openai',
          model: 'gpt-4',
          workingDirectory: '/test',
        });
      }

      const sessions = await storage.list({ limit: 2 });
      expect(sessions).toHaveLength(2);
    });

    it('should sort by updatedAt desc by default', async () => {
      const s1 = await storage.create({
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '/test',
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const s2 = await storage.create({
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '/test',
      });

      const sessions = await storage.list();
      expect(sessions[0].id).toBe(s2.id);
      expect(sessions[1].id).toBe(s1.id);
    });
  });

  describe('getLatest', () => {
    it('should return null when no sessions', async () => {
      const latest = await storage.getLatest();
      expect(latest).toBeNull();
    });

    it('should return the most recently updated session', async () => {
      await storage.create({
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '/test',
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const expected = await storage.create({
        mode: 'plan',
        provider: 'anthropic',
        model: 'claude-3',
        workingDirectory: '/test',
      });

      const latest = await storage.getLatest();
      expect(latest).not.toBeNull();
      expect(latest!.id).toBe(expected.id);
    });
  });

  describe('search', () => {
    it('should find sessions by title', async () => {
      const session = await storage.create({
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '/test',
      });
      await storage.update(session.id, [
        createTestMessage({ role: 'user', content: 'Help me with React hooks' }),
      ]);

      const results = await storage.search('React');
      expect(results).toHaveLength(1);
    });

    it('should find sessions by message content', async () => {
      const session = await storage.create({
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '/test',
      });
      await storage.update(session.id, [
        createTestMessage({ role: 'user', content: 'Question' }),
        createTestMessage({
          role: 'assistant',
          content: 'The answer involves TypeScript generics',
        }),
      ]);

      const results = await storage.search('TypeScript');
      expect(results).toHaveLength(1);
    });

    it('should return empty array for no matches', async () => {
      await storage.create({
        mode: 'build',
        provider: 'openai',
        model: 'gpt-4',
        workingDirectory: '/test',
      });
      const results = await storage.search('xyz123nonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('clearAll', () => {
    it('should delete all sessions', async () => {
      for (let i = 0; i < 3; i++) {
        await storage.create({
          mode: 'build',
          provider: 'openai',
          model: 'gpt-4',
          workingDirectory: '/test',
        });
      }

      const deleted = await storage.clearAll();
      expect(deleted).toBe(3);

      const remaining = await storage.list();
      expect(remaining).toEqual([]);
    });
  });
});
