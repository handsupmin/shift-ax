import test from 'node:test';
import assert from 'node:assert/strict';

import { getGlobalContextHome, resolveGlobalContextRoot } from '../core/settings/global-context-home.js';

test('global context home resolves ~/.shift-ax by default and honors SHIFT_AX_HOME', () => {
  const defaultRoot = resolveGlobalContextRoot({
    env: {},
    homeDir: '/tmp/demo-home',
  });
  assert.equal(defaultRoot, '/tmp/demo-home/.shift-ax');

  const overridden = getGlobalContextHome({
    env: { SHIFT_AX_HOME: '/tmp/custom-shift-ax' },
    homeDir: '/tmp/demo-home',
  });
  assert.equal(overridden.root, '/tmp/custom-shift-ax');
  assert.equal(overridden.indexPath, '/tmp/custom-shift-ax/index.md');
  assert.equal(overridden.backupsDir, '/tmp/custom-shift-ax/backups');
});
