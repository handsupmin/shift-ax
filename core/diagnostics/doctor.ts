import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { parseIndexDocument } from '../context/index-resolver.js';
import { summarizeTopicStatus, type ShiftAxTopicStatusSummary } from '../observability/topic-status.js';
import { getProjectProfilePath, readProjectProfile } from '../policies/project-profile.js';

export type ShiftAxDoctorStatus = 'ok' | 'warn' | 'fail';

export interface ShiftAxDoctorCheck {
  status: ShiftAxDoctorStatus;
  message: string;
}

export interface ShiftAxDoctorReport {
  root_dir: string;
  overall_status: ShiftAxDoctorStatus;
  git: ShiftAxDoctorCheck & {
    repo_root?: string;
  };
  base_context: ShiftAxDoctorCheck & {
    index_path: string;
    entry_count: number;
    missing_paths: string[];
  };
  profile: ShiftAxDoctorCheck & {
    path: string;
  };
  topic?: (ShiftAxDoctorCheck & {
    topic_dir: string;
  } & ShiftAxTopicStatusSummary);
  launchers?: ShiftAxDoctorCheck & {
    platform: 'codex' | 'claude-code';
    checked_commands: string[];
    missing_commands: string[];
  };
}

function combineStatuses(statuses: ShiftAxDoctorStatus[]): ShiftAxDoctorStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  return 'ok';
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function defaultCommandExists(command: string): boolean {
  try {
    execFileSync('/bin/sh', ['-lc', `command -v ${shellQuote(command)} >/dev/null 2>&1`], {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function checkGitRoot(rootDir: string): ShiftAxDoctorReport['git'] {
  try {
    const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
    return {
      status: 'ok',
      message: 'Git repository is available.',
      repo_root: repoRoot,
    };
  } catch {
    return {
      status: 'fail',
      message: 'Git repository root could not be resolved.',
    };
  }
}

async function checkBaseContext(rootDir: string): Promise<ShiftAxDoctorReport['base_context']> {
  const indexPath = join(rootDir, 'docs', 'base-context', 'index.md');
  if (!existsSync(indexPath)) {
    return {
      status: 'fail',
      message: 'Base-context index is missing.',
      index_path: indexPath,
      entry_count: 0,
      missing_paths: [],
    };
  }

  const rawIndex = await readFile(indexPath, 'utf8');
  const entries = parseIndexDocument(rawIndex);
  const missingPaths = entries
    .map((entry) => entry.path)
    .filter((path) => !existsSync(resolve(rootDir, path)));

  return {
    status: missingPaths.length > 0 ? 'fail' : 'ok',
    message:
      missingPaths.length > 0
        ? 'Base-context index includes unresolved or missing document paths.'
        : 'Base-context index and linked documents are present.',
    index_path: indexPath,
    entry_count: entries.length,
    missing_paths: missingPaths,
  };
}

async function checkProfile(rootDir: string): Promise<ShiftAxDoctorReport['profile']> {
  const path = getProjectProfilePath(rootDir);
  const profile = await readProjectProfile(rootDir);

  return {
    status: profile ? 'ok' : 'fail',
    message: profile
      ? 'Shared project profile is available.'
      : 'Project profile is missing. Run `ax onboard-context` first.',
    path,
  };
}

async function checkTopic(topicDir: string): Promise<ShiftAxDoctorReport['topic']> {
  if (!existsSync(topicDir)) {
    return {
      topic_dir: topicDir,
      topic_slug: topicDir.split('/').pop() || 'unknown-topic',
      phase: 'missing',
      review_status: 'unknown',
      execution_status: 'unknown',
      status: 'fail',
      message: 'Topic directory does not exist.',
    };
  }

  const summary = await summarizeTopicStatus(topicDir);
  const status =
    summary.phase === 'awaiting_policy_sync' ||
    summary.review_status === 'changes_requested' ||
    !!summary.last_failure_reason
      ? 'warn'
      : 'ok';

  return {
    ...summary,
    topic_dir: topicDir,
    status,
    message:
      status === 'warn'
        ? summary.last_failure_reason || 'Topic needs operator attention before it can continue.'
        : 'Topic artifacts look healthy.',
  };
}

function checkLaunchers({
  platform,
  commandExists = defaultCommandExists,
}: {
  platform: 'codex' | 'claude-code';
  commandExists?: (command: string) => boolean;
}): ShiftAxDoctorReport['launchers'] {
  const checkedCommands =
    platform === 'codex' ? ['codex', 'tmux'] : ['claude', 'tmux'];
  const missingCommands = checkedCommands.filter((command) => !commandExists(command));

  return {
    platform,
    checked_commands: checkedCommands,
    missing_commands: missingCommands,
    status: missingCommands.length > 0 ? 'warn' : 'ok',
    message:
      missingCommands.length > 0
        ? `Missing launcher commands for ${platform}: ${missingCommands.join(', ')}`
        : `Required launcher commands for ${platform} are available.`,
  };
}

export async function runDoctor({
  rootDir,
  topicDir,
  platform,
  commandExists,
}: {
  rootDir: string;
  topicDir?: string;
  platform?: 'codex' | 'claude-code';
  commandExists?: (command: string) => boolean;
}): Promise<ShiftAxDoctorReport> {
  const git = checkGitRoot(rootDir);
  const [baseContext, profile, topic] = await Promise.all([
    checkBaseContext(rootDir),
    checkProfile(rootDir),
    topicDir ? checkTopic(topicDir) : Promise.resolve(undefined),
  ]);
  const launchers = platform
    ? checkLaunchers({ platform, commandExists })
    : undefined;

  const overallStatus = combineStatuses([
    git.status,
    baseContext.status,
    profile.status,
    ...(topic ? [topic.status] : []),
    ...(launchers ? [launchers.status] : []),
  ]);

  return {
    root_dir: rootDir,
    overall_status: overallStatus,
    git,
    base_context: baseContext,
    profile,
    ...(topic ? { topic } : {}),
    ...(launchers ? { launchers } : {}),
  };
}
