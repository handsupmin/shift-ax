import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('ax platform-manifest prints platform manifest for codex', async () => {
  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'scripts/ax.ts', 'platform-manifest', '--platform', 'codex', '--root', '/repo'],
      {
        cwd: '/Users/sangmin/sources/shift-ax',
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
      else reject(new Error(error || `ax platform-manifest exited ${code}`));
    });
  });

  const manifest = JSON.parse(stdout) as {
    platform: string;
    integration_mode: string;
    natural_language_first: boolean;
    worktree_support: string;
    core_commands: string[];
    execution_runtime: {
      support: string;
      operations: {
        launch: {
          command: string[];
        };
      };
    };
    tmux_runtime: {
      support: string;
      workspace_mode: string;
      upstream_boundary: {
        active_imports: Array<{
          source_commit: string;
          source_file: string;
        }>;
      };
    };
    worktree_runtime: {
      upstream_boundary: {
        active_imports: Array<{
          source_commit: string;
          source_file: string;
        }>;
      };
      operations: {
        create: {
          command: string[];
        };
      };
    };
  };

  assert.equal(manifest.platform, 'codex');
  assert.equal(manifest.integration_mode, 'agents-md-bootstrap');
  assert.equal(manifest.natural_language_first, true);
  assert.equal(manifest.worktree_support, 'available');
  assert.ok(manifest.core_commands.includes('onboard-context'));
  assert.ok(manifest.core_commands.includes('run-request'));
  assert.ok(manifest.core_commands.includes('approve-plan'));
  assert.ok(manifest.core_commands.includes('finalize-commit'));
  assert.ok(manifest.core_commands.includes('launch-execution'));
  assert.equal(manifest.execution_runtime.support, 'available');
  assert.deepEqual(manifest.execution_runtime.operations.launch.command, [
    'shift-ax',
    'launch-execution',
  ]);
  assert.equal(manifest.tmux_runtime.support, 'imported-helpers');
  assert.equal(manifest.tmux_runtime.workspace_mode, 'leader-attached-layout');
  assert.equal(manifest.tmux_runtime.upstream_boundary.active_imports.length, 3);
  assert.equal(
    manifest.tmux_runtime.upstream_boundary.active_imports[0].source_file,
    'src/team/tmux-session.ts',
  );
  assert.equal(
    manifest.tmux_runtime.upstream_boundary.active_imports[1].source_file,
    'src/team/tmux-session.ts',
  );
  assert.equal(
    manifest.tmux_runtime.upstream_boundary.active_imports[2].source_file,
    'src/team/tmux-session.ts',
  );
  assert.deepEqual(manifest.worktree_runtime.operations.create.command, [
    'shift-ax',
    'worktree-create',
  ]);
  assert.equal(manifest.worktree_runtime.upstream_boundary.active_imports.length, 2);
  assert.equal(
    manifest.worktree_runtime.upstream_boundary.active_imports[0].source_file,
    'src/cli/autoresearch.ts',
  );
  assert.equal(
    manifest.worktree_runtime.upstream_boundary.active_imports[1].source_file,
    'src/team/worktree.ts',
  );
});
