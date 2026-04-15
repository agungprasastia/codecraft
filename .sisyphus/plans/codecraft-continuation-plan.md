# Codecraft Continuation Plan

## Executive Summary

Based on analysis from 4 agents (Metis, Explore, Librarian x2), this roadmap continues Codecraft development using proven patterns from **OpenCode** (https://github.com/anomalyco/opencode).

---

## Current State Assessment

### What We Have (✅ Done)

| Component     | Status      | Notes                                                          |
| ------------- | ----------- | -------------------------------------------------------------- |
| CLI/TUI       | ✅ Working  | Ink-based, React components                                    |
| Agent Core    | ✅ Working  | Tool execution loop, streaming                                 |
| Providers     | ✅ Working  | OpenAI, Anthropic, Google, Ollama                              |
| Tools         | ✅ Working  | read_file, write_file, execute_command, grep, search, list_dir |
| Modes         | ✅ Working  | BUILD (full) / PLAN (read-only)                                |
| Configuration | ✅ Basic    | Uses `conf` library + env vars                                 |
| Tauri Desktop | ⚠️ Scaffold | UI exists, backend placeholder                                 |

### What's Missing (❌ Gaps)

| Gap                        | Severity    | Reference Pattern                   |
| -------------------------- | ----------- | ----------------------------------- |
| **Onboarding Friction**    | 🔴 Critical | OpenCode has guided `/connect` UX   |
| **Model Discoverability**  | 🔴 Critical | OpenCode has explicit `models` UX   |
| **Fallback Clarity Gap**   | 🟡 High     | OpenCode surfaces fallback behavior |
| **Config Precedence UX**   | 🟡 High     | OpenCode explains resolution source |
| **Desktop Auto-Start Gap** | 🟡 Medium   | Better integrated local runtime     |
| **No Plugin System**       | ⚪ Future   | OpenCode has full plugin API        |
| **No MCP Support**         | ⚪ Future   | OpenCode converts MCP to tools      |

---

## Reference Architecture: OpenCode Patterns to Adopt

### 1. Provider System (HIGH PRIORITY)

OpenCode's provider layer is excellent:

- **Provider Registry** with normalized schema
- **SDK caching** by config hash (reduces latency)
- **Model catalog** from models.dev with local cache
- **Config merge pipeline**: env → config → plugin

**File**: `packages/opencode/src/provider/provider.ts`

### 2. Tool Registry (HIGH PRIORITY)

- Centralized registry composes built-in + custom + plugin tools
- Dynamic tool gating by model/provider
- MCP tools converted via schema translation

**File**: `packages/opencode/src/tool/registry.ts`

### 3. Client/Server Architecture (MEDIUM PRIORITY)

- TUI as thin client, server exposes HTTP + OpenAPI
- SSE event stream with **event batching** for smooth rendering
- Supports both in-process and remote modes

**Files**: `packages/opencode/src/server/server.ts`, `packages/opencode/src/cli/cmd/tui/context/sdk.tsx`

### 4. Agent/Mode System (MEDIUM PRIORITY)

OpenCode has more sophisticated agents:

- `build`, `plan`, `general`, `explore`
- Hidden system agents: `compaction`, `title`, `summary`
- Per-agent permission rules

**File**: `packages/opencode/src/agent/agent.ts`

### 5. Session Lifecycle (MEDIUM PRIORITY)

- Fork, share/unshare, revert/unrevert
- Auto-summaries and todo tracking
- Full persistence in SQLite

**File**: `packages/opencode/src/session/`

---

## Prioritized Roadmap

### Phase 0: Critical Bug Fixes (Week 0 - Immediate)

#### T0: Fix API Key Wiring Bug

**Problem**: `agent.ts:47` reads `process.env` but `appConfig.getProviderApiKey()` reads stored config first.

**Fix**:

```typescript
// Before (BROKEN)
apiKey: process.env[`${config.provider.toUpperCase()}_API_KEY`] || '';

// After (FIXED)
apiKey: appConfig.getProviderApiKey(config.provider) || '';
```

**QA**:

1. `codecraft config set openai.apiKey test-key`
2. Unset `OPENAI_API_KEY` env var
3. Run `codecraft` - should NOT show "No API key" error

---

### Phase 1: Test Foundation (Week 1-2)

#### T1: Setup Vitest

**Files to create**: `vitest.config.ts`, `src/__tests__/setup.ts`

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm test -- --run
# Expected: Exit code 0, output contains "vitest" and "0 tests"
```

#### T2: Agent Core Tests

**File to create**: `src/core/agent.test.ts`
**File to modify**: None

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm test -- src/core/agent.test.ts --run
# Expected: Exit code 0, output shows:
#   ✓ should start in BUILD mode by default
#   ✓ should switch to PLAN mode
#   ✓ should filter tools based on mode
#   ✓ should abort on request
#   ✓ should handle message streaming
# Minimum 5 tests pass
```

#### T3: Tool Test Utils

**File to create**: `src/tools/__tests__/utils.ts`

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm run typecheck
# Expected: Exit code 0, no errors in src/tools/__tests__/utils.ts
```

#### T4: Provider Mock

**File to create**: `src/providers/__tests__/mock-provider.ts`

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm run typecheck
# Then in test file:
import { MockProvider } from '../mock-provider';
const provider = new MockProvider();
const response = await provider.chat([{ role: 'user', content: 'test' }]);
# Expected: response.content === 'Mock response' (or configured canned response)
```

#### T5: Read File Tests

**File to create**: `src/tools/__tests__/read-file.test.ts`

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm test -- src/tools/__tests__/read-file.test.ts --run
# Expected: Exit code 0, output shows:
#   ✓ should read existing file content
#   ✓ should return error for non-existent file
#   ✓ should handle permission denied
# Minimum 3 tests pass
```

#### T6: Execute Command Tests

**File to create**: `src/tools/__tests__/execute-command.test.ts`

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm test -- src/tools/__tests__/execute-command.test.ts --run
# Expected: Exit code 0, output shows:
#   ✓ should execute allowed commands
#   ✓ should block rm -rf command
#   ✓ should block format command
#   ✓ should reject in PLAN mode
#   ✓ should handle command timeout
# Minimum 5 tests pass
```

#### T7: Config Tests

**File to create**: `src/core/config.test.ts`

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm test -- src/core/config.test.ts --run
# Expected: Exit code 0, output shows:
#   ✓ should get default values
#   ✓ should set and retrieve values
#   ✓ should fallback to env vars for API keys
#   ✓ should return provider API key from config
# Minimum 4 tests pass
```

**Dependency Graph**:

```
T1 ──┬── T2
     ├── T3 ──┬── T5
     │        └── T6
     ├── T4
     └── T7
```

---

### Phase 2: Session Persistence (Week 3-4)

_Reference: OpenCode `packages/opencode/src/session/`_

#### T8: Session Types

**File to create**: `src/core/session.ts`

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm run typecheck
# Expected: Exit code 0
# Verify file contains:
#   - Session interface with id, messages, mode, provider, model, timestamps
#   - SessionStorage interface with save(), load(), list(), delete()
```

#### T9: JSON Storage

**File to create**: `src/core/session-storage.ts`
**File to create**: `src/core/session-storage.test.ts`

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm test -- src/core/session-storage.test.ts --run
# Expected: Exit code 0, output shows:
#   ✓ should save session to JSON file
#   ✓ should load session from JSON file
#   ✓ should list all sessions
#   ✓ should delete session
#   ✓ should handle missing session gracefully
# Files created in: ~/.config/codecraft/sessions/*.json (or OS-specific config dir)
```

#### T10: CLI Integration

**File to modify**: `src/cli/index.tsx` (add --session flag)
**File to modify**: `src/core/agent.ts` (accept sessionId, auto-save)

**QA Scenario**:

```bash
# Tool: bash
# Steps:
# 1. Start with new session
node dist/cli/index.js --provider ollama --model llama2 --session test-session
# 2. Send a message, then exit (Ctrl+C)
# 3. Restart with same session
node dist/cli/index.js --provider ollama --model llama2 --session test-session
# Expected: Previous messages appear in conversation history
# Verify: ~/.config/codecraft/sessions/test-session.json exists
```

#### T11: Session Commands

**File to modify**: `src/ui/App.tsx` (add /sessions, /resume, /delete handlers)

**QA Scenario**:

```bash
# Tool: manual in TUI
# Steps:
# 1. Start codecraft
# 2. Type /sessions
# Expected: List of saved sessions with IDs and timestamps
# 3. Type /resume <session-id>
# Expected: Loads that session's messages
# 4. Type /delete <session-id>
# Expected: "Session deleted" message, session removed from list
```

**Data Model**:

```typescript
interface Session {
  id: string;
  messages: Message[];
  mode: AgentMode;
  provider: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    title?: string;
    summary?: string;
    tokensUsed?: number;
  };
}
```

---

### Phase 3: Context Management (Week 5-6)

_Reference: OpenCode compaction agent, Aider `/tokens`_

#### T12: Token Counter

**File to create**: `src/core/token-counter.ts`
**File to create**: `src/core/token-counter.test.ts`
**Dependency**: Install `js-tiktoken` or use approximation (4 chars ≈ 1 token)

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm test -- src/core/token-counter.test.ts --run
# Expected: Exit code 0, output shows:
#   ✓ should count tokens in simple string
#   ✓ should count tokens in Message array
#   ✓ should be within 10% of actual token count
# Test case: "Hello world" → ~2-3 tokens
```

