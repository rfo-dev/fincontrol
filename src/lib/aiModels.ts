export const AI_MODELS = {
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'o4-mini', label: 'o4-mini' },
  ],
  claude: [
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5' },
    { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5' },
    { id: 'claude-opus-4-5', label: 'Opus 4.5' },
    { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  ],
} as const;

export type AiProvider = keyof typeof AI_MODELS;

export function defaultModelForProvider(provider: AiProvider): string {
  return AI_MODELS[provider][0].id;
}

export function modelsForProvider(provider: string) {
  return provider === 'claude' ? AI_MODELS.claude : AI_MODELS.openai;
}
