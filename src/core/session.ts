/**
 * Session Management
 * Handles conversation persistence and restoration
 */

import type { Message, AgentMode } from '../types';

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  mode: AgentMode;
  provider: string;
  model: string;
  workingDirectory: string;
  messageCount: number;
  tokenCount?: number;
}

export interface SessionSummary {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  preview: string;
}

export interface SessionListOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Session Storage Interface
// ============================================================================

export interface SessionStorage {
  /**
   * Create a new session
   */
  create(metadata: Omit<SessionMetadata, 'messageCount'>, id?: string): Promise<Session>;

  /**
   * Get a session by ID
   */
  get(id: string): Promise<Session | null>;

  /**
   * Update session messages and metadata
   */
  update(id: string, messages: Message[], metadata?: Partial<SessionMetadata>): Promise<Session>;

  /**
   * Delete a session
   */
  delete(id: string): Promise<boolean>;

  /**
   * List all sessions with optional filtering
   */
  list(options?: SessionListOptions): Promise<SessionSummary[]>;

  /**
   * Get the most recent session
   */
  getLatest(): Promise<Session | null>;

  /**
   * Search sessions by content
   */
  search(query: string): Promise<SessionSummary[]>;
}

// ============================================================================
// Session Utilities
// ============================================================================

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ses_${timestamp}_${random}`;
}

/**
 * Generate a session title from the first user message
 */
export function generateSessionTitle(messages: Message[]): string {
  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (!firstUserMessage) {
    return 'New Session';
  }

  // Truncate to first 50 characters
  const content = firstUserMessage.content.trim();
  if (content.length <= 50) {
    return content;
  }
  return content.substring(0, 47) + '...';
}

/**
 * Generate a preview string for session list
 */
export function generateSessionPreview(messages: Message[]): string {
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');

  if (!lastAssistantMessage) {
    return 'No response yet';
  }

  const content = lastAssistantMessage.content.trim();
  if (content.length <= 100) {
    return content;
  }
  return content.substring(0, 97) + '...';
}

/**
 * Serialize a session for storage (handles Date objects)
 */
export function serializeSession(session: Session): string {
  return JSON.stringify(
    session,
    (key, value) => {
      if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() };
      }
      return value;
    },
    2
  );
}

/**
 * Deserialize a session from storage (restores Date objects)
 */
export function deserializeSession(json: string): Session {
  const parsed = JSON.parse(json, (key, value) => {
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  });

  return {
    ...parsed,
    createdAt: new Date(parsed.createdAt),
    updatedAt: new Date(parsed.updatedAt),
    messages: Array.isArray(parsed.messages)
      ? parsed.messages.map((message: Message) => ({
          ...message,
          timestamp: new Date(message.timestamp),
        }))
      : [],
  } as Session;
}

/**
 * Validate session data structure
 */
export function isValidSession(data: unknown): data is Session {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const session = data as Record<string, unknown>;

  return (
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    (session.createdAt instanceof Date || typeof session.createdAt === 'string') &&
    (session.updatedAt instanceof Date || typeof session.updatedAt === 'string') &&
    Array.isArray(session.messages) &&
    typeof session.metadata === 'object' &&
    session.metadata !== null
  );
}