#### T13: `/tokens` Command

**File to modify**: `src/ui/App.tsx` (add /tokens handler)
**File to modify**: `src/core/agent.ts` (track token usage)

**QA Scenario**:

```bash
# Tool: manual in TUI
# Steps:
# 1. Start codecraft and have a conversation (3-4 messages)
# 2. Type /tokens
# Expected output format:
#   Token Usage:
#   - Current: 1,234 tokens
#   - Model limit: 8,000 tokens
#   - Remaining: 6,766 tokens (84%)
```

#### T14: Context Truncation

**File to modify**: `src/core/agent.ts` (add truncation logic before API call)

**QA Scenario**:

```bash
# Tool: bash + manual
# Steps:
# 1. Create test that simulates 100+ messages
npm test -- src/core/agent.test.ts -t "context truncation" --run
# Expected:
#   ✓ should truncate oldest messages when over 80% of limit
#   ✓ should keep system message intact
#   ✓ should keep last 10 messages minimum
# 2. Manual: Have very long conversation, verify no "context too long" error
```

#### T15: Context Compaction (OPTIONAL)

**File to create**: `src/core/compaction.ts`
**Requires**: Additional LLM call to summarize

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm test -- src/core/compaction.test.ts --run
# Expected:
#   ✓ should summarize conversation history
#   ✓ should preserve key facts and decisions
#   ✓ should reduce token count by at least 50%
# Note: This is optional - can be deferred if truncation is sufficient
```

---

### Phase 4: Provider Improvements (Week 7-8)

_Reference: OpenCode `packages/opencode/src/provider/`_

#### T16: Provider Registry

**File to create**: `src/providers/registry.ts`
**File to modify**: `src/providers/index.ts` (use registry)

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm test -- src/providers/registry.test.ts --run
# Expected:
#   ✓ should register all built-in providers
#   ✓ should get provider by name
#   ✓ should list available providers
#   ✓ should validate provider config
# Then verify in TUI:
node dist/cli/index.js --provider openai
node dist/cli/index.js --provider anthropic
node dist/cli/index.js --provider google
node dist/cli/index.js --provider ollama
# All should initialize without error (may fail on API call if no key)
```

