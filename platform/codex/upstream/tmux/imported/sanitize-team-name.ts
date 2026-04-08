/**
 * Imported from oh-my-codex.
 * Source: oh-my-codex/src/team/tmux-session.ts
 * Commit: fabb3ce0b96e42c20feb2940c74f2aa5addb8cee
 */
export function sanitizeCodexTeamName(name: string): string {
  const lowered = name.toLowerCase();
  const replaced = lowered
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '');

  const truncated = replaced.slice(0, 30).replace(/-$/, '');
  if (truncated.trim() === '') {
    throw new Error('sanitizeTeamName: empty after sanitization');
  }
  return truncated;
}
