import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  buildTopicLoreCommitMessage,
  validateLoreCommitMessage,
} from './commit-message.js';
import {
  readWorkflowState,
  type ShiftAxWorkflowVerification,
  writeWorkflowState,
} from '../planning/workflow-state.js';
import {
  getRootDirFromTopicDir,
  topicArtifactPath,
} from '../topics/topic-artifacts.js';
import { readProjectSettings } from '../settings/project-settings.js';

export interface FinalizeTopicCommitInput {
  topicDir: string;
  message?: string;
  now?: Date;
}

export interface FinalizeTopicCommitResult {
  version: 1;
  status: 'committed';
  commit_sha: string;
  committed_at: string;
  git_cwd: string;
  message_path: string;
  review_summary_path: string;
}

interface AggregateReviewFixture {
  commit_allowed: boolean;
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

async function resolveGitCwd(topicDir: string): Promise<string> {
  const rootDir = getRootDirFromTopicDir(topicDir);

  try {
    const raw = await readFile(topicArtifactPath(topicDir, 'worktree_state'), 'utf8');
    const parsed = JSON.parse(raw) as { worktree_path?: string; status?: string };
    if (
      parsed.worktree_path &&
      ['created', 'reused'].includes(String(parsed.status || '')) &&
      existsSync(parsed.worktree_path)
    ) {
      return parsed.worktree_path;
    }
  } catch {
    // ignore and fall back
  }

  return rootDir;
}

async function readAggregateReview(topicDir: string): Promise<AggregateReviewFixture> {
  const raw = await readFile(join(topicDir, 'review', 'aggregate.json'), 'utf8');
  return JSON.parse(raw) as AggregateReviewFixture;
}

async function readCommitMessage(topicDir: string, message?: string): Promise<string> {
  if (message && message.trim() !== '') {
    return message;
  }

  return readFile(topicArtifactPath(topicDir, 'commit_message'), 'utf8');
}

async function readTopicRequest(topicDir: string): Promise<{
  request: string;
  requestSummary: string;
  topicSlug?: string;
  verification: ShiftAxWorkflowVerification[];
}> {
  const [request, requestSummary] = await Promise.all([
    readFile(topicArtifactPath(topicDir, 'request'), 'utf8').catch(() => ''),
    readFile(topicArtifactPath(topicDir, 'request_summary'), 'utf8').catch(() => ''),
  ]);

  try {
    const workflow = await readWorkflowState(topicDir);
    return {
      request,
      requestSummary,
      topicSlug: workflow.topic_slug,
      verification: workflow.verification ?? [],
    };
  } catch {
    return {
      request,
      requestSummary,
      verification: [],
    };
  }
}

async function resolveCommitLocale(topicDir: string): Promise<'en' | 'ko'> {
  const rootDir = getRootDirFromTopicDir(topicDir);
  return (await readProjectSettings(rootDir))?.locale ?? 'en';
}

export async function ensureTopicCommitMessageArtifact({
  topicDir,
  verification,
}: {
  topicDir: string;
  verification?: ShiftAxWorkflowVerification[];
}): Promise<string> {
  const artifactPath = topicArtifactPath(topicDir, 'commit_message');
  const existing = await readFile(artifactPath, 'utf8').catch(() => '');

  if (validateLoreCommitMessage(existing).valid) {
    return existing;
  }

  const topic = await readTopicRequest(topicDir);
  const locale = await resolveCommitLocale(topicDir);
  const message = buildTopicLoreCommitMessage({
    request: topic.request,
    requestSummary: topic.requestSummary,
    topicSlug: topic.topicSlug,
    locale,
    verificationCommands: (verification ?? topic.verification)
      .filter((item) => item.exit_code === 0)
      .map((item) => item.command),
  });

  await writeFile(artifactPath, message, 'utf8');
  return message;
}

export async function finalizeTopicCommit({
  topicDir,
  message,
  now = new Date(),
}: FinalizeTopicCommitInput): Promise<FinalizeTopicCommitResult> {
  const aggregate = await readAggregateReview(topicDir);
  if (!aggregate.commit_allowed) {
    throw new Error('aggregate review commit_allowed=false; commit cannot proceed');
  }

  const artifactPath = topicArtifactPath(topicDir, 'commit_message');
  const commitMessage =
    message && message.trim() !== ''
      ? message
      : await ensureTopicCommitMessageArtifact({ topicDir });
  const validation = validateLoreCommitMessage(commitMessage);
  if (!validation.valid) {
    throw new Error(validation.issues.join('\n'));
  }

  if (message && message.trim() !== '') {
    await writeFile(artifactPath, `${commitMessage.trimEnd()}\n`, 'utf8');
  } else {
    const storedMessage = await readCommitMessage(topicDir).catch(() => '');
    if (storedMessage !== commitMessage) {
      await writeFile(artifactPath, `${commitMessage.trimEnd()}\n`, 'utf8');
    }
  }

  const gitCwd = await resolveGitCwd(topicDir);
  const status = runGit(gitCwd, ['status', '--porcelain']);
  if (status.trim() === '') {
    throw new Error('No git changes are available to commit.');
  }

  runGit(gitCwd, ['add', '-A']);
  runGit(gitCwd, ['commit', '-F', artifactPath]);
  const commitSha = runGit(gitCwd, ['rev-parse', 'HEAD']);

  const result: FinalizeTopicCommitResult = {
    version: 1,
    status: 'committed',
    commit_sha: commitSha,
    committed_at: now.toISOString(),
    git_cwd: gitCwd,
    message_path: artifactPath,
    review_summary_path: join(topicDir, 'review', 'summary.md'),
  };

  await writeFile(
    topicArtifactPath(topicDir, 'commit_state'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );

  try {
    const workflow = await readWorkflowState(topicDir);
    workflow.phase = 'committed';
    workflow.updated_at = now.toISOString();
    await writeWorkflowState(topicDir, workflow);
  } catch {
    // ignore missing workflow state in fixture tests
  }

  return result;
}
