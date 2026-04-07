#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const command = process.argv[2];
const args = process.argv.slice(3);

const commands = new Map<string, string>([
  ['bootstrap-topic', 'ax-bootstrap-topic.ts'],
  ['resolve-context', 'ax-resolve-context.ts'],
  ['review', 'ax-review.ts'],
  ['worktree-plan', 'ax-worktree-plan.ts'],
  ['worktree-create', 'ax-worktree-create.ts'],
  ['worktree-remove', 'ax-worktree-remove.ts'],
  ['onboard-context', 'ax-onboard-context.ts'],
  ['run-request', 'ax-run-request.ts'],
  ['approve-plan', 'ax-approve-plan.ts'],
  ['finalize-commit', 'ax-finalize-commit.ts'],
  ['platform-manifest', 'ax-platform-manifest.ts'],
  ['bootstrap-assets', 'ax-bootstrap-assets.ts'],
  ['scaffold-build', 'ax-scaffold-build.ts'],
]);

if (!command || !commands.has(command)) {
  process.stderr.write(
    [
      'Shift AX CLI',
      '',
      'Commands:',
      '  ax bootstrap-topic --request "<text>" [--summary "<text>"] [--root DIR]',
      '  ax resolve-context [--index PATH] --query "<text>" [--root DIR] [--max N]',
      '  ax review --topic DIR [--run]',
      '  ax worktree-plan --topic DIR',
      '  ax worktree-create --topic DIR [--base BRANCH]',
      '  ax worktree-remove --topic DIR',
      '  ax onboard-context [--input FILE] [--root DIR]',
      '  ax run-request --request "<text>" [--summary "<text>"] [--brainstorm-file PATH] [--spec-file PATH] [--plan-file PATH] [--index PATH] [--root DIR] [--base BRANCH]',
      '  ax run-request --topic DIR --resume [--verify-command CMD]... [--escalation KIND[:summary]]... [--clear-escalations] [--escalation-resolution "<text>"]',
      '  ax approve-plan --topic DIR --reviewer NAME --decision <approve|reject> [--notes "<text>"]',
      '  ax finalize-commit --topic DIR [--message-file PATH]',
      '  ax platform-manifest --platform <codex|claude-code> [--root DIR]',
      '  ax bootstrap-assets --platform <codex|claude-code> [--root DIR]',
      '  ax scaffold-build --platform <codex|claude-code> [--root DIR]',
      '',
    ].join('\n'),
  );
  process.exit(command ? 1 : 0);
}

const child = spawn(process.execPath, ['--import', 'tsx', join(here, commands.get(command)!), ...args], {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
