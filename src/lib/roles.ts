export const APP_ROLES = ['admin', 'user', 'user_ai'] as const;

export type AppRole = (typeof APP_ROLES)[number];

type TranslateFn = (key: string) => string;

export function roleLabel(role: string, t: TranslateFn): string {
  switch (role) {
    case 'admin':
      return t('roles.admin');
    case 'user_ai':
      return t('roles.user_ai');
    case 'user':
    default:
      return t('roles.user');
  }
}

export function normalizeAppRole(role: string): AppRole {
  if (role === 'admin' || role === 'user_ai') return role;
  return 'user';
}
