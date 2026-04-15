/**
 * Provider model catalog
 * Central source of truth for default models and context windows.
 */

export type SupportedProvider = 'openai' | 'anthropic' | 'google' | 'ollama';

export interface ModelCapabilities {
  tools: boolean;
}

export interface ModelCatalogEntry {
  provider: SupportedProvider;
  modelId: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens?: number;
  capabilities: ModelCapabilities;
}

const DEFAULT_CONTEXT_WINDOW = 8192;

export const MODEL_CATALOG: Record<SupportedProvider, ModelCatalogEntry[]> = {
  openai: [
    {
      provider: 'openai',
      modelId: 'gpt-4-turbo-preview',
      displayName: 'GPT-4 Turbo Preview',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'openai',
      modelId: 'gpt-4-turbo',
      displayName: 'GPT-4 Turbo',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'openai',
      modelId: 'gpt-4o',
      displayName: 'GPT-4o',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      displayName: 'GPT-4o Mini',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'openai',
      modelId: 'gpt-4',
      displayName: 'GPT-4',
      contextWindow: 8192,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'openai',
      modelId: 'gpt-3.5-turbo',
      displayName: 'GPT-3.5 Turbo',
      contextWindow: 16385,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'openai',
      modelId: 'gpt-3.5-turbo-16k',
      displayName: 'GPT-3.5 Turbo 16K',
      contextWindow: 16385,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
  ],
  anthropic: [
    {
      provider: 'anthropic',
      modelId: 'claude-3-opus-20240229',
      displayName: 'Claude 3 Opus',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'anthropic',
      modelId: 'claude-3-sonnet-20240229',
      displayName: 'Claude 3 Sonnet',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'anthropic',
      modelId: 'claude-3-haiku-20240307',
      displayName: 'Claude 3 Haiku',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20240620',
      displayName: 'Claude 3.5 Sonnet',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      capabilities: { tools: true },
    },
    {
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
      displayName: 'Claude 3.5 Sonnet (Oct 2024)',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      capabilities: { tools: true },
    },
  ],
  google: [
    {
      provider: 'google',
      modelId: 'gemini-pro',
      displayName: 'Gemini Pro',
      contextWindow: 32760,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'google',
      modelId: 'gemini-1.5-pro',
      displayName: 'Gemini 1.5 Pro',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      capabilities: { tools: true },
    },
    {
      provider: 'google',
      modelId: 'gemini-1.5-flash',
      displayName: 'Gemini 1.5 Flash',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      capabilities: { tools: true },
    },
  ],
  ollama: [
    {
      provider: 'ollama',
      modelId: 'llama2',
      displayName: 'Llama 2',
      contextWindow: 4096,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'ollama',
      modelId: 'llama2:70b',
      displayName: 'Llama 2 70B',
      contextWindow: 4096,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'ollama',
      modelId: 'mistral',
      displayName: 'Mistral',
      contextWindow: 8192,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'ollama',
      modelId: 'mixtral:8x7b',
      displayName: 'Mixtral 8x7B',
      contextWindow: 32768,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
    {
      provider: 'ollama',
      modelId: 'codellama',
      displayName: 'CodeLlama',
      contextWindow: 16384,
      maxOutputTokens: 4096,
      capabilities: { tools: true },
    },
  ],
};

export const DEFAULT_MODELS: Record<SupportedProvider, string> = {
  openai: 'gpt-4-turbo-preview',
  anthropic: 'claude-3-opus-20240229',
  google: 'gemini-pro',
  ollama: 'llama2',
};

export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  ...Object.values(MODEL_CATALOG)
    .flat()
    .reduce<Record<string, number>>((limits, model) => {
      limits[model.modelId] = model.contextWindow;
      return limits;
    }, {}),
  default: DEFAULT_CONTEXT_WINDOW,
};

export function isSupportedProvider(provider: string): provider is SupportedProvider {
  return provider in MODEL_CATALOG;
}

export function listSupportedProviders(): SupportedProvider[] {
  return Object.keys(MODEL_CATALOG) as SupportedProvider[];
}

export function getModelsForProvider(provider: SupportedProvider): ModelCatalogEntry[] {
  return [...MODEL_CATALOG[provider]];
}

export function getDefaultModelForProvider(provider: SupportedProvider): string {
  return DEFAULT_MODELS[provider];
}

export function getModelCatalogEntry(modelId: string): ModelCatalogEntry | undefined {
  const normalizedModelId = modelId.toLowerCase();

  for (const model of Object.values(MODEL_CATALOG).flat()) {
    if (model.modelId.toLowerCase() === normalizedModelId) {
      return model;
    }
  }

  for (const model of Object.values(MODEL_CATALOG).flat()) {
    if (normalizedModelId.startsWith(model.modelId.toLowerCase())) {
      return model;
    }
  }

  return undefined;
}

export function getModelContextWindow(modelId: string): number {
  return getModelCatalogEntry(modelId)?.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
}
