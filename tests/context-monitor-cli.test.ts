import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax monitor-context writes a snapshot file and returns the current health state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-context-monitor-cli-'));

  try {
    await mkdir(join(root, 'docs', 'base-context'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'base-context', 'audit-policy.md'),
      '# Audit Policy\n\n' + 'refund traceability '.repeat(250),
      'utf8',
    );
    await writeFile(
      join(root, 'docs', 'base-context', 'index.md'),
      '# Base Context Index\n\n- Audit Policy -> docs/base-context/audit-policy.md\n',
      'utf8',
    );

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', 'monitor-context', '--root', root, '--query', 'refund traceability', '--max-chars', '500'],
        {
          cwd: REPO_ROOT,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let output = '';
      let error = '';
      child.stdout.on('data', (chunk) => {
        output += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk) => {
        error += chunk.toString('utf8');
      });
      child.on('exit', (code) => {
        if (code === 0) resolve(output);
        else reject(new Error(error || `ax monitor-context exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as { output_path: string; status: string };
    assert.equal(result.status, 'critical');
    const snapshot = JSON.parse(await readFile(result.output_path, 'utf8')) as { should_pause: boolean };
    assert.equal(snapshot.should_pause, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
