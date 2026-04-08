import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, sep, join } from 'node:path';

import { buildWorktreePlan, type ShiftAxWorktreePlan } from './worktree.js';

export interface TopicWorktreePlanInput {
  topicDir: string;
}

export interface TopicWorktreeTargetInput {
  topicDir: string;
  baseBranch?: string;
}

export interface TopicWorktreeCreateInput {
  topicDir: string;
  baseBranch?: string;
}

export interface TopicWorktreeCreateResult {
  version: 1;
  topic_slug: string;
  branch_name: string;
  worktree_path: string;
  base_branch: string;
  created: boolean;
  reused: boolean;
}

export interface TopicWorktreeRemoveInput {
  topicDir: string;
}

export interface TopicWorktreeRemoveResult {
  version: 1;
  topic_slug: string;
  branch_name: string;
  worktree_path: string;
  removed: boolean;
}

export interface ResolvedTopicWorktreeTarget {
  topicDir: string;
  rootDir: string;
  topicSlug: string;
  branchName: string;
  worktreePath: string;
  baseBranch: string;
}

interface TopicMetadata {
  topic_slug: string;
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function getRootDirFromTopicDir(topicDir: string): string {
  const resolved = resolve(topicDir);
  const marker = `${sep}.ax${sep}topics${sep}`;
  const index = resolved.lastIndexOf(marker);
  if (index === -1) {
    throw new Error(`topicDir is not inside .ax/topics: ${topicDir}`);
  }
  return resolved.slice(0, index);
}

async function readTopicMetadata(topicDir: string): Promise<TopicMetadata> {
  const raw = await readFile(join(topicDir, 'topic.json'), 'utf8');
  return JSON.parse(raw) as TopicMetadata;
}

async function readTopicRequest(topicDir: string): Promise<string> {
  return (await readFile(join(topicDir, 'request.md'), 'utf8')).trim();
}

async function writeWorktreeState(
  topicDir: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await writeFile(
    join(topicDir, 'worktree-state.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );
}

function isGitRepository(rootDir: string): boolean {
  try {
    runGit(rootDir, ['rev-parse', '--show-toplevel']);
    return true;
  } catch {
    return false;
  }
}

async function readWorktreePlan(topicDir: string): Promise<ShiftAxWorktreePlan> {
  const raw = await readFile(join(topicDir, 'worktree-plan.json'), 'utf8');
  return JSON.parse(raw) as ShiftAxWorktreePlan;
}

export async function planTopicWorktree({
  topicDir,
}: TopicWorktreePlanInput): Promise<ShiftAxWorktreePlan> {
  const rootDir = getRootDirFromTopicDir(topicDir);
  const metadata = await readTopicMetadata(topicDir);
  const request = await readTopicRequest(topicDir);
  const plan = buildWorktreePlan({
    rootDir,
    topicSlug: metadata.topic_slug,
    request,
  });

  await writeFile(
    join(topicDir, 'worktree-plan.json'),
    `${JSON.stringify(plan, null, 2)}\n`,
    'utf8',
  );

  return plan;
}

export async function resolveTopicWorktreeTarget({
  topicDir,
  baseBranch = 'main',
}: TopicWorktreeTargetInput): Promise<ResolvedTopicWorktreeTarget> {
  const rootDir = getRootDirFromTopicDir(topicDir);
  const metadata = await readTopicMetadata(topicDir);
  const plan =
    existsSync(join(topicDir, 'worktree-plan.json'))
      ? await readWorktreePlan(topicDir)
      : await planTopicWorktree({ topicDir });

  return {
    topicDir,
    rootDir,
    topicSlug: metadata.topic_slug,
    branchName: plan.preferred_branch_name,
    worktreePath: plan.preferred_worktree_path,
    baseBranch,
  };
}

export async function recordTopicWorktreeCreate(
  target: ResolvedTopicWorktreeTarget,
  state: { created: boolean; reused: boolean },
): Promise<TopicWorktreeCreateResult> {
  const result: TopicWorktreeCreateResult = {
    version: 1,
    topic_slug: target.topicSlug,
    branch_name: target.branchName,
    worktree_path: target.worktreePath,
    base_branch: target.baseBranch,
    created: state.created,
    reused: state.reused,
  };

  await writeWorktreeState(target.topicDir, {
    ...result,
    status: state.reused ? 'reused' : state.created ? 'created' : 'not_created',
  });

  return result;
}

export async function recordTopicWorktreeRemove(
  target: ResolvedTopicWorktreeTarget,
  removed: boolean,
): Promise<TopicWorktreeRemoveResult> {
  const result: TopicWorktreeRemoveResult = {
    version: 1,
    topic_slug: target.topicSlug,
    branch_name: target.branchName,
    worktree_path: target.worktreePath,
    removed,
  };

  await writeWorktreeState(target.topicDir, {
    ...result,
    status: removed ? 'removed' : 'remove_failed',
  });

  return result;
}

export async function createTopicWorktree({
  topicDir,
  baseBranch = 'main',
}: TopicWorktreeCreateInput): Promise<TopicWorktreeCreateResult> {
  const target = await resolveTopicWorktreeTarget({
    topicDir,
    baseBranch,
  });

  if (!isGitRepository(target.rootDir)) {
    throw new Error(`rootDir is not a git repository: ${target.rootDir}`);
  }

  if (existsSync(target.worktreePath)) {
    return recordTopicWorktreeCreate(target, {
      created: false,
      reused: true,
    });
  }

  runGit(target.rootDir, [
    'worktree',
    'add',
    '-b',
    target.branchName,
    target.worktreePath,
    target.baseBranch,
  ]);

  return recordTopicWorktreeCreate(target, {
    created: true,
    reused: false,
  });
}

export async function removeTopicWorktree({
  topicDir,
}: TopicWorktreeRemoveInput): Promise<TopicWorktreeRemoveResult> {
  const target = await resolveTopicWorktreeTarget({ topicDir });

  if (existsSync(target.worktreePath)) {
    runGit(target.rootDir, ['worktree', 'remove', '--force', target.worktreePath]);
  }

  try {
    runGit(target.rootDir, ['branch', '-D', target.branchName]);
  } catch {
    // Branch may already be absent.
  }

  return recordTopicWorktreeRemove(target, !existsSync(target.worktreePath));
}
