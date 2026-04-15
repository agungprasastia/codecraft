import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import { createAgent } from '../core/agent';
import { getDefaultProviderModel, isKnownProvider, listAvailableProviders } from '../providers';
import { appConfig } from '../core/config';
import type { AgentMode } from '../types';
import type {
  ChatRequest,
  ChatSseDonePayload,
  ChatSyncResponse,
  ServerConfigResponse,
  ServerHealthResponse,
} from './types';

function normalizeProvider(provider?: string): string {
  if (!provider?.trim()) {
    return appConfig.get('defaultProvider');
  }

  return provider.trim().toLowerCase();
}

function resolveModel(provider: string, model?: string): string {
  if (model?.trim()) {
    return model.trim();
  }

  if (isKnownProvider(provider)) {
    return getDefaultProviderModel(provider);
  }

  return appConfig.get('defaultModel');
}

function writeSseEvent(res: Response, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function createServerRouter(): Router {
  const router = createRouter();

  router.get('/health', (_req: Request, res: Response) => {
    const response: ServerHealthResponse = { status: 'ok' };
    res.json(response);
  });

  router.get('/config', (_req: Request, res: Response) => {
    const response: ServerConfigResponse = {
      defaultProvider: appConfig.get('defaultProvider'),
      defaultModel: appConfig.get('defaultModel'),
      providers: listAvailableProviders(),
    };
    res.json(response);
  });

  router.post('/chat', async (req: Request, res: Response) => {
    const body = req.body as ChatRequest;

    if (!body?.message?.trim()) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const provider = normalizeProvider(body.provider);
    if (!isKnownProvider(provider)) {
      res.status(400).json({ error: `Unknown provider: ${provider}` });
      return;
    }

    const model = resolveModel(provider, body.model);
    const mode: AgentMode = body.mode === 'plan' ? 'plan' : 'build';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const streamAgent = createAgent(
        {
          mode,
          provider,
          model,
          sessionId: body.sessionId,
          maxTokens: body.maxTokens,
          temperature: body.temperature,
        },
        {
          onStreamChunk: (chunk) => {
            writeSseEvent(res, 'chunk', { chunk });
          },
        }
      );

      await streamAgent.initializeSession();
      const finalMessage = await streamAgent.chat(body.message.trim());

      const donePayload: ChatSseDonePayload = {
        content: finalMessage.content,
        sessionId: body.sessionId,
      };

      writeSseEvent(res, 'done', donePayload);
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeSseEvent(res, 'error', { error: message });
      res.end();
    }
  });

  router.post('/chat-sync', async (req: Request, res: Response) => {
    const body = req.body as ChatRequest;

    if (!body?.message?.trim()) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const provider = normalizeProvider(body.provider);
    if (!isKnownProvider(provider)) {
      res.status(400).json({ error: `Unknown provider: ${provider}` });
      return;
    }

    const model = resolveModel(provider, body.model);
    const mode: AgentMode = body.mode === 'plan' ? 'plan' : 'build';

    try {
      const agent = createAgent({
        mode,
        provider,
        model,
        sessionId: body.sessionId,
        maxTokens: body.maxTokens,
        temperature: body.temperature,
      });

      await agent.initializeSession();
      const result = await agent.chat(body.message.trim());

      const response: ChatSyncResponse = {
        content: result.content,
        sessionId: body.sessionId,
      };
      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
