import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax context-health prints an operator-friendly status for the current query budget', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-context-health-cli-'));

  try {
    await mkdir(join(root, 'docs', 'base-context'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'base-context', 'audit-policy.md'),
      '# Audit Policy\n\nRefund changes must preserve customer-visible traceability.\n',
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
        ['--import', 'tsx', 'scripts/ax.ts', 'context-health', '--root', root, '--query', 'refund traceability'],
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
        else reject(new Error(error || `ax context-health exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as { status: string; recommendation: string };
    assert.equal(result.status, 'ok');
    assert.match(result.recommendation, /continue|safe/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
