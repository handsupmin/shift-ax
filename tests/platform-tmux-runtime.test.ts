import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  buildCodexLeaderAttachedHookIdentity,
  buildCodexResizeHookRegistration,
} from '../platform/codex/tmux.js';
import {
  sanitizeCodexTeamName,
} from '../platform/codex/upstream/tmux/imported/sanitize-team-name.js';
import {
  createClaudeDetachedWorkerSession,
  buildClaudeWorkerSessionIdentity,
  killClaudeDetachedWorkerSession,
} from '../platform/claude-code/tmux.js';
import {
  buildClaudeWorkerSessionName,
  sanitizeClaudeSessionNamePart,
} from '../platform/claude-code/upstream/tmux/imported/session-name.js';
import {
  createClaudeDetachedSession,
  killClaudeDetachedSession,
} from '../platform/claude-code/upstream/tmux/imported/detached-session.js';

test('codex imported tmux helper sanitizes team names with lowercase hyphen rules', () => {
  assert.equal(sanitizeCodexTeamName('My Team!'), 'my-team');
  assert.equal(sanitizeCodexTeamName('Alpha___Beta'), 'alpha-beta');
});

test('claude-code imported tmux helpers sanitize parts and build worker session names', () => {
  assert.equal(sanitizeClaudeSessionNamePart('worker@1!'), 'worker1');
  assert.equal(
    buildClaudeWorkerSessionName('my team!', 'work@er'),
    'omc-team-myteam-worker',
  );
});

test('codex platform tmux helper builds leader-attached hook identity from imported helpers', () => {
  assert.deepEqual(
    buildCodexLeaderAttachedHookIdentity('Team A', 'Session:Main', '0', '%12'),
    {
      target: 'Session:Main:0',
      hookName: 'omx_resize_Team_A_Session_Main_0_12',
    },
  );
});

test('codex platform tmux helper builds resize hook registration args from imported helpers', () => {
  const registration = buildCodexResizeHookRegistration(
    'my-session',
    '0',
    'Team A',
    '%12',
  );

  assert.equal(registration.target, 'my-session:0');
  assert.equal(registration.hookName, 'omx_resize_Team_A_my-session_0_12');
  assert.equal(registration.registerArgs[0], 'set-hook');
  assert.equal(registration.registerArgs[1], '-t');
  assert.equal(registration.registerArgs[2], 'my-session:0');
  assert.match(registration.registerArgs[3] ?? '', /^client-resized\[\d+\]$/);
  assert.equal(
    registration.registerArgs[4],
    "run-shell -b 'tmux resize-pane -t %12 -y 3 >/dev/null 2>&1 || true'",
  );
  assert.deepEqual(registration.unregisterArgs, [
    'set-hook',
    '-u',
    '-t',
    'my-session:0',
    registration.registerArgs[3] as string,
  ]);
});

test('claude-code platform tmux helper builds detached worker session identity from imported helper', () => {
  assert.equal(
    buildClaudeWorkerSessionIdentity('my team!', 'work@er'),
    'omc-team-myteam-worker',
  );
});

test('claude-code imported detached session helpers invoke tmux with detached session args', async () => {
  const fakeBin = await mkdtemp(join(tmpdir(), 'shift-ax-fake-tmux-'));
  const tmuxLog = join(fakeBin, 'tmux.log');
  const tmuxStub = join(fakeBin, 'tmux');
  const previousPath = process.env.PATH;

  try {
    await writeFile(
      tmuxStub,
      `#!/bin/sh
echo "$@" >> "${tmuxLog}"
exit 0
`,
      'utf8',
    );
    await chmod(tmuxStub, 0o755);
    process.env.PATH = `${fakeBin}:${previousPath ?? ''}`;

    const session = createClaudeDetachedSession('my team!', 'work@er', '/repo/worktree');
    assert.equal(session, 'omc-team-myteam-worker');

    killClaudeDetachedSession('my team!', 'work@er');

    const log = await readFile(tmuxLog, 'utf8');
    assert.match(log, /kill-session -t omc-team-myteam-worker/);
    assert.match(log, /new-session -d -s omc-team-myteam-worker -x 200 -y 50 -c \/repo\/worktree/);
  } finally {
    if (typeof previousPath === 'string') process.env.PATH = previousPath;
    else delete process.env.PATH;
    await rm(fakeBin, { recursive: true, force: true });
  }
});

