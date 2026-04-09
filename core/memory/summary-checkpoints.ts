import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function writeTopicSummaryCheckpoint({
  topicDir,
  summary,
  now = new Date(),
}: {
  topicDir: string;
  summary: string;
  now?: Date;
}): Promise<{ output_path: string }> {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const outputPath = join(topicDir, 'checkpoints', `${stamp}-summary.md`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `# Context Checkpoint\n\n- recorded_at: ${now.toISOString()}\n\n## Summary\n\n${summary.trim()}\n`,
    'utf8',
  );
  return { output_path: outputPath };
}
