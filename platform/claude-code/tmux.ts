import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ShiftAxPlatformTmuxRuntime } from '../../adapters/contracts.js';
import { readImportedUpstreamSlice } from '../upstream-imports.js';
import { buildClaudeWorkerSessionName } from './upstream/tmux/imported/session-name.js';
import {
  createClaudeDetachedSession,
  killClaudeDetachedSession,
} from './upstream/tmux/imported/detached-session.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export function getClaudeCodeTmuxRuntime(rootDir: string): ShiftAxPlatformTmuxRuntime {
  return {
    support: 'imported-helpers',
    multiplexer: 'tmux',
    workspace_mode: 'detached-sessions',
    naming: {
      session_prefix: 'omc-team',
      imported_helpers: ['sanitizeClaudeSessionNamePart', 'buildClaudeWorkerSessionName'],
    },
    upstream_boundary: {
      import_root: join(rootDir, 'platform', 'claude-code', 'upstream', 'tmux'),
      provenance_doc: join(
        rootDir,
        'platform',
        'claude-code',
        'upstream',
        'tmux',
        'provenance.md',
      ),
      planned_upstream_modules: ['oh-my-claudecode/src/team/tmux-session.ts'],
      active_imports: [
        readImportedUpstreamSlice(join(HERE, 'upstream', 'tmux', 'imported', 'provenance.json')),
        readImportedUpstreamSlice(
          join(HERE, 'upstream', 'tmux', 'imported', 'detached-session.provenance.json'),
        ),
      ],
    },
  };
}

export function buildClaudeWorkerSessionIdentity(
  teamName: string,
  workerName: string,
): string {
  return buildClaudeWorkerSessionName(teamName, workerName);
}

export function createClaudeDetachedWorkerSession(
  teamName: string,
  workerName: string,
  workingDirectory?: string,
): string {
  return createClaudeDetachedSession(teamName, workerName, workingDirectory);
}

export function killClaudeDetachedWorkerSession(
  teamName: string,
  workerName: string,
): void {
  killClaudeDetachedSession(teamName, workerName);
}
