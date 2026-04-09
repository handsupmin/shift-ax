#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const command = process.argv[2];
const args = process.argv.slice(3);
const shellMode =
  !command ||
  command === '--codex' ||
  command === '--claude-code' ||
  command === '--lang' ||
  command === '--root' ||
  command === '--discover' ||
  command === '--onboarding-input';

const commands = new Map<string, string>([
  ['bootstrap-topic', 'ax-bootstrap-topic.ts'],
  ['resolve-context', 'ax-resolve-context.ts'],
  ['build-context-bundle', 'ax-build-context-bundle.ts'],
  ['init-context', 'ax-init-context.ts'],
  ['context-health', 'ax-context-health.ts'],
  ['monitor-context', 'ax-monitor-context.ts'],
  ['refresh-state', 'ax-refresh-state.ts'],
  ['pause-work', 'ax-pause-work.ts'],
  ['checkpoint-context', 'ax-checkpoint-context.ts'],
  ['thread-save', 'ax-thread-save.ts'],
  ['threads', 'ax-threads.ts'],
  ['promote-thread', 'ax-promote-thread.ts'],
  ['verification-debt', 'ax-verification-debt.ts'],
  ['learned-debug-save', 'ax-learned-debug-save.ts'],
  ['learned-debug', 'ax-learned-debug.ts'],
  ['consolidate-memory', 'ax-consolidate-memory.ts'],
  ['team-preferences', 'ax-team-preferences.ts'],
  ['entity-memory', 'ax-entity-memory.ts'],
  ['review', 'ax-review.ts'],
  ['worktree-plan', 'ax-worktree-plan.ts'],
  ['worktree-create', 'ax-worktree-create.ts'],
  ['worktree-remove', 'ax-worktree-remove.ts'],
  ['onboard-context', 'ax-onboard-context.ts'],
  ['doctor', 'ax-doctor.ts'],
  ['run-request', 'ax-run-request.ts'],
  ['approve-plan', 'ax-approve-plan.ts'],
  ['sync-policy-context', 'ax-sync-policy-context.ts'],
  ['react-feedback', 'ax-react-feedback.ts'],
  ['finalize-commit', 'ax-finalize-commit.ts'],
  ['launch-execution', 'ax-launch-execution.ts'],
  ['topic-status', 'ax-topic-status.ts'],
  ['topics-status', 'ax-topics-status.ts'],
  ['recall-topics', 'ax-recall-topics.ts'],
  ['recall', 'ax-recall.ts'],
  ['decisions', 'ax-decisions.ts'],
  ['platform-manifest', 'ax-platform-manifest.ts'],
  ['bootstrap-assets', 'ax-bootstrap-assets.ts'],
  ['scaffold-build', 'ax-scaffold-build.ts'],
]);

if (shellMode) {
  const child = spawn(process.execPath, ['--import', 'tsx', join(here, 'ax-shell.ts'), ...process.argv.slice(2)], {
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
} else if (!commands.has(command)) {
  process.stderr.write(
    [
      'Shift AX CLI',
      '',
      'Shell launcher:',
      '  ax --codex [--root DIR] [--lang en|ko] [--discover] [--onboarding-input FILE] [initial prompt]',
      '  ax --claude-code [--root DIR] [--lang en|ko] [--discover] [--onboarding-input FILE] [initial prompt]',
      '  ax  # interactive launcher that picks language/platform and auto-onboards on first run',
      '',
      'Commands:',
      '  ax bootstrap-topic --request "<text>" [--summary "<text>"] [--root DIR]',
      '  ax resolve-context [--index PATH] --query "<text>" [--root DIR] [--max N]',
      '  ax build-context-bundle [--root DIR] [--topic DIR] --query "<text>" [--max-chars N] [--output PATH]',
      '  ax init-context [--root DIR] [--topic DIR] --query "<text>" [--max-chars N] [--workflow-step NAME] [--output PATH]',
      '  ax context-health [--root DIR] [--topic DIR] --query "<text>" [--max-chars N]',
      '  ax refresh-state [--root DIR] [--limit N]',
      '  ax pause-work --topic DIR --summary "<text>" [--next-step "<text>"] [--command "<text>"]...',
      '  ax checkpoint-context --topic DIR --summary "<text>"',
      '  ax thread-save --root DIR --name NAME [--summary "<text>"] --note "<text>"',
      '  ax threads [--root DIR]',
      '  ax verification-debt [--root DIR] [--topic DIR]',
      '  ax learned-debug-save --root DIR --summary "<text>" --resolution "<text>" [--occurrences N] [--approved] [--fix-commit SHA]',
      '  ax learned-debug [--root DIR] [--query "<text>"]',
      '  ax review --topic DIR [--run]',
      '  ax worktree-plan --topic DIR',
      '  ax worktree-create --topic DIR [--base BRANCH]',
      '  ax worktree-remove --topic DIR',
      '  ax onboard-context [--input FILE] [--root DIR]',
      '  ax doctor [--root DIR] [--topic DIR] [--platform <codex|claude-code>]',
      '  ax run-request --request "<text>" [--summary "<text>"] [--brainstorm-file PATH] [--spec-file PATH] [--plan-file PATH] [--index PATH] [--root DIR] [--base BRANCH]  # interactive planning by default',
      '  ax run-request --topic DIR --resume [--verify-command CMD]... [--escalation KIND[:summary]]... [--clear-escalations] [--escalation-resolution "<text>"] [--no-auto-commit]',
      '  ax approve-plan --topic DIR --reviewer NAME --decision <approve|reject> [--notes "<text>"]',
      '  ax sync-policy-context --topic DIR --summary "<text>" [--path REL_PATH]... [--entry "Label -> path"]...',
      '  ax react-feedback --topic DIR --kind <review-changes-requested|ci-failed> --summary "<text>"',
      '  ax finalize-commit --topic DIR [--message-file PATH]',
      '  ax launch-execution --platform <codex|claude-code> --topic DIR [--task-id ID] [--dry-run]',
      '  ax topic-status --topic DIR',
      '  ax topics-status [--root DIR] [--limit N]',
      '  ax recall-topics --query "<text>" [--root DIR] [--limit N]',
      '  ax decisions [--root DIR] [--query "<text>"] [--active-at YYYY-MM-DD] [--limit N]',
      '',
      'Advanced support-layer commands exist but are intentionally omitted from default help to keep the operator surface compact.',
      '  ax platform-manifest --platform <codex|claude-code> [--root DIR]',
      '  ax bootstrap-assets --platform <codex|claude-code> [--root DIR]',
      '  ax scaffold-build --platform <codex|claude-code> [--root DIR]',
      '',
    ].join('\n'),
  );
  process.exit(command ? 1 : 0);
} else {
  const child = spawn(process.execPath, ['--import', 'tsx', join(here, commands.get(command)!), ...args], {
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}
