import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ShiftAxVerificationDebtItem {
  topic_slug: string;
  kind: 'verification_command' | 'review_issue';
  message: string;
}

async function readMaybe(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

async function readTopicDebt(topicDir: string): Promise<ShiftAxVerificationDebtItem[]> {
  const workflowRaw = await readMaybe(join(topicDir, 'workflow-state.json'));
  if (!workflowRaw) return [];
  const workflow = JSON.parse(workflowRaw) as {
    topic_slug?: string;
    verification?: Array<{ command?: string; source?: 'local' | 'ci'; exit_code?: number }>;
  };
  const topicSlug = workflow.topic_slug || topicDir.split('/').pop() || 'unknown-topic';
  const debt: ShiftAxVerificationDebtItem[] = [];

  if ((workflow.verification ?? []).length === 0) {
    debt.push({
      topic_slug: topicSlug,
      kind: 'verification_command',
      message: 'Verification was skipped or not recorded.',
    });
  }

  for (const item of workflow.verification ?? []) {
    if ((item.exit_code ?? 0) !== 0) {
      debt.push({
        topic_slug: topicSlug,
        kind: 'verification_command',
        message: `${
          item.source === 'ci' ? 'CI verification failed' : 'Verification command failed'
        }: ${item.command ?? 'unknown command'}`,
      });
    }
  }

  const reviewDir = join(topicDir, 'review');
  const reviewFiles = await readdir(reviewDir).catch(() => []);
  for (const file of reviewFiles) {
    if (!file.endsWith('.json') || file === 'aggregate.json') continue;
    const raw = await readMaybe(join(reviewDir, file));
    if (!raw) continue;
    const parsed = JSON.parse(raw) as {
      lane?: string;
      status?: string;
      issues?: Array<{ message?: string; deferred?: boolean }>;
      deferred_items?: string[];
      summary?: string;
    };
    if (parsed.status === 'approved') continue;
    if ((parsed.issues ?? []).length > 0) {
      for (const issue of parsed.issues ?? []) {
        debt.push({
          topic_slug: topicSlug,
          kind: 'review_issue',
          message: `${parsed.lane ?? 'review'}: ${issue.message ?? parsed.summary ?? 'review issue'}`,
        });
      }
    } else if (parsed.summary) {
      debt.push({
        topic_slug: topicSlug,
        kind: 'review_issue',
        message: `${parsed.lane ?? 'review'}: ${parsed.summary}`,
      });
    }
    for (const item of parsed.deferred_items ?? []) {
      debt.push({
        topic_slug: topicSlug,
        kind: 'review_issue',
        message: `${parsed.lane ?? 'review'} deferred verification: ${item}`,
      });
    }
  }

  return debt;
}

export async function listVerificationDebt({
  rootDir,
  topicDir,
}: {
  rootDir?: string;
  topicDir?: string;
}): Promise<ShiftAxVerificationDebtItem[]> {
  if (topicDir) {
    return readTopicDebt(topicDir);
  }

  if (!rootDir) {
    throw new Error('rootDir or topicDir is required');
  }

  const topicsRoot = join(rootDir, '.ax', 'topics');
  const entries = await readdir(topicsRoot, { withFileTypes: true }).catch(() => []);
  const all = await Promise.all(
    entries.filter((entry) => entry.isDirectory()).map((entry) => readTopicDebt(join(topicsRoot, entry.name))),
  );
  return all.flat();
}
