import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax build-context-bundle prints a docs-first bundle summary', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-context-bundle-cli-'));

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
        ['--import', 'tsx', 'scripts/ax.ts', 'build-context-bundle', '--root', root, '--query', 'refund traceability'],
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
        else reject(new Error(error || `ax build-context-bundle exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as {
      sections: Array<{ kind: string }>;
      rendered: string;
    };
    assert.equal(result.sections[0]?.kind, 'base_context');
    assert.match(result.rendered, /Audit Policy/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ax init-context writes a bundle markdown file for a workflow step', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-init-context-cli-'));

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
        ['--import', 'tsx', 'scripts/ax.ts', 'init-context', '--root', root, '--query', 'refund traceability'],
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
        else reject(new Error(error || `ax init-context exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as { output_path: string; status: string; issues_count: number };
    assert.equal(result.status, 'ok');
    assert.equal(result.issues_count, 0);
    const written = await readFile(result.output_path, 'utf8');
    assert.match(written, /## Base Context/);
    assert.match(written, /Audit Policy/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
