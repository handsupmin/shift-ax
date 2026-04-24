import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { parseIndexDocument } from '../context/index-resolver.js';
import { summarizeTopicStatus, type ShiftAxTopicStatusSummary } from '../observability/topic-status.js';
import { getProjectProfilePath, readProjectProfile } from '../policies/project-profile.js';
import { getGlobalContextHome } from '../settings/global-context-home.js';

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
    quality_issues: string[];
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
  const home = getGlobalContextHome();
  const indexPath = home.indexPath;
  if (!existsSync(indexPath)) {
    return {
      status: 'fail',
      message: 'Global Shift AX index is missing.',
      index_path: indexPath,
      entry_count: 0,
      missing_paths: [],
      quality_issues: ['Global Shift AX index is missing.'],
    };
  }

  const rawIndex = await readFile(indexPath, 'utf8');
  const entries = parseIndexDocument(rawIndex);
  const missingPaths = entries
    .map((entry) => entry.path)
    .filter((path) => !existsSync(resolve(home.root, path)));
  const qualityIssues = inspectGlobalIndexQuality(rawIndex, entries);
  qualityIssues.push(
    ...missingPaths.map((path) => `Index points to a missing document: ${path}.`),
  );

  return {
    status: qualityIssues.some((issue) => /missing|must not|path-like|unresolved|duplicate/i.test(issue)) ? 'fail' : qualityIssues.length > 0 ? 'warn' : 'ok',
    message:
      missingPaths.length > 0
        ? 'Global index includes unresolved or missing document paths.'
        : qualityIssues.length > 0
        ? 'Global index has quality issues.'
        : 'Global index and linked documents are present.',
    index_path: indexPath,
    entry_count: entries.length,
    missing_paths: missingPaths,
    quality_issues: qualityIssues,
  };
}

function inspectGlobalIndexQuality(rawIndex: string, entries: Array<{ label: string; path: string }>): string[] {
  const issues: string[] = [];
  const labels = new Set<string>();
  const categories = new Set<string>();

  for (const line of rawIndex.split(/\r?\n/)) {
    const heading = line.trim().match(/^##\s+(.+)$/);
    if (heading) categories.add(heading[1]!.trim());
  }

  if (entries.length === 0) {
    issues.push('Global index has no dictionary entries.');
  }

  for (const entry of entries) {
    const key = entry.label.toLowerCase();
    if (labels.has(key)) issues.push(`Duplicate dictionary label: ${entry.label}.`);
    labels.add(key);
    if (/^\.?\/?[\w-]+\/.+\.md$/i.test(entry.label) || /\.md$/i.test(entry.label)) {
      issues.push(`Dictionary label is path-like instead of a search term: ${entry.label}.`);
    }
    if (/^(repo|repository|domain|workflow|procedure|work type|role)\s*:/i.test(entry.label)) {
      issues.push(`Dictionary label should not keep category prefixes: ${entry.label}.`);
    }
    if (!entry.path || !/\.md$/i.test(entry.path)) {
      issues.push(`Dictionary entry must point to a markdown source doc: ${entry.label}.`);
    }
  }

  const required = ['Role', 'Work Types', 'Repositories', 'Procedures', 'Domain Language'];
  const missingCategories = required.filter((category) => !categories.has(category));
  if (entries.length >= 3 && missingCategories.length > 0) {
    issues.push(`Global index is missing dictionary sections: ${missingCategories.join(', ')}.`);
  }

  return [...new Set(issues)];
}

async function checkProfile(rootDir: string): Promise<ShiftAxDoctorReport['profile']> {
  const path = getProjectProfilePath(rootDir);
  const profile = await readProjectProfile(rootDir);

  return {
    status: profile ? 'ok' : 'fail',
    message: profile
      ? 'Global Shift AX profile is available.'
      : 'Global Shift AX profile is missing. Run `/onboarding` or `shift-ax onboard-context` first.',
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
