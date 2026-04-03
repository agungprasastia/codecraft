/**
 * Session Storage Implementation
 * JSON file-based storage for conversation sessions
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { Message } from '../types';
import {
  Session,
  SessionMetadata,
  SessionSummary,
  SessionListOptions,
  SessionStorage,
  generateSessionId,
  generateSessionTitle,
  generateSessionPreview,
  serializeSession,
  deserializeSession,
  isValidSession,
} from './session';

// ============================================================================
// Constants
// ============================================================================

const SESSIONS_DIR_NAME = 'sessions';
const SESSION_FILE_EXTENSION = '.json';
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function validateSessionId(id: string): string {
  if (!SESSION_ID_PATTERN.test(id)) {
    throw new Error('Invalid session ID. Use only letters, numbers, hyphens, and underscores.');
  }

  return id;
}

/**
 * Get the sessions directory path
 */
function getSessionsDir(): string {
  const platform = os.platform();
  let configDir: string;

  if (platform === 'win32') {
    configDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  } else if (platform === 'darwin') {
    configDir = path.join(os.homedir(), 'Library', 'Application Support');
  } else {
    configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  }

  return path.join(configDir, 'codecraft', SESSIONS_DIR_NAME);
}

// ============================================================================
// JSON File Storage Implementation
// ============================================================================

export class JsonSessionStorage implements SessionStorage {
  private sessionsDir: string;
  private initialized: boolean = false;

  constructor(sessionsDir?: string) {
    this.sessionsDir = sessionsDir || getSessionsDir();
  }

  /**
   * Ensure the sessions directory exists
   */
  private async ensureDir(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
      this.initialized = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
      this.initialized = true;
    }
  }

  /**
   * Get the file path for a session
   */
  private getSessionPath(id: string): string {
    return path.join(this.sessionsDir, `${validateSessionId(id)}${SESSION_FILE_EXTENSION}`);
  }

  async create(metadata: Omit<SessionMetadata, 'messageCount'>, id?: string): Promise<Session> {
    await this.ensureDir();

    const now = new Date();
    const session: Session = {
      id: id ? validateSessionId(id) : generateSessionId(),
      title: 'New Session',
      createdAt: now,
      updatedAt: now,
      messages: [],
      metadata: {
        ...metadata,
        messageCount: 0,
      },
    };

    const filePath = this.getSessionPath(session.id);
    await fs.writeFile(filePath, serializeSession(session), 'utf-8');

    return session;
  }

  async get(id: string): Promise<Session | null> {
    await this.ensureDir();

    const filePath = this.getSessionPath(id);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const session = deserializeSession(content);

      if (!isValidSession(session)) {
        console.error(`Invalid session data for ${id}`);
        return null;
      }

      return session;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async update(
    id: string,
    messages: Message[],
    metadata?: Partial<SessionMetadata>
  ): Promise<Session> {
    await this.ensureDir();

    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Session not found: ${id}`);
    }

    const updatedSession: Session = {
      ...existing,
      title: generateSessionTitle(messages) || existing.title,
      updatedAt: new Date(),
      messages,
      metadata: {
        ...existing.metadata,
        ...metadata,
        messageCount: messages.length,
      },
    };

    const filePath = this.getSessionPath(id);
    await fs.writeFile(filePath, serializeSession(updatedSession), 'utf-8');

    return updatedSession;
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureDir();

    const filePath = this.getSessionPath(id);

    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async list(options: SessionListOptions = {}): Promise<SessionSummary[]> {
    await this.ensureDir();

    const { limit = 50, offset = 0, sortBy = 'updatedAt', sortOrder = 'desc' } = options;

    let files: string[];
    try {
      files = await fs.readdir(this.sessionsDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    const sessionFiles = files.filter((f) => f.endsWith(SESSION_FILE_EXTENSION));

    // Load all sessions to sort them
    const sessions: Session[] = [];
    for (const file of sessionFiles) {
      const id = file.replace(SESSION_FILE_EXTENSION, '');
      const session = await this.get(id);
      if (session) {
        sessions.push(session);
      }
    }

    // Sort sessions
    sessions.sort((a, b) => {
      const aDate = sortBy === 'createdAt' ? a.createdAt : a.updatedAt;
      const bDate = sortBy === 'createdAt' ? b.createdAt : b.updatedAt;
      const comparison = new Date(aDate).getTime() - new Date(bDate).getTime();
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const paginated = sessions.slice(offset, offset + limit);

    // Convert to summaries
    return paginated.map((session) => ({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.metadata.messageCount,
      preview: generateSessionPreview(session.messages),
    }));
  }

  async getLatest(): Promise<Session | null> {
    const summaries = await this.list({ limit: 1, sortBy: 'updatedAt', sortOrder: 'desc' });

    if (summaries.length === 0) {
      return null;
    }

    return this.get(summaries[0].id);
  }

  async search(query: string): Promise<SessionSummary[]> {
    await this.ensureDir();

    const allSessions = await this.list({ limit: 1000 });
    const lowerQuery = query.toLowerCase();

    // Filter by title or load full session for content search
    const results: SessionSummary[] = [];

    for (const summary of allSessions) {
      // Check title
      if (summary.title.toLowerCase().includes(lowerQuery)) {
        results.push(summary);
        continue;
      }

      // Check preview
      if (summary.preview.toLowerCase().includes(lowerQuery)) {
        results.push(summary);
        continue;
      }

      // For deeper search, load full session
      const session = await this.get(summary.id);
      if (session) {
        const hasMatch = session.messages.some((m) => m.content.toLowerCase().includes(lowerQuery));
        if (hasMatch) {
          results.push(summary);
        }
      }
    }

    return results;
  }

  /**
   * Get the storage directory path (for debugging/info)
   */
  getStoragePath(): string {
    return this.sessionsDir;
  }

  /**
   * Clear all sessions (useful for testing)
   */
  async clearAll(): Promise<number> {
    await this.ensureDir();

    let files: string[];
    try {
      files = await fs.readdir(this.sessionsDir);
    } catch {
      return 0;
    }

    const sessionFiles = files.filter((f) => f.endsWith(SESSION_FILE_EXTENSION));

    for (const file of sessionFiles) {
      await fs.unlink(path.join(this.sessionsDir, file));
    }

    return sessionFiles.length;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let storageInstance: JsonSessionStorage | null = null;

/**
 * Get the session storage instance
 */
export function getSessionStorage(): JsonSessionStorage {
  if (!storageInstance) {
    storageInstance = new JsonSessionStorage();
  }
  return storageInstance;
}

/**
 * Create a session storage instance with a custom directory (for testing)
 */
export function createSessionStorage(sessionsDir: string): JsonSessionStorage {
  return new JsonSessionStorage(sessionsDir);
}
