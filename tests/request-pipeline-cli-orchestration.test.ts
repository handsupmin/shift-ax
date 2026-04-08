import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-cli-orchestrate-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Shift AX Test'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'shift-ax@example.com'], { cwd: root, stdio: 'pipe' });
  await writeFile(join(root, 'README.md'), '# repo\n', 'utf8');
  await writeFile(join(root, '.gitignore'), '.ax/\nnode_modules/\ndist/\n', 'utf8');
  execFileSync('git', ['add', 'README.md', '.gitignore'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  return root;
}

async function runAx(args: string[], input = '', env?: NodeJS.ProcessEnv): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'scripts/ax.ts', ...args],
      {
        cwd: REPO_ROOT,
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
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

test('ax run-request --resume --platform codex orchestrates execution before verification', async () => {
  const root = await createGitRepo();
  const binDir = await mkdtemp(join(tmpdir(), 'shift-ax-fake-codex-bin-'));

  try {
    const fakeCodex = join(binDir, 'codex');
    await writeFile(
      fakeCodex,
      `#!/bin/sh
set -eu
WORKDIR=""
OUTPUT=""
PROMPT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    exec|--full-auto)
      shift 1
      ;;
    -C)
      WORKDIR="$2"
      shift 2
      ;;
    -o)
      OUTPUT="$2"
      shift 2
      ;;
    *)
      PROMPT="$1"
      shift 1
      ;;
  esac
done
printf '%s\\n' "$PROMPT" > "$WORKDIR/prompt-captured.txt"
printf 'codex orchestrator smoke complete.\\n' > "$WORKDIR/smoke-marker.txt"
printf '{\"changed_files\":[\"smoke-marker.txt\",\"smoke-marker.test.js\"],\"summary\":\"Updated smoke-marker.txt and smoke-marker.test.js for the auth policy flow.\"}\\n' > "$OUTPUT"
`,
      'utf8',
    );
    await chmod(fakeCodex, 0o755);

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

    const env = {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
    };

    assert.equal(
      (await runAx(['onboard-context', '--root', root, '--input', onboardingPath], '', env)).code,
      0,
    );

    const started = await runAx(
      ['run-request', '--root', root, '--request', 'Create a smoke marker file'],
      [
        'Create smoke-marker.txt with the exact text codex orchestrator smoke complete.',
        'No schema changes.',
        'Do not add extra files.',
        'Verification should prove smoke-marker.txt exists.',
        'smoke-marker.txt',
        '',
        '',
      ].join('\n'),
      env,
    );
    assert.equal(started.code, 0, started.stderr);
    const startResult = JSON.parse(started.stdout) as {
      topicDir: string;
      worktree: { worktree_path: string };
    };

    assert.equal(
      (
        await runAx(
          [
            'approve-plan',
            '--topic',
            startResult.topicDir,
            '--reviewer',
            'Alex Reviewer',
            '--decision',
            'approve',
          ],
          '',
          env,
        )
      ).code,
      0,
    );

    await writeFile(
      join(startResult.worktree.worktree_path, 'smoke-marker.test.js'),
      [
        "import test from 'node:test';",
        "test('smoke marker exists for auth policy flow', () => {});",
        '',
      ].join('\n'),
      'utf8',
    );

    const resumed = await runAx(
      [
        'run-request',
        '--topic',
        startResult.topicDir,
        '--resume',
        '--platform',
        'codex',
        '--verify-command',
        'test -f smoke-marker.txt',
        '--no-auto-commit',
      ],
      '',
      env,
    );
    assert.equal(resumed.code, 0, resumed.stderr);

    const executionState = JSON.parse(
      await readFile(join(startResult.topicDir, 'execution-state.json'), 'utf8'),
    ) as { overall_status: string; tasks: Array<{ status: string }> };

    assert.equal(executionState.overall_status, 'completed');
    assert.equal(executionState.tasks[0]?.status, 'completed');
    assert.equal(
      (await readFile(join(startResult.worktree.worktree_path, 'smoke-marker.txt'), 'utf8')).trim(),
      'codex orchestrator smoke complete.',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(binDir, { recursive: true, force: true });
  }
});
