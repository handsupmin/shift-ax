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
      if (topic.last_failure_reason) {
        lines.push(`  - latest issue: ${topic.last_failure_reason}`);
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
}: {
  topicDir: string;
  summary: string;
  nextStep?: string;
  commands?: string[];
}): Promise<{ output_path: string }> {
  const status = await summarizeTopicStatus(topicDir);
  const lines = [
    '# Topic Handoff',
    '',
    `- topic: ${status.topic_slug}`,
    `- phase: ${status.phase}`,
    `- review: ${status.review_status}`,
    `- execution: ${status.execution_status}`,
    '',
    '## Summary',
    '',
    summary.trim(),
    '',
  ];

  if (nextStep?.trim()) {
    lines.push('## Next Step', '', nextStep.trim(), '');
  }

  if (commands.length > 0) {
    lines.push('## Suggested Commands', '');
    for (const command of commands) {
      lines.push(`- \`${command}\``);
    }
    lines.push('');
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
}: {
  topicDir: string;
  summary: string;
  nextStep?: string;
  commands?: string[];
}): Promise<{ handoff_path: string; state_path: string }> {
  const handoff = await writeTopicHandoff({
    topicDir,
    summary,
    nextStep,
    commands,
  });
  const rootDir = getRootDirFromTopicDir(topicDir);
  const state = await writeRootStateSummary({ rootDir });
  return {
    handoff_path: handoff.output_path,
    state_path: state.output_path,
  };
}
