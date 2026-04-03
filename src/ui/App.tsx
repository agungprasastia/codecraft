/**
 * Main App component
 * Root component for the Ink-based TUI
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Agent, createAgent } from '../core/agent';
import { getSessionStorage } from '../core/session-storage';
import { getTokenUsage, formatTokenUsage } from '../core/token-counter';
import type { SessionSummary } from '../core/session';
import type { Message, StreamChunk, ToolCall, ToolResult, AgentMode } from '../types';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';
import { StatusBar } from './StatusBar';
import { Header } from './Header';
import { HelpOverlay } from './HelpOverlay';

interface AppProps {
  provider: string;
  model: string;
  mode: AgentMode;
  sessionId?: string;
}

const sessionStorage = getSessionStorage();

export function App({
  provider: initialProvider,
  model: initialModel,
  mode: initialMode,
  sessionId: initialSessionId,
}: AppProps) {
  const { exit } = useApp();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTool, setCurrentTool] = useState<ToolCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AgentMode>(initialMode);
  const [provider, setProvider] = useState(initialProvider);
  const [model, setModel] = useState(initialModel);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(initialSessionId);
  const [showHelp, setShowHelp] = useState(false);
  const activeAgentRef = useRef<Agent | null>(null);

  const appendSystemMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'system',
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const createConfiguredAgent = useCallback(
    async (
      config: { provider: string; model: string; mode: AgentMode; sessionId?: string },
      notice?: string
    ) => {
      activeAgentRef.current?.abort();

      setError(null);
      setStreamingContent('');
      setCurrentTool(null);

      const newAgent = createAgent(config, {
        onMessage: (msg) => {
          if (msg.role !== 'system') {
            setMessages((prev) => [...prev, msg]);
          }
        },
        onStreamChunk: (chunk: StreamChunk) => {
          if (chunk.type === 'text' && chunk.content) {
            setStreamingContent((prev) => prev + chunk.content);
          } else if (chunk.type === 'done') {
            setStreamingContent('');
          }
        },
        onToolStart: (tool: ToolCall) => {
          setCurrentTool(tool);
        },
        onToolEnd: (_result: ToolResult) => {
          setCurrentTool(null);
        },
        onError: (err: Error) => {
          setError(err.message);
          setIsProcessing(false);
        },
        onStateChange: (state) => {
          setIsProcessing(state.isProcessing);
        },
      });

      activeAgentRef.current = newAgent;
      setAgent(newAgent);
      setProvider(config.provider);
      setModel(config.model);
      setMode(config.mode);
      setCurrentSessionId(config.sessionId);

      try {
        await newAgent.initializeSession();

        if (activeAgentRef.current !== newAgent) {
          return;
        }

        const restoredMessages = newAgent
          .getMessages()
          .filter((message) => message.role !== 'system');
        setMessages(
          notice
            ? [
                ...restoredMessages,
                {
                  id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  role: 'system',
                  content: notice,
                  timestamp: new Date(),
                },
              ]
            : restoredMessages
        );
      } catch (err) {
        if (activeAgentRef.current !== newAgent) {
          return;
        }

        setMessages([]);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    []
  );

  // Initialize agent
  useEffect(() => {
    void createConfiguredAgent({
      mode: initialMode,
      provider: initialProvider,
      model: initialModel,
      sessionId: initialSessionId,
    });

    return () => {
      activeAgentRef.current?.abort();
    };
  }, [createConfiguredAgent, initialMode, initialModel, initialProvider, initialSessionId]);

  // Handle keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (isProcessing && agent) {
        agent.abort();
      } else {
        exit();
      }
    }

    if (key.ctrl && input === 'l') {
      setMessages([]);
      agent?.clearHistory();
    }

    if (key.escape) {
      if (showHelp) {
        setShowHelp(false);
      } else if (isProcessing && agent) {
        agent.abort();
      }
    }

    if (input === '?' && !isProcessing) {
      setShowHelp((prev) => !prev);
    }
  });

  const handleSubmit = useCallback(
    async (input: string) => {
      if (!agent || isProcessing) return;

      // Handle special commands
      if (input.startsWith('/')) {
        const [cmd, ...args] = input.slice(1).split(' ');
        const requestedSessionId = args.join(' ').trim();
        setError(null);

        switch (cmd.toLowerCase()) {
          case 'help':
            setShowHelp(true);
            return;
          case 'clear':
            setMessages([]);
            agent.clearHistory();
            return;
          case 'mode':
            const newMode = args[0] as AgentMode;
            if (newMode === 'build' || newMode === 'plan') {
              setMode(newMode);
              agent.setMode(newMode);
              appendSystemMessage(`Switched to ${newMode.toUpperCase()} mode`);
            } else {
              setError('Invalid mode. Use /mode build or /mode plan');
            }
            return;
          case 'sessions': {
            const sessions = await sessionStorage.list();
            appendSystemMessage(formatSessionList(sessions));
            return;
          }
          case 'tokens': {
            const allMessages = agent.getMessages();
            const usage = getTokenUsage(allMessages, model);
            appendSystemMessage(formatTokenUsage(usage));
            return;
          }
          case 'resume': {
            const session = requestedSessionId
              ? await sessionStorage.get(requestedSessionId)
              : await sessionStorage.getLatest();

            if (!session) {
              setError(
                requestedSessionId
                  ? `Session not found: ${requestedSessionId}`
                  : 'No saved sessions found.'
              );
              return;
            }

            await createConfiguredAgent(
              {
                provider: session.metadata.provider,
                model: session.metadata.model,
                mode: session.metadata.mode,
                sessionId: session.id,
              },
              `Resumed session ${session.id}`
            );
            return;
          }
          case 'delete': {
            if (!requestedSessionId) {
              setError('Usage: /delete <session-id>');
              return;
            }

            const deleted = await sessionStorage.delete(requestedSessionId);
            if (!deleted) {
              setError(`Session not found: ${requestedSessionId}`);
              return;
            }

            if (requestedSessionId === currentSessionId) {
              await createConfiguredAgent(
                {
                  provider,
                  model,
                  mode,
                },
                `Deleted active session ${requestedSessionId}`
              );
            } else {
              appendSystemMessage(`Deleted session ${requestedSessionId}`);
            }
            return;
          }
          case 'exit':
          case 'quit':
            exit();
            return;
        }
      }

      setError(null);
      setStreamingContent('');

      try {
        await agent.chat(input);
      } catch (err) {
        // Error is handled by onError callback
      }
    },
    [
      agent,
      appendSystemMessage,
      createConfiguredAgent,
      currentSessionId,
      exit,
      isProcessing,
      mode,
      model,
      provider,
    ]
  );

  if (showHelp) {
    return <HelpOverlay onClose={() => setShowHelp(false)} />;
  }

  return (
    <Box flexDirection="column" height="100%">
      <Header mode={mode} model={model} provider={provider} />

      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <MessageList
          messages={messages}
          streamingContent={streamingContent}
          isProcessing={isProcessing}
        />
      </Box>

      {error && (
        <Box paddingX={1} marginBottom={1}>
          <Text color="red">⚠ {error}</Text>
        </Box>
      )}

      <StatusBar
        isProcessing={isProcessing}
        currentTool={currentTool}
        mode={mode}
        sessionId={currentSessionId}
      />

      <ChatInput
        onSubmit={handleSubmit}
        isDisabled={isProcessing}
        placeholder={isProcessing ? 'Thinking...' : 'Type a message... (? for help)'}
      />
    </Box>
  );
}

export function formatSessionList(sessions: SessionSummary[]): string {
  if (sessions.length === 0) {
    return 'No saved sessions found.';
  }

  const lines = sessions.map((session) => {
    const updatedAt = new Date(session.updatedAt).toLocaleString();
    return `- ${session.id} | ${session.title} | ${session.messageCount} messages | updated ${updatedAt}`;
  });

  return ['Saved sessions:', ...lines].join('\n');
}
