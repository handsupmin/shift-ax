import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

import { withTempGlobalHome } from './helpers/global-home.js';

test('ax export-context prints sharing guidance for ~/.shift-ax', async () => {
  await withTempGlobalHome('shift-ax-export-home-', async (home) => {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'scripts/ax.ts', 'export-context'],
        {
          cwd: '/Users/sangmin/sources/shift-ax',
          env: {
            ...process.env,
            SHIFT_AX_HOME: home,
          },
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
        else reject(new Error(error || `ax export-context exited ${code}`));
      });
    });

    const result = JSON.parse(stdout) as { share_root: string; index_path: string; message: string };
    assert.equal(result.share_root, home);
    assert.match(result.index_path, /index\.md$/);
    assert.match(result.message, /Share .*same location/i);
  });
});
