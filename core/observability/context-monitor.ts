import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { assessContextHealth } from './context-health.js';
import { getRootDirFromTopicDir } from '../topics/topic-artifacts.js';

export async function writeContextMonitorSnapshot({
  rootDir,
  topicDir,
  query,
  maxChars = 6000,
  outputPath,
}: {
  rootDir?: string;
  topicDir?: string;
  query: string;
  maxChars?: number;
  outputPath?: string;
}): Promise<{ output_path: string; status: 'ok' | 'warn' | 'critical' }> {
  const report = await assessContextHealth({
    ...(rootDir ? { rootDir } : {}),
    ...(topicDir ? { topicDir } : {}),
    query,
    maxChars,
  });
  const effectiveRoot = rootDir || (topicDir ? getRootDirFromTopicDir(topicDir) : '');
  const targetPath =
    outputPath || join(effectiveRoot, '.ax', 'context-monitor.json');
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(
    targetPath,
    `${JSON.stringify(
      {
        status: report.status,
        should_pause: report.status === 'critical',
        recommendation: report.recommendation,
        query,
        max_chars: report.bundle.max_chars,
        total_source_chars: report.bundle.total_source_chars,
        truncated: report.bundle.truncated,
        issues: report.bundle.issues,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return {
    output_path: targetPath,
    status: report.status,
  };
}
