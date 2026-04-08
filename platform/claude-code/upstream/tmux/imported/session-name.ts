const TMUX_SESSION_PREFIX = 'omc-team';

/**
 * Imported from oh-my-claudecode.
 * Source: oh-my-claudecode/src/team/tmux-session.ts
 * Commit: 2487d3878f8d25e60802940b020d5ee8774d135e
 */
export function sanitizeClaudeSessionNamePart(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9-]/g, '');
  if (sanitized.length === 0) {
    throw new Error(
      `Invalid name: "${name}" contains no valid characters (alphanumeric or hyphen)`,
    );
  }
  if (sanitized.length < 2) {
    throw new Error(
      `Invalid name: "${name}" too short after sanitization (minimum 2 characters)`,
    );
  }
  return sanitized.slice(0, 50);
}

export function buildClaudeWorkerSessionName(
  teamName: string,
  workerName: string,
): string {
  return `${TMUX_SESSION_PREFIX}-${sanitizeClaudeSessionNamePart(teamName)}-${sanitizeClaudeSessionNamePart(workerName)}`;
}