test('claude-code platform tmux wrapper creates and kills detached worker sessions through imported helpers', async () => {
  const fakeBin = await mkdtemp(join(tmpdir(), 'shift-ax-fake-tmux-wrapper-'));
  const tmuxLog = join(fakeBin, 'tmux.log');
  const tmuxStub = join(fakeBin, 'tmux');
  const previousPath = process.env.PATH;

  try {
    await writeFile(
      tmuxStub,
      `#!/bin/sh
echo "$@" >> "${tmuxLog}"
exit 0
`,
      'utf8',
    );
    await chmod(tmuxStub, 0o755);
    process.env.PATH = `${fakeBin}:${previousPath ?? ''}`;

    const session = createClaudeDetachedWorkerSession('my team!', 'work@er', '/repo/worktree');
    assert.equal(session, 'omc-team-myteam-worker');

    killClaudeDetachedWorkerSession('my team!', 'work@er');

    const log = await readFile(tmuxLog, 'utf8');
    assert.match(log, /new-session -d -s omc-team-myteam-worker -x 200 -y 50 -c \/repo\/worktree/);
    assert.match(log, /kill-session -t omc-team-myteam-worker/);
  } finally {
    if (typeof previousPath === 'string') process.env.PATH = previousPath;
    else delete process.env.PATH;
    await rm(fakeBin, { recursive: true, force: true });
  }
});

test('tmux imported provenance metadata pins upstream source commits and files', async () => {
  const codexRaw = await readFile(
    new URL('../platform/codex/upstream/tmux/imported/provenance.json', import.meta.url),
    'utf8',
  );
  const codexHooksRaw = await readFile(
    new URL('../platform/codex/upstream/tmux/imported/resize-hooks.provenance.json', import.meta.url),
    'utf8',
  );
  const claudeRaw = await readFile(
    new URL('../platform/claude-code/upstream/tmux/imported/provenance.json', import.meta.url),
    'utf8',
  );
  const claudeDetachedRaw = await readFile(
    new URL(
      '../platform/claude-code/upstream/tmux/imported/detached-session.provenance.json',
      import.meta.url,
    ),
    'utf8',
  );

  const codex = JSON.parse(codexRaw) as {
    source_commit: string;
    source_file: string;
  };
  const codexHooks = JSON.parse(codexHooksRaw) as {
    source_commit: string;
    source_file: string;
  };
  const codexRegistrationRaw = await readFile(
    new URL(
      '../platform/codex/upstream/tmux/imported/resize-hook-registration.provenance.json',
      import.meta.url,
    ),
    'utf8',
  );
  const codexRegistration = JSON.parse(codexRegistrationRaw) as {
    source_commit: string;
    source_file: string;
  };
  const claude = JSON.parse(claudeRaw) as {
    source_commit: string;
    source_file: string;
  };
  const claudeDetached = JSON.parse(claudeDetachedRaw) as {
    source_commit: string;
    source_file: string;
  };

  assert.equal(codex.source_commit, 'fabb3ce0b96e42c20feb2940c74f2aa5addb8cee');
  assert.equal(codex.source_file, 'src/team/tmux-session.ts');
  assert.equal(codexHooks.source_commit, 'fabb3ce0b96e42c20feb2940c74f2aa5addb8cee');
  assert.equal(codexHooks.source_file, 'src/team/tmux-session.ts');
  assert.equal(
    codexRegistration.source_commit,
    'fabb3ce0b96e42c20feb2940c74f2aa5addb8cee',
  );
  assert.equal(codexRegistration.source_file, 'src/team/tmux-session.ts');
  assert.equal(claude.source_commit, '2487d3878f8d25e60802940b020d5ee8774d135e');
  assert.equal(claude.source_file, 'src/team/tmux-session.ts');
  assert.equal(claudeDetached.source_commit, '2487d3878f8d25e60802940b020d5ee8774d135e');
  assert.equal(claudeDetached.source_file, 'src/team/tmux-session.ts');
});
