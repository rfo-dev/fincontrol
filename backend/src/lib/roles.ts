export const APP_ROLES = ['admin', 'user', 'user_ai'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type AgentAudience = {
  audienceMode: string;
  enabledRoles: unknown;
};

export function parseEnabledRoles(value: unknown): AppRole[] {
  if (!Array.isArray(value)) return [];
  return value.filter((role): role is AppRole =>
    APP_ROLES.includes(role as AppRole)
  );
}

export function agentAllowsRole(agent: AgentAudience, role: string): boolean {
  if (agent.audienceMode !== 'roles') return true;
  const roles = parseEnabledRoles(agent.enabledRoles);
  return roles.includes(role as AppRole);
}

export const AI_MODEL_IDS = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini'],
  claude: ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-5', 'claude-opus-4-6'],
} as const;
