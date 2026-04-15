# Codecraft

⚡ An open-source AI coding agent with a beautiful terminal interface.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- 🤖 **Multi-Provider Support**: Works with OpenAI, Anthropic (Claude), Google (Gemini), and local models via Ollama
- 🎨 **Beautiful TUI**: Polished terminal interface built with React (Ink)
- 🔧 **Powerful Tools**: Read/write files, execute commands, search codebases
- 🛡️ **Safe Modes**: BUILD mode for full access, PLAN mode for read-only exploration
- ⚙️ **Configurable**: Bring your own API keys, customize models, base URLs, and settings

## Installation

```bash
# Install globally
npm install -g codecraft

# Or run directly with npx
npx codecraft
```

## Quick Start

1. Set your API key:

```bash
# Option 1: Environment variable
export OPENAI_API_KEY=sk-...

# Option 2: Config command
codecraft config set openai.apiKey sk-...
codecraft config set openai.baseUrl https://api.openai.com/v1
codecraft config set ollama.baseUrl http://localhost:11434
```

2. Run Codecraft:

```bash
codecraft
```

3. Start chatting with your AI coding assistant!

## Usage

### Command Line Options

```bash
codecraft [options]

Options:
  -p, --provider <provider>  LLM provider (openai, anthropic, google, ollama)
  -m, --model <model>        Model to use
  --plan                     Start in read-only PLAN mode
  --api-key <key>            API key for the provider
  -s, --session <id>         Resume or persist a named session
  -h, --help                 Display help
  -V, --version              Display version
```

### Examples

```bash
# Use OpenAI GPT-4
codecraft --provider openai --model gpt-4-turbo-preview

# Use Claude
codecraft --provider anthropic --model claude-3-opus-20240229

# Use local Ollama model
codecraft --provider ollama --model llama2

# Start in safe read-only mode
codecraft --plan
```

### In-App Commands

| Command        | Description                               |
| -------------- | ----------------------------------------- |
| `/help`        | Show help screen                          |
| `/clear`       | Clear conversation history                |
| `/tokens`      | Show token usage for current conversation |
| `/sessions`    | List saved sessions                       |
| `/resume [id]` | Resume a saved session or the latest one  |
| `/delete <id>` | Delete a saved session                    |
| `/mode build`  | Switch to BUILD mode (full access)        |
| `/mode plan`   | Switch to PLAN mode (read-only)           |
| `/exit`        | Exit Codecraft                            |

### Keyboard Shortcuts

| Shortcut | Action                          |
| -------- | ------------------------------- |
| `Ctrl+C` | Cancel current operation / Exit |
| `Ctrl+L` | Clear conversation              |
| `Escape` | Cancel current operation        |
| `?`      | Toggle help screen              |

## Modes

### BUILD Mode (Default)

Full access to:

- Read and write files
- Execute shell commands
- Modify your codebase

### PLAN Mode

Safe, read-only access for:

- Exploring unfamiliar codebases
- Understanding code structure
- Planning changes before implementing

## Available Tools

| Tool              | BUILD | PLAN | Description                 |
| ----------------- | ----- | ---- | --------------------------- |
| `read_file`       | ✅    | ✅   | Read file contents          |
| `write_file`      | ✅    | ❌   | Write to files              |
| `list_directory`  | ✅    | ✅   | List directory contents     |
| `search_files`    | ✅    | ✅   | Search for files by pattern |
| `grep`            | ✅    | ✅   | Search in file contents     |
| `execute_command` | ✅    | ❌   | Run shell commands          |

## Configuration

Configuration is stored in your system's config directory:

```bash
# View config path
codecraft config path

# List all config
codecraft config list

# Set a value
codecraft config set openai.apiKey sk-...
codecraft config set defaultProvider anthropic
codecraft config set defaultModel claude-3-opus-20240229
```

### Environment Variables

| Variable            | Description       |
| ------------------- | ----------------- |
| `OPENAI_API_KEY`    | OpenAI API key    |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY`    | Google AI API key |

### Provider Config

| Key              | Description                         |
| ---------------- | ----------------------------------- |
| `openai.apiKey`  | OpenAI API key                      |
| `openai.baseUrl` | Optional OpenAI-compatible endpoint |
| `ollama.baseUrl` | Local Ollama endpoint               |

## Development

```bash
# Clone the repository
git clone https://github.com/agungprasastia/codecraft.git
cd codecraft

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Architecture

```
src/
├── cli/           # CLI entry point
├── core/          # Agent and configuration
├── providers/     # LLM providers, registry, and model catalog
│   ├── openai.ts
│   ├── anthropic.ts
│   ├── google.ts
│   └── ollama.ts
├── tools/         # Agent tools
│   ├── read-file.ts
│   ├── write-file.ts
│   ├── list-directory.ts
│   ├── search-files.ts
│   ├── grep.ts
│   └── execute-command.ts
├── ui/            # Ink UI components
│   ├── App.tsx
│   ├── ChatInput.tsx
│   ├── MessageList.tsx
│   └── ...
└── types/         # TypeScript types
```

## Roadmap

- [x] Conversation persistence
- [x] Context management (token tracking & auto-truncation)
- [x] Provider improvements (registry, model catalog, caching, safer base URLs)
- [x] Tauri desktop app wrapper
- [ ] Plugin system for custom tools
- [ ] Git integration
- [ ] Project templates

## License

MIT ©
