// Optional LLM endpoint configuration. The whole AI feature is inert unless the
// user enables it and supplies an endpoint + key. Stored locally only.
export type LlmProvider = 'anthropic' | 'openai' | 'gemini';

export interface LlmConfig {
  enabled: boolean;
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  // Auto-rewrite over-limit platforms after a typing pause.
  autoFit: boolean;
  // Freeform voice/style guidance added to the system prompt (e.g. "Keep posts
  // light-hearted with a bit of humor").
  stylePrompt: string;
}

const LLM_CONFIG_KEY = 'omnipost:llm-config-v1';

// Sensible per-provider defaults so switching providers fills in a working URL/model.
export const PROVIDER_DEFAULTS: Record<LlmProvider, { baseUrl: string; model: string }> = {
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-6' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.4-mini' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.1-flash' },
};

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI-compatible',
  gemini: 'Google Gemini',
};

export function defaultLlmConfig(): LlmConfig {
  return {
    enabled: false,
    provider: 'anthropic',
    baseUrl: PROVIDER_DEFAULTS.anthropic.baseUrl,
    apiKey: '',
    model: PROVIDER_DEFAULTS.anthropic.model,
    autoFit: true,
    stylePrompt: '',
  };
}

// The config is usable when enabled and the fields a request needs are present.
export function isLlmReady(config: LlmConfig): boolean {
  return config.enabled && Boolean(config.apiKey.trim()) && Boolean(config.baseUrl.trim()) && Boolean(config.model.trim());
}

export function loadLlmConfig(): LlmConfig {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return defaultLlmConfig();
  }

  try {
    const raw = window.localStorage.getItem(LLM_CONFIG_KEY);

    if (!raw) {
      return defaultLlmConfig();
    }

    const parsed = JSON.parse(raw) as Partial<LlmConfig>;
    return { ...defaultLlmConfig(), ...parsed };
  } catch {
    return defaultLlmConfig();
  }
}

export function saveLlmConfig(config: LlmConfig): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Non-fatal: the in-memory config still works for this session.
  }
}
