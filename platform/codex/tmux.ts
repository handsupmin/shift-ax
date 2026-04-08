import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ShiftAxPlatformTmuxRuntime } from '../../adapters/contracts.js';
import { readImportedUpstreamSlice } from '../upstream-imports.js';
import {
  buildCodexResizeHookName,
  buildCodexResizeHookTarget,
} from './upstream/tmux/imported/resize-hooks.js';
import {
  buildCodexRegisterResizeHookArgs,
  buildCodexUnregisterResizeHookArgs,
} from './upstream/tmux/imported/resize-hook-registration.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export function getCodexTmuxRuntime(rootDir: string): ShiftAxPlatformTmuxRuntime {
  return {
    support: 'imported-helpers',
    multiplexer: 'tmux',
    workspace_mode: 'leader-attached-layout',
    naming: {
      imported_helpers: [
        'sanitizeCodexTeamName',
        'buildCodexResizeHookTarget',
        'buildCodexResizeHookName',
      ],
    },
    upstream_boundary: {
      import_root: join(rootDir, 'platform', 'codex', 'upstream', 'tmux'),
      provenance_doc: join(rootDir, 'platform', 'codex', 'upstream', 'tmux', 'provenance.md'),
      planned_upstream_modules: ['oh-my-codex/src/team/tmux-session.ts'],
      active_imports: [
        readImportedUpstreamSlice(join(HERE, 'upstream', 'tmux', 'imported', 'provenance.json')),
        readImportedUpstreamSlice(
          join(HERE, 'upstream', 'tmux', 'imported', 'resize-hooks.provenance.json'),
        ),
        readImportedUpstreamSlice(
          join(HERE, 'upstream', 'tmux', 'imported', 'resize-hook-registration.provenance.json'),
        ),
      ],
    },
  };
}

export function buildCodexLeaderAttachedHookIdentity(
  teamName: string,
  sessionName: string,
  windowIndex: string,
  hudPaneId: string,
): { target: string; hookName: string } {
  return {
    target: buildCodexResizeHookTarget(sessionName, windowIndex),
    hookName: buildCodexResizeHookName(teamName, sessionName, windowIndex, hudPaneId),
  };
}

export function buildCodexResizeHookRegistration(
  sessionName: string,
  windowIndex: string,
  teamName: string,
  hudPaneId: string,
): {
  target: string;
  hookName: string;
  registerArgs: string[];
  unregisterArgs: string[];
} {
  const identity = buildCodexLeaderAttachedHookIdentity(
    teamName,
    sessionName,
    windowIndex,
    hudPaneId,
  );

  return {
    target: identity.target,
    hookName: identity.hookName,
    registerArgs: buildCodexRegisterResizeHookArgs(
      identity.target,
      identity.hookName,
      hudPaneId,
    ),
    unregisterArgs: buildCodexUnregisterResizeHookArgs(
      identity.target,
      identity.hookName,
    ),
  };
}
