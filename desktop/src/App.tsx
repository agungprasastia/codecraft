import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

function App() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!terminalRef.current || terminalInstance.current) return;

    const terminal = new Terminal({
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      theme: {
        background: '#1a1a2e',
        foreground: '#eaeaea',
        cursor: '#00d9ff',
        cursorAccent: '#1a1a2e',
        selectionBackground: '#3d3d5c',
        black: '#1a1a2e',
        brightBlack: '#4d4d6d',
        red: '#ff6b6b',
        brightRed: '#ff8787',
        green: '#51cf66',
        brightGreen: '#69db7c',
        yellow: '#ffd43b',
        brightYellow: '#ffe066',
        blue: '#339af0',
        brightBlue: '#5c7cfa',
        magenta: '#cc5de8',
        brightMagenta: '#da77f2',
        cyan: '#22b8cf',
        brightCyan: '#3bc9db',
        white: '#eaeaea',
        brightWhite: '#ffffff',
      },
    });

    fitAddon.current = new FitAddon();
    terminal.loadAddon(fitAddon.current);
    terminal.loadAddon(new WebLinksAddon());

    terminal.open(terminalRef.current);
    fitAddon.current.fit();

    terminalInstance.current = terminal;

    // Welcome message
    terminal.writeln('\x1b[36m⚡ Codecraft Desktop\x1b[0m');
    terminal.writeln('\x1b[90mAI-powered coding agent\x1b[0m');
    terminal.writeln('');
    terminal.writeln('\x1b[33mInitializing...\x1b[0m');

    // Initialize the backend
    initializeBackend(terminal);

    // Handle window resize
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, []);

  const initializeBackend = async (terminal: Terminal) => {
    try {
      const result = await invoke<string>('initialize');
      terminal.writeln(`\x1b[32m${result}\x1b[0m`);
      terminal.writeln('');
      terminal.write('\x1b[36m> \x1b[0m');
      setIsReady(true);
      setupInputHandler(terminal);
    } catch (error) {
      terminal.writeln(`\x1b[31mError: ${error}\x1b[0m`);
    }
  };

  const setupInputHandler = (terminal: Terminal) => {
    let currentLine = '';

    terminal.onData((data) => {
      // Handle special keys
      if (data === '\r') {
        // Enter
        terminal.writeln('');
        if (currentLine.trim()) {
          handleCommand(terminal, currentLine.trim());
        } else {
          terminal.write('\x1b[36m> \x1b[0m');
        }
        currentLine = '';
      } else if (data === '\x7f') {
        // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          terminal.write('\b \b');
        }
      } else if (data === '\x03') {
        // Ctrl+C
        terminal.writeln('^C');
        currentLine = '';
        terminal.write('\x1b[36m> \x1b[0m');
      } else if (data.charCodeAt(0) >= 32) {
        // Printable characters
        currentLine += data;
        terminal.write(data);
      }
    });
  };

  const handleCommand = async (terminal: Terminal, command: string) => {
    if (command === '/exit' || command === '/quit') {
      await invoke('exit_app');
      return;
    }

    if (command === '/clear') {
      terminal.clear();
      terminal.write('\x1b[36m> \x1b[0m');
      return;
    }

    if (command === '/help') {
      terminal.writeln('\x1b[33mCommands:\x1b[0m');
      terminal.writeln('  /help   - Show this help');
      terminal.writeln('  /clear  - Clear terminal');
      terminal.writeln('  /exit   - Exit application');
      terminal.writeln('');
      terminal.write('\x1b[36m> \x1b[0m');
      return;
    }

    terminal.writeln('\x1b[90mProcessing...\x1b[0m');

    try {
      const response = await invoke<string>('send_message', { message: command });
      terminal.writeln('');
      terminal.writeln(`\x1b[32m🤖 ${response}\x1b[0m`);
    } catch (error) {
      terminal.writeln(`\x1b[31mError: ${error}\x1b[0m`);
    }

    terminal.writeln('');
    terminal.write('\x1b[36m> \x1b[0m');
  };

  return (
    <div className="app">
      <div className="titlebar">
        <div className="titlebar-title">⚡ Codecraft</div>
        <div className="titlebar-buttons">
          <button className="titlebar-button minimize" onClick={() => invoke('minimize_window')}>
            −
          </button>
          <button className="titlebar-button maximize" onClick={() => invoke('toggle_maximize')}>
            □
          </button>
          <button className="titlebar-button close" onClick={() => invoke('exit_app')}>
            ×
          </button>
        </div>
      </div>
      <div className="terminal-container" ref={terminalRef} />
    </div>
  );
}

export default App;
