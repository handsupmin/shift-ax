import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { onboardProjectContext } from '../core/context/onboarding.js';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-doctor-cli-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  await writeFile(join(root, '.gitignore'), '.ax/\nnode_modules/\ndist/\n', 'utf8');
  execFileSync('git', ['add', 'README.md', '.gitignore'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

test('ax doctor prints a compact health report for an onboarded repo', async () => {
  const root = await createGitRepo();

  try {
    await onboardProjectContext({
      rootDir: root,
      documents: [
        {
          label: 'Auth policy',
          content: '# Auth Policy\n\nRefresh token rotation is required.\n',
        },
      ],
    });

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', 'doctor', '--root', root],
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
        else reject(new Error(error || `ax doctor exited ${code}`));
      });
    });

    const report = JSON.parse(stdout) as {
      overall_status: string;
      base_context: { status: string };
      profile: { status: string };
    };
    assert.equal(report.overall_status, 'ok');
    assert.equal(report.base_context.status, 'ok');
    assert.equal(report.profile.status, 'ok');

    const profile = JSON.parse(await readFile(join(root, '.ax', 'project-profile.json'), 'utf8')) as {
      index_path: string;
    };
    assert.match(profile.index_path, /docs\/base-context\/index\.md$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
