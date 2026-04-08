import { execFileSync } from 'node:child_process';

import { buildClaudeWorkerSessionName } from './session-name.js';

/**
 * Imported from oh-my-claudecode.
 * Source: oh-my-claudecode/src/team/tmux-session.ts
 * Commit: 2487d3878f8d25e60802940b020d5ee8774d135e
 */

export function createClaudeDetachedSession(
  teamName: string,
  workerName: string,
  workingDirectory?: string,
): string {
  const name = buildClaudeWorkerSessionName(teamName, workerName);

  try {
    execFileSync('tmux', ['kill-session', '-t', name], {
      stdio: 'pipe',
      timeout: 5000,
    });
  } catch {
    // ignore stale session misses
  }

  const args = ['new-session', '-d', '-s', name, '-x', '200', '-y', '50'];
  if (workingDirectory) {
    args.push('-c', workingDirectory);
  }
  execFileSync('tmux', args, {
    stdio: 'pipe',
    timeout: 5000,
  });

  return name;
}

export function killClaudeDetachedSession(
  teamName: string,
  workerName: string,
): void {
  const name = buildClaudeWorkerSessionName(teamName, workerName);
  try {
    execFileSync('tmux', ['kill-session', '-t', name], {
      stdio: 'pipe',
      timeout: 5000,
    });
  } catch {
    // ignore absent session
  }
}
