import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { listTopicsStatus } from './topics-status.js';
import { summarizeTopicStatus } from './topic-status.js';
import { getRootDirFromTopicDir, topicArtifactPath } from '../topics/topic-artifacts.js';

export async function writeRootStateSummary({
  rootDir,
  limit = 10,
}: {
  rootDir: string;
  limit?: number;
}): Promise<{ output_path: string }> {
  const topics = await listTopicsStatus({ rootDir, limit });
  const lines = [
    '# Shift AX State',
    '',
    '## Active Topics',
    '',
  ];

  if (topics.length === 0) {
    lines.push('- No tracked topics yet.');
  } else {
    for (const topic of topics) {
      lines.push(`- ${topic.topic_slug}`);
      lines.push(`  - phase: ${topic.phase}`);
      lines.push(`  - review: ${topic.review_status}`);
      lines.push(`  - execution: ${topic.execution_status}`);
      if (topic.readiness) {
        lines.push(`  - readiness: ${topic.readiness}`);
      }
      if (topic.last_failure_reason) {
        lines.push(`  - latest issue: ${topic.last_failure_reason}`);
      }
      if (topic.next_step) {
        lines.push(`  - next step: ${topic.next_step}`);
      }
      if (topic.recommended_command) {
        lines.push(`  - command: ${topic.recommended_command}`);
      }
    }
  }

  const outputPath = join(rootDir, '.ax', 'STATE.md');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
  return { output_path: outputPath };
}

export async function writeTopicHandoff({
  topicDir,
  summary,
  nextStep,
  commands = [],
  remainingItems = [],
  recommendedCommand,
}: {
  topicDir: string;
  summary: string;
  nextStep?: string;
  commands?: string[];
  remainingItems?: string[];
  recommendedCommand?: string;
}): Promise<{ output_path: string }> {
  const status = await summarizeTopicStatus(topicDir);
  const lines = [
    '# Topic Handoff',
    '',
    `- topic: ${status.topic_slug}`,
    `- phase: ${status.phase}`,
    `- review: ${status.review_status}`,
    `- execution: ${status.execution_status}`,
    ...(status.readiness ? [`- readiness: ${status.readiness}`] : []),
    ...(status.branch_name ? [`- branch: ${status.branch_name}`] : []),
    ...(status.worktree_path ? [`- worktree: ${status.worktree_path}`] : []),
    ...(status.plan_fingerprint_status
      ? [`- plan_fingerprint: ${status.plan_fingerprint_status}`]
      : []),
    '',
    '## Summary',
    '',
    summary.trim(),
    '',
  ];

  if (remainingItems.length > 0) {
    lines.push('## Remaining Items', '');
    for (const item of remainingItems) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  if (nextStep?.trim()) {
    lines.push('## Next Step', '', nextStep.trim(), '');
  }

  const effectiveRecommendedCommand = recommendedCommand?.trim() || commands[0]?.trim();
  if (effectiveRecommendedCommand) {
    lines.push('## Recommended Command', '', `\`${effectiveRecommendedCommand}\``, '');
  }

  if (commands.length > 0) {
    lines.push('## Suggested Commands', '');
    for (const command of commands) {
      lines.push(`- \`${command}\``);
    }
    lines.push('');
  }

  if (status.latest_checkpoint?.summary) {
    lines.push('## Latest Checkpoint', '');
    if (status.latest_checkpoint.recorded_at) {
      lines.push(`- recorded_at: ${status.latest_checkpoint.recorded_at}`);
      lines.push('');
    }
    lines.push(status.latest_checkpoint.summary, '');
  }

  if (status.last_failure_reason) {
    lines.push('## Latest Failure Reason', '', status.last_failure_reason, '');
  }

  const outputPath = topicArtifactPath(topicDir, 'handoff');
  await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
  return { output_path: outputPath };
}

export async function pauseTopicWork({
  topicDir,
  summary,
  nextStep,
  commands = [],
  remainingItems = [],
  recommendedCommand,
}: {
  topicDir: string;
  summary: string;
  nextStep?: string;
  commands?: string[];
  remainingItems?: string[];
  recommendedCommand?: string;
}): Promise<{ handoff_path: string; state_path: string }> {
  const handoff = await writeTopicHandoff({
    topicDir,
    summary,
    nextStep,
    commands,
    remainingItems,
    recommendedCommand,
  });
  const rootDir = getRootDirFromTopicDir(topicDir);
  const state = await writeRootStateSummary({ rootDir });
  return {
    handoff_path: handoff.output_path,
    state_path: state.output_path,
  };
}
