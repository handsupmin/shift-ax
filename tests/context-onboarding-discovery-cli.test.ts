import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('ax-onboard-context --discover seeds the index from existing docs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-onboard-discovery-cli-'));

  try {
    await mkdir(join(root, 'docs', 'architecture'), { recursive: true });
    await writeFile(
      join(root, 'docs', 'architecture', 'system-overview.md'),
      '# System Overview\n\nArchitecture details.\n',
      'utf8',
    );

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax-onboard-context.ts', '--root', root, '--discover'],
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
        else reject(new Error(error || `ax-onboard-context exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as { documents: Array<{ path: string }> };
    const index = await readFile(join(root, 'docs', 'base-context', 'index.md'), 'utf8');

    assert.equal(result.documents.length, 2);
    assert.equal(result.documents[0]?.path, 'docs/architecture/system-overview.md');
    assert.equal(result.documents[1]?.path, 'docs/base-context/domain-glossary.md');
    assert.match(index, /System Overview -> docs\/architecture\/system-overview.md/);
    assert.match(index, /Domain Glossary -> docs\/base-context\/domain-glossary\.md/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
