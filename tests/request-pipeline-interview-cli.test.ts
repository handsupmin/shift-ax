import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-interview-cli-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  await writeFile(join(root, '.gitignore'), '.ax/\nnode_modules/\ndist/\n', 'utf8');
  execFileSync('git', ['add', 'README.md', '.gitignore'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

async function runAxInteractive(args: string[], input: string): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'scripts/ax.ts', ...args],
      {
        cwd: '/Users/sangmin/sources/shift-ax',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
    child.stdin.end(input);
  });
}

test('ax run-request interviews for planning details and writes structured artifacts by default', async () => {
  const root = await createGitRepo();

  try {
    const onboardingPath = join(root, 'onboarding.json');
    await writeFile(
      onboardingPath,
      JSON.stringify(
        {
          documents: [
            {
              label: 'Auth policy',
              content: '# Auth Policy\n\nRefresh token rotation is required.\n',
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    const onboard = await runAxInteractive(
      ['onboard-context', '--root', root, '--input', onboardingPath],
      '',
    );
    assert.equal(onboard.code, 0, onboard.stderr);

    const started = await runAxInteractive(
      ['run-request', '--root', root, '--request', 'Build safer auth refresh flow'],
      [
        'Users should stay signed in during refresh token rotation.',
        'Auth policy applies and no schema changes are allowed.',
        'Do not change billing or the session UI.',
        'Verification needs auth refresh tests plus a clean build.',
        'Auth refresh service, token store, and session middleware.',
        'Token store migration analysis is the only long-running slice.',
        '',
      ].join('\n'),
    );

    assert.equal(started.code, 0, started.stderr);

    const startResult = JSON.parse(started.stdout) as {
      topicDir: string;
      workflow: { phase: string };
    };

    const brainstorm = await readFile(join(startResult.topicDir, 'brainstorm.md'), 'utf8');
    const spec = await readFile(join(startResult.topicDir, 'spec.md'), 'utf8');
    const plan = await readFile(join(startResult.topicDir, 'implementation-plan.md'), 'utf8');
    const handoff = await readFile(join(startResult.topicDir, 'execution-handoff.json'), 'utf8');

    assert.equal(startResult.workflow.phase, 'awaiting_plan_review');
    assert.match(brainstorm, /Clarified Outcome/i);
    assert.match(brainstorm, /Users should stay signed in/);
    assert.match(brainstorm, /No schema changes/i);
    assert.match(brainstorm, /Do not change billing/i);
    assert.match(spec, /Out of Scope/i);
    assert.match(spec, /session UI/i);
    assert.match(plan, /TDD/i);
    assert.match(plan, /tmux/i);
    assert.match(plan, /subagent/i);
    assert.match(handoff, /"execution_mode": "tmux"/);
    assert.match(handoff, /"execution_mode": "subagent"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
