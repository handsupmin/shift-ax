import { execFileSync } from 'node:child_process';

/**
 * Imported from oh-my-codex.
 * Source: oh-my-codex/src/cli/autoresearch.ts
 * Commit: fabb3ce0b96e42c20feb2940c74f2aa5addb8cee
 */
export function resolveCodexRepoRoot(cwd: string): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim();
}
