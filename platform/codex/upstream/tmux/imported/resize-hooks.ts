function normalizeTmuxHookToken(value: string): string {
  const normalized = value
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized === '' ? 'unknown' : normalized;
}

function normalizeHudPaneToken(hudPaneId: string): string {
  const trimmed = hudPaneId.trim();
  const withoutPrefix = trimmed.startsWith('%') ? trimmed.slice(1) : trimmed;
  return normalizeTmuxHookToken(withoutPrefix);
}

/**
 * Imported from oh-my-codex.
 * Source: oh-my-codex/src/team/tmux-session.ts
 * Commit: fabb3ce0b96e42c20feb2940c74f2aa5addb8cee
 */
export function buildCodexResizeHookTarget(
  sessionName: string,
  windowIndex: string,
): string {
  return `${sessionName}:${windowIndex}`;
}

export function buildCodexResizeHookName(
  teamName: string,
  sessionName: string,
  windowIndex: string,
  hudPaneId: string,
): string {
  return [
    'omx_resize',
    normalizeTmuxHookToken(teamName),
    normalizeTmuxHookToken(sessionName),
    normalizeTmuxHookToken(windowIndex),
    normalizeHudPaneToken(hudPaneId),
  ].join('_');
}
