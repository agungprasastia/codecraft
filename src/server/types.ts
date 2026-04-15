import type { AgentMode, StreamChunk } from '../types';

export interface ChatRequest {
  message: string;
  provider?: string;
  model?: string;
  mode?: AgentMode;
  sessionId?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatSyncResponse {
  content: string;
  sessionId?: string;
}

export interface ChatSseDonePayload {
  content: string;
  sessionId?: string;
}

export interface ServerHealthResponse {
  status: 'ok';
}

export interface ServerConfigResponse {
  defaultProvider: string;
  defaultModel: string;
  providers: string[];
}

export interface StreamChunkEvent {
  chunk: StreamChunk;
}
