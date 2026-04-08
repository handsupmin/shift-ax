import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ShiftAxTopicStatusSummary {
  topic_slug: string;
  phase: string;
  review_status: string;
  execution_status: string;
  policy_context_status?: 'not_needed' | 'required' | 'completed';
  last_event?: {
    event: string;
    summary: string;
    recorded_at: string;
  };
  last_reaction?: {
    key: string;
    action: string;
    outcome: string;
    recorded_at: string;
  };
  last_failure_reason?: string;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function summarizeTopicStatus(topicDir: string): Promise<ShiftAxTopicStatusSummary> {
  const [workflow, executionState, aggregate, policyContextSync, lifecycle, reactions] = await Promise.all([
    readJson<{ topic_slug?: string; phase?: string }>(join(topicDir, 'workflow-state.json'), {}),
    readJson<{ overall_status?: string }>(join(topicDir, 'execution-state.json'), {}),
    readJson<{ overall_status?: string }>(join(topicDir, 'review', 'aggregate.json'), {}),
    readJson<{ status?: 'not_needed' | 'required' | 'completed' }>(
      join(topicDir, 'policy-context-sync.json'),
      {},
    ),
    readJson<Array<{ event: string; summary: string; recorded_at: string }>>(
      join(topicDir, 'lifecycle-log.json'),
      [],
    ),
    readJson<Array<{ key: string; action: string; outcome: string; recorded_at: string }>>(
      join(topicDir, 'reaction-log.json'),
      [],
    ),
  ]);

  const lastEvent = lifecycle.length > 0 ? lifecycle[lifecycle.length - 1] : undefined;
  const lastReaction = reactions.length > 0 ? reactions[reactions.length - 1] : undefined;

  return {
    topic_slug: workflow.topic_slug ?? topicDir.split('/').pop() ?? 'unknown-topic',
    phase: workflow.phase ?? 'unknown',
    review_status: aggregate.overall_status ?? 'unknown',
    execution_status: executionState.overall_status ?? 'unknown',
    ...(policyContextSync.status ? { policy_context_status: policyContextSync.status } : {}),
    ...(lastEvent ? { last_event: lastEvent } : {}),
    ...(lastReaction ? { last_reaction: lastReaction } : {}),
    ...(policyContextSync.status === 'required'
      ? { last_failure_reason: 'policy context sync is required before implementation can start' }
      : {}),
    ...(lastReaction?.outcome && lastReaction.outcome !== 'approved'
      ? { last_failure_reason: `${lastReaction.key}: ${lastReaction.outcome}` }
      : lastEvent && /fail|blocked|changes/i.test(lastEvent.summary)
        ? { last_failure_reason: lastEvent.summary }
        : {}),
  };
}