#### T17: SDK Caching

**File to modify**: `src/providers/registry.ts` (add cache Map)

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm test -- src/providers/registry.test.ts -t "caching" --run
# Expected:
#   ✓ should return cached SDK instance for same config
#   ✓ should create new instance for different config
# Performance: Second getProvider() call should be <1ms (vs ~50ms first call)
```

#### T18: Model Catalog

**File to create**: `src/providers/models.ts`
**Option A**: Hardcode known models per provider
**Option B**: Fetch from models.dev API (like OpenCode)

**QA Scenario**:

```bash
# Tool: bash
# Steps:
npm test -- src/providers/models.test.ts --run
# Expected:
#   ✓ should list OpenAI models (gpt-4, gpt-4-turbo, gpt-3.5-turbo)
#   ✓ should list Anthropic models (claude-3-opus, claude-3-sonnet)
#   ✓ should list Google models (gemini-pro, gemini-1.5-pro)
#   ✓ should include context window size for each model
```

#### T19: Better Streaming

**File to modify**: `src/ui/App.tsx` (add event batching)
**Reference**: OpenCode `packages/opencode/src/cli/cmd/tui/context/sdk.tsx`

**QA Scenario**:

```bash
# Tool: manual observation
# Steps:
# 1. Start codecraft and ask a long question
# 2. Observe streaming response
# Expected:
#   - No visible flicker during streaming
#   - Text appears smoothly, not character-by-character jitter
#   - UI remains responsive during streaming
```

---

### Phase 5: Desktop Integration (Week 9-10)

_Reference: OpenCode client/server pattern_

#### T20: HTTP Server

**File to create**: `src/server/index.ts`
**File to create**: `src/server/routes.ts`
**Dependencies**: Install `express` or `hono`

**QA Scenario**:

```bash
# Tool: bash
# Steps:
# 1. Start server
node dist/server/index.js --port 3000
# 2. Test health endpoint
curl http://localhost:3000/health
# Expected: {"status":"ok"}
# 3. Test chat endpoint
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","provider":"ollama","model":"llama2"}'
# Expected: SSE stream with assistant response
```

#### T21: Tauri Bridge

**File to modify**: `desktop/src-tauri/src/lib.rs` (spawn HTTP server, forward requests)
**File to modify**: `desktop/src/App.tsx` (connect to HTTP API instead of placeholder)

**QA Scenario**:

```bash
# Tool: bash
# Steps:
cd desktop
npm run tauri dev
# Expected:
#   - Desktop window opens
#   - Terminal UI renders correctly
#   - Typing message and pressing Enter sends to real agent
#   - Response streams back to desktop terminal
```

#### T22: Desktop Polish

**File to modify**: `desktop/src/App.tsx` (fix TS errors)
**File to modify**: `desktop/tsconfig.json` (fix module resolution)

**QA Scenario**:

```bash
# Tool: bash
# Steps:
cd desktop
npx tsc --noEmit
# Expected: Exit code 0, no TypeScript errors
npm run build
# Expected: Build succeeds, dist/ folder created
```

---

### Phase 5.5: Setup UX (OpenCode-inspired) (Week 10-11)

_Reference: OpenCode `/connect`, `auth login`, `models`, config precedence, and fallback ergonomics_

> **Goal**: Make API-key setup and model selection as easy as OpenCode for first-run users, while preserving Codecraft CLI flags and config behavior.

#### T22A: First-Run Guided Setup Entry

**Files to modify**:

- `src/cli/index.tsx` - detect first-run and show guided setup hint/entry
- `src/ui/App.tsx` - expose setup trigger from TUI (`/setup`)
- `src/ui/HelpOverlay.tsx` - document setup commands

**Behavior**:

- If no usable auth for selected provider on first run, show one clear guided path instead of hard-fail wall of text.
- Keep non-interactive usage intact (CI/headless still works with flags/env/config).

**QA Scenario**:

```bash
# Tool: bash + manual in TUI
# Steps:
# 1. Clear local config and provider env vars
# 2. Run codecraft
# Expected:
#   - Setup guidance appears immediately
#   - User sees exact next command (`/connect` or `codecraft auth login`)
#   - No ambiguous "model not available" dead-end
```

#### T22B: Unified Auth Command Surface (`connect` + `auth`)

**Files to create/modify**:

- `src/cli/index.tsx` - add `auth` command group (`login`, `list`, `logout`)
- `src/ui/App.tsx` - add `/connect` and `/auth` command handlers
- `src/core/config.ts` - store/retrieve provider credentials consistently
- `src/types/index.ts` - extend config types if needed

**Behavior**:

- TUI path: `/connect` opens provider/auth selection flow.
- CLI path: `codecraft auth login` supports headless recovery.
- `codecraft auth list` shows configured providers (without exposing secrets).

**QA Scenario**:

```bash
# Tool: bash + manual in TUI
# Steps:
codecraft auth login
codecraft auth list
codecraft auth logout openai
# Expected:
#   ✓ login stores credential in config
#   ✓ list shows provider status only (masked)
#   ✓ logout removes provider credential cleanly
```

#### T22C: Discoverable Model Picker + Model Inventory

**Files to modify**:

- `src/providers/models.ts` - expose stable model inventory helpers
- `src/ui/App.tsx` - add `/models` command (interactive list + select)
- `src/cli/index.tsx` - add `models` command and `--refresh` placeholder behavior

**Behavior**:

- `/models` (TUI) and `codecraft models` (CLI) show copy-pasteable IDs.
- Print current selection source: CLI flag / config default / session metadata.
- Invalid model errors must suggest remediation: "Try: /models".

**QA Scenario**:

```bash
# Tool: bash + manual in TUI
# Steps:
codecraft models
codecraft --provider openai --model does-not-exist
# Expected:
#   ✓ model inventory prints grouped by provider
#   ✓ invalid model error is actionable and suggests available alternatives
#   ✓ TUI /models can switch active model successfully
```

#### T22D: Deterministic Resolution + Transparent Precedence

**Files to modify**:

- `src/cli/index.tsx`
- `src/core/agent.ts`
- `src/core/config.ts`

**Required precedence (explicit)**:

1. CLI flags (`--provider`, `--model`, `--api-key`)
2. Session metadata (when resuming)
3. Persisted config defaults
4. Provider default model catalog

**Behavior**:

- Startup must log one concise line, e.g.:
  - `Using model: openai/gpt-4o (from --model)`
- Add `codecraft debug config` to show merged config + source attribution per key.

**QA Scenario**:

```bash
# Tool: bash
# Steps:
codecraft config set defaultProvider openai
codecraft config set defaultModel gpt-4o
codecraft --provider anthropic --model claude-3-5-sonnet-20241022
codecraft debug config
# Expected:
#   ✓ runtime uses anthropic/claude-3-5-sonnet-20241022
#   ✓ debug output explains why (source precedence)
```

#### T22E: Fallback UX for Transient Provider/Model Failures

**Files to create/modify**:

- `src/core/fallbacks.ts` - fallback policy resolution
- `src/core/config.ts` - fallback config schema
- `src/core/agent.ts` - retry/switch logic for transient failures
- `src/ui/App.tsx` - user-facing fallback status message

**Behavior**:

- Support optional fallback mappings:
  - provider fallback (`openai -> anthropic`)
  - model fallback (`openai/gpt-4o -> anthropic/claude-3-5-sonnet-20241022`)
- Retry once on transient/provider availability failures with clear user notice.

**QA Scenario**:

```bash
# Tool: bash + controlled failure test
# Steps:
# 1. Configure fallback policy in config
# 2. Force transient failure on primary provider/model
# 3. Send a chat message
# Expected:
#   ✓ one retry with fallback model/provider occurs
#   ✓ UI explains fallback switch clearly
#   ✓ final response returns successfully when fallback is healthy
```

---

### Phase 6: Advanced Features (Week 11+)

_Reference: OpenCode plugin system, MCP_

> **Note**: Phase 6 is intentionally deferred until v0.2.0+. These tasks are documented for future planning but should NOT be started until Phase 1-5 are complete and stable.

#### T23: Plugin System

**Files to create**:

- `src/plugins/index.ts` - Plugin loader and registry
- `src/plugins/types.ts` - Plugin interface definition
- `src/plugins/hooks.ts` - Hook system (onMessage, onToolCall, onResponse)

**Integration points in existing code**:

- `src/core/agent.ts:chat()` - Call `hooks.onMessage()` before processing
- `src/core/agent.ts:executeTool()` - Call `hooks.onToolCall()` before execution
- `src/ui/App.tsx` - Load plugins on startup

**QA Scenario**:

```bash
# Tool: bash
# Steps:
# 1. Create test plugin at ~/.config/codecraft/plugins/test-plugin.js
echo 'module.exports = { name: "test", onMessage: (msg) => console.log("Plugin received:", msg) }' > ~/.config/codecraft/plugins/test-plugin.js
# 2. Start codecraft
node dist/cli/index.js
# 3. Send a message
# Expected: Console shows "Plugin received: <message>"
# 4. Run plugin tests
npm test -- src/plugins/index.test.ts --run
# Expected:
#   ✓ should load plugins from config directory
#   ✓ should call hooks in correct order
#   ✓ should handle plugin errors gracefully
```

#### T24: MCP Support

**Files to create**:

- `src/mcp/index.ts` - MCP client connection
- `src/mcp/tools.ts` - Convert MCP tools to Codecraft tool format

**Integration points**:

- `src/tools/index.ts:getAllTools()` - Include MCP tools in tool list
- `src/core/config.ts` - Add MCP server configuration

**Dependencies**: Install `@modelcontextprotocol/sdk`

**QA Scenario**:

```bash
# Tool: bash
# Steps:
# 1. Configure MCP server in config
codecraft config set mcp.servers '[{"name":"filesystem","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/"]}]'
# 2. Start codecraft
node dist/cli/index.js
# 3. Verify MCP tools appear
# Type: /tools
# Expected: List includes MCP tools like "mcp_filesystem_read", "mcp_filesystem_write"
# 4. Run MCP tests
npm test -- src/mcp/index.test.ts --run
# Expected:
#   ✓ should connect to MCP server
#   ✓ should convert MCP tool schema to Codecraft format
#   ✓ should execute MCP tool and return result
```

#### T25: Git Integration

**Files to create**:

- `src/tools/git.ts` - Git tool implementation
- `src/git/index.ts` - Git utilities (status, diff, commit)

**Integration points**:

- `src/tools/index.ts` - Register git tools
- `src/ui/App.tsx` - Add `/commit` command handler

**QA Scenario**:

```bash
# Tool: bash
# Steps:
# 1. Initialize test repo
mkdir /tmp/test-repo && cd /tmp/test-repo && git init
# 2. Start codecraft in repo
node dist/cli/index.js
# 3. Make changes and test git integration
echo "test" > test.txt
# Type: "commit these changes with message 'test commit'"
# Expected: Agent creates commit with specified message
# 4. Run git tests
npm test -- src/tools/git.test.ts --run
# Expected:
#   ✓ should get git status
#   ✓ should create commit with message
#   ✓ should show diff of changes
```

#### T26: More Agents

**Files to create**:

- `src/agents/explore.ts` - Read-only exploration agent
- `src/agents/general.ts` - General chat without tools
- `src/agents/index.ts` - Agent registry

**Integration points**:

- `src/core/agent.ts` - Support multiple agent types
- `src/cli/index.tsx` - Add `--agent` flag
- `src/ui/App.tsx` - Add `/agent` command to switch

**QA Scenario**:

```bash
# Tool: bash
# Steps:
# 1. Start with explore agent
node dist/cli/index.js --agent explore
# Expected: Only read-only tools available (like PLAN mode but different prompt)
# 2. Start with general agent
node dist/cli/index.js --agent general
# Expected: No tools available, pure chat mode
# 3. Switch agents in TUI
# Type: /agent build
# Expected: "Switched to build agent" - full tools available
# 4. Run agent tests
npm test -- src/agents/index.test.ts --run
# Expected:
#   ✓ should load build agent by default
#   ✓ should switch between agents
#   ✓ should apply correct tool permissions per agent
```

---

## Patterns from Competitor Research

### From Aider (Python, Terminal-first)

- **Repo map** for large codebases (token-budgeted)
- **Git-native workflow** (auto-commit, .gitignore hygiene)
- **File watcher** for AI comment triggers
- `/tokens`, `/add`, `/drop` commands

### From Continue (TypeScript, Multi-surface)

- **Shared core** between CLI/IDE/CI
- **Headless mode** with JSON output
- **Session resume/listing**
- **Policy-as-code** PR checks

### From Open Interpreter (Python, Local execution)

- **Execution gates** (approval before run)
- **Safe mode** with Semgrep scanning
- **Multi-language** code execution

### From OpenCode (TypeScript, TUI-first onboarding)

- **`/connect` first-run path** for provider authentication in TUI
- **Dual auth surfaces**: interactive setup + CLI (`auth login/list/logout`)
- **Discoverable model inventory** via `models` command + copyable IDs
- **Deterministic model precedence** (flag > config > last-used/default)
- **Actionable model errors** that suggest next command (`models`)
- **Explicit fallback UX** when provider/model is temporarily unavailable

---

## Implementation Order (Recommended)

```
Week 0:   T0 (bug fix)
Week 1-2: T1-T7 (tests) - PARALLEL
Week 3-4: T8-T11 (sessions) - SEQUENTIAL
Week 5-6: T12-T15 (context) - SEQUENTIAL
Week 7-8: T16-T19 (providers) - PARALLEL
Week 9-10: T20-T22 (desktop) - SEQUENTIAL
Week 10-11: T22A-T22E (setup UX) - SEQUENTIAL
Week 11+: T23-T26 (advanced) - AS NEEDED
```

---

## Success Criteria for v0.1.0

- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] Session persistence works
- [ ] Context management prevents crashes
- [ ] Documentation updated

---

## Questions for User (Before Starting)

1. **MVP Scope**: CLI-only or CLI+Desktop?
2. **Test Coverage**: 60% minimal or 80% comprehensive?
3. **Context Strategy**: Simple truncation or LLM compaction?
4. **Desktop Priority**: Phase 5 or defer to v0.2.0?

---

## Files to Create/Modify

### New Files

```
src/__tests__/setup.ts
src/core/agent.test.ts
src/core/session.ts
src/core/session-storage.ts
src/core/token-counter.ts
src/tools/__tests__/utils.ts
src/tools/__tests__/*.test.ts
src/providers/__tests__/mock-provider.ts
vitest.config.ts
```

### Files to Modify

```
src/core/agent.ts (bug fix, session integration)
src/cli/index.tsx (--session flag, /tokens command)
package.json (vitest config)
```

---

## Risk Mitigation

| Risk                     | Mitigation                                  |
| ------------------------ | ------------------------------------------- |
| Setup confusion          | Guided setup (`/connect`) + `auth login`    |
| Model selection errors   | `models` inventory + actionable suggestions |
| Long conversations crash | Token counting + truncation                 |
| Desktop scope creep      | Defer to Phase 5                            |
| Provider API changes     | Abstract SDK, version pin                   |

---

_Plan generated: 2026-04-03_
_Plan updated: 2026-04-15 (Setup UX extension + current-state corrections)_
_Reference: OpenCode (anomalyco/opencode)_
_Agents used: Metis, Explore, Librarian x2_
