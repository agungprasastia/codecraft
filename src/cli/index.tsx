/**
 * Codecraft CLI Entry Point
 * Main command-line interface for the AI coding agent
 */

import 'dotenv/config';
import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { App } from '../ui/App';
import { appConfig } from '../core/config';
import { getSessionStorage } from '../core/session-storage';
import type { AgentMode } from '../types';
import {
  getDefaultProviderModel,
  isKnownProvider,
  listAvailableProviders,
  providerRequiresApiKey,
} from '../providers';

const program = new Command();
const providerChoices = listAvailableProviders().join(', ');

program.name('codecraft').description('AI-powered coding agent for the terminal').version('0.1.0');

program
  .option('-p, --provider <provider>', `LLM provider (${providerChoices})`)
  .option('-m, --model <model>', 'Model to use')
  .option('--plan', 'Start in read-only PLAN mode')
  .option('--api-key <key>', 'API key for the provider')
  .option('-s, --session <id>', 'Resume or persist a named session')
  .action(async (options) => {
    const existingSession = options.session ? await getSessionStorage().get(options.session) : null;

    const provider =
      options.provider || existingSession?.metadata.provider || appConfig.get('defaultProvider');

    if (!isKnownProvider(provider)) {
      console.error(`Error: Unknown provider \"${provider}\".`);
      console.error(`Supported providers: ${providerChoices}`);
      process.exit(1);
    }

    let model = options.model;
    const mode: AgentMode = options.plan ? 'plan' : existingSession?.metadata.mode || 'build';

    if (!model && existingSession) {
      model = existingSession.metadata.model;
    }

    // Set default model based on provider if not specified
    if (!model) {
      model = getDefaultProviderModel(provider) || appConfig.get('defaultModel');
    }

    // Handle API key
    if (options.apiKey) {
      process.env[`${provider.toUpperCase()}_API_KEY`] = options.apiKey;
    }

    // Verify API key exists
    const apiKey =
      provider !== 'ollama' && providerRequiresApiKey(provider)
        ? appConfig.getProviderApiKey(provider)
        : undefined;
    if (!apiKey && providerRequiresApiKey(provider)) {
      console.error(`Error: No API key found for ${provider}.`);
      console.error(`Set it via:`);
      console.error(`  - Environment variable: ${provider.toUpperCase()}_API_KEY`);
      console.error(`  - Command line: --api-key <key>`);
      console.error(`  - Config: codecraft config set ${provider}.apiKey <key>`);
      process.exit(1);
    }

    // Clear screen before rendering
    console.clear();

    // Render the app
    const { waitUntilExit } = render(
      <App provider={provider} model={model} mode={mode} sessionId={options.session} />
    );

    await waitUntilExit();
  });

// Config subcommand
program
  .command('config')
  .description('Manage configuration')
  .argument('<action>', 'Action: get, set, list, path')
  .argument('[key]', 'Configuration key')
  .argument('[value]', 'Value to set')
  .action((action, key, value) => {
    switch (action) {
      case 'get':
        if (!key) {
          console.error('Error: Key is required for get');
          process.exit(1);
        }
        console.log(appConfig.get(key as keyof ReturnType<typeof appConfig.getAll>));
        break;

      case 'set':
        if (!key || value === undefined) {
          console.error('Error: Key and value are required for set');
          process.exit(1);
        }

        // Handle nested keys like openai.apiKey
        if (key.includes('.')) {
          const [provider, prop] = key.split('.');
          if (prop === 'apiKey' && ['openai', 'anthropic', 'google'].includes(provider)) {
            appConfig.setProviderApiKey(provider as 'openai' | 'anthropic' | 'google', value);
            console.log(`Set ${key}`);
          } else if (provider === 'openai' && prop === 'baseUrl') {
            appConfig.setOpenAIBaseUrl(value);
            console.log(`Set ${key}`);
          } else if (provider === 'ollama' && prop === 'baseUrl') {
            appConfig.setOllamaUrl(value);
            console.log(`Set ${key}`);
          } else {
            console.error(`Unknown config key: ${key}`);
            process.exit(1);
          }
        } else {
          appConfig.set(key as keyof ReturnType<typeof appConfig.getAll>, value);
          console.log(`Set ${key} = ${value}`);
        }
        break;

      case 'list':
        console.log(JSON.stringify(appConfig.getAll(), null, 2));
        break;

      case 'path':
        console.log(appConfig.getConfigPath());
        break;

      default:
        console.error(`Unknown action: ${action}`);
        console.error('Available actions: get, set, list, path');
        process.exit(1);
    }
  });

program.parse();
