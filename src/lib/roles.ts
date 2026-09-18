export const APP_ROLES = ['admin', 'user', 'user_ai'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function roleLabel(role: string): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'user_ai':
      return 'Usuário + IA';
    case 'user':
    default:
      return 'Usuário';
  }
}

export function normalizeAppRole(role: string): AppRole {
  if (role === 'admin' || role === 'user_ai') return role;
  return 'user';
}
