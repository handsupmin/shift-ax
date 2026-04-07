const HUD_TMUX_TEAM_HEIGHT_LINES = 3;
const TMUX_HOOK_INDEX_MAX = 2147483647;

function shellQuoteSingle(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildBestEffortShellCommand(command: string): string {
  return `${command} >/dev/null 2>&1 || true`;
}

function buildNestedTmuxShellCommand(command: string): string {
  return `tmux ${command}`;
}

function buildHudPaneTarget(hudPaneId: string): string {
  const trimmed = hudPaneId.trim();
  return trimmed.startsWith('%') ? trimmed : `%${trimmed}`;
}

function buildHudResizeCommand(
  hudPaneId: string,
  heightLines: number = HUD_TMUX_TEAM_HEIGHT_LINES,
): string {
  return `resize-pane -t ${buildHudPaneTarget(hudPaneId)} -y ${heightLines}`;
}

function buildResizeHookSlot(hookName: string): string {
  let hash = 0;
  for (let i = 0; i < hookName.length; i++) {
    hash = (hash * 31 + hookName.charCodeAt(i)) | 0;
  }
  return `client-resized[${Math.abs(hash) % TMUX_HOOK_INDEX_MAX}]`;
}

/**
 * Imported from oh-my-codex.
 * Source: oh-my-codex/src/team/tmux-session.ts
 * Commit: fabb3ce0b96e42c20feb2940c74f2aa5addb8cee
 */
export function buildCodexRegisterResizeHookArgs(
  hookTarget: string,
  hookName: string,
  hudPaneId: string,
  heightLines: number = HUD_TMUX_TEAM_HEIGHT_LINES,
): string[] {
  const resizeCommand = shellQuoteSingle(
    buildBestEffortShellCommand(
      buildNestedTmuxShellCommand(buildHudResizeCommand(hudPaneId, heightLines)),
    ),
  );
  return ['set-hook', '-t', hookTarget, buildResizeHookSlot(hookName), `run-shell -b ${resizeCommand}`];
}

export function buildCodexUnregisterResizeHookArgs(
  hookTarget: string,
  hookName: string,
): string[] {
  return ['set-hook', '-u', '-t', hookTarget, buildResizeHookSlot(hookName)];
}
