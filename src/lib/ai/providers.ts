// ---------------------------------------------------------------------------
// AI Provider interfaces and implementations
// Supports Claude (Anthropic), OpenAI, and Ollama backends
// All base URLs are customizable
// ---------------------------------------------------------------------------

export type OpenAICompatibleProvider = 'openai' | 'glm' | 'deepseek' | 'minimax' | 'mimo' | 'qwen' | 'custom';

export interface AIProviderConfig {
  provider: 'claude' | OpenAICompatibleProvider | 'ollama';
  apiKey?: string;
  baseUrl?: string;
  ollamaUrl?: string;
  modelId?: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

// ---------------------------------------------------------------------------
// Default model IDs per provider
// ---------------------------------------------------------------------------

const DEFAULT_MODELS: Record<AIProviderConfig['provider'], string> = {
  claude: 'claude-sonnet-4-6-20250627',
  openai: 'gpt-4o',
  glm: 'glm-4-flash',
  deepseek: 'deepseek-chat',
  minimax: 'MiniMax-Text-01',
  mimo: 'MiMo-7B-RL',
  qwen: 'qwen-plus',
  ollama: 'llama3.1',
  custom: 'gpt-4o',
};

// ---------------------------------------------------------------------------
// Default base URLs per provider
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URLS: Record<AIProviderConfig['provider'], string> = {
  claude: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  glm: 'https://open.bigmodel.cn/api/paas/v1',
  deepseek: 'https://api.deepseek.com/v1',
  minimax: 'https://api.minimax.chat/v1',
  mimo: 'https://api.minimax.chat/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  ollama: 'http://localhost:11434',
  custom: 'https://api.openai.com/v1',
};

// ---------------------------------------------------------------------------
// Claude (Anthropic) provider
// ---------------------------------------------------------------------------

async function queryClaude(
  config: AIProviderConfig,
  messages: AIMessage[],
): Promise<AIResponse> {
  const model = config.modelId ?? DEFAULT_MODELS.claude;
  const baseUrl = (config.baseUrl?.trim() || DEFAULT_BASE_URLS.claude).replace(/\/+$/, '');

  const systemMessage = messages.find((m) => m.role === 'system')?.content ?? '';
  const conversationMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemMessage,
      messages: conversationMessages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown error');
    throw new Error(
      `Claude API error (${response.status}): ${errorBody}`,
    );
  }

  const data = await response.json();

  const content =
    data.content
      ?.filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('\n') ?? '';

  return {
    content,
    model: data.model ?? model,
    usage: data.usage
      ? {
          inputTokens: data.usage.input_tokens ?? 0,
          outputTokens: data.usage.output_tokens ?? 0,
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// OpenAI-compatible provider (covers OpenAI, GLM, DeepSeek, MiniMax, MiMo, Qwen, custom)
// ---------------------------------------------------------------------------

const OPENAI_COMPATIBLE = new Set<string>(['openai', 'glm', 'deepseek', 'minimax', 'mimo', 'qwen', 'custom']);

async function queryOpenAICompatible(
  config: AIProviderConfig,
  messages: AIMessage[],
): Promise<AIResponse> {
  const provider = config.provider as OpenAICompatibleProvider;
  const model = config.modelId?.trim() || DEFAULT_MODELS[provider];
  const defaultUrl = DEFAULT_BASE_URLS[provider];
  const baseUrl = (config.baseUrl?.trim() || defaultUrl).replace(/\/+$/, '');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown error');
    throw new Error(
      `${provider} API error (${response.status}): ${errorBody}`,
    );
  }

  const data = await response.json();

  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content ?? '',
    model: data.model ?? model,
    usage: data.usage
      ? {
          inputTokens: data.usage.prompt_tokens ?? 0,
          outputTokens: data.usage.completion_tokens ?? 0,
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Ollama (local) provider
// ---------------------------------------------------------------------------

async function queryOllama(
  config: AIProviderConfig,
  messages: AIMessage[],
): Promise<AIResponse> {
  const model = config.modelId ?? DEFAULT_MODELS.ollama;
  const ollamaUrl = (config.ollamaUrl?.trim() || DEFAULT_BASE_URLS.ollama).replace(/\/+$/, '');

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown error');
    throw new Error(
      `Ollama API error (${response.status}): ${errorBody}`,
    );
  }

  const data = await response.json();

  return {
    content: data.message?.content ?? '',
    model: data.model ?? model,
    usage: data.prompt_eval_count !== undefined
      ? {
          inputTokens: data.prompt_eval_count ?? 0,
          outputTokens: data.eval_count ?? 0,
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Unified dispatch
// ---------------------------------------------------------------------------

export async function queryAI(
  config: AIProviderConfig,
  messages: AIMessage[],
): Promise<AIResponse> {
  if (config.provider === 'claude') {
    return queryClaude(config, messages);
  }
  if (config.provider === 'ollama') {
    return queryOllama(config, messages);
  }
  if (OPENAI_COMPATIBLE.has(config.provider)) {
    return queryOpenAICompatible(config, messages);
  }
  throw new Error(`Unknown AI provider: ${(config as AIProviderConfig).provider}`);
}
