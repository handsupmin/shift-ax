import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('workflow skill contract doc defines the required workflow sections', async () => {
  const content = await readFile(
    join(REPO_ROOT, 'docs', 'architecture', 'workflow-skill-contract.md'),
    'utf8',
  );

  assert.match(content, /# Shift AX Workflow Skill Contract/);
  assert.match(content, /## Clarify/);
  assert.match(content, /## Plan/);
  assert.match(content, /## Implement/);
  assert.match(content, /## Review/);
  assert.match(content, /## Finalize/);
  assert.match(content, /anti-rationalization/i);
  assert.match(content, /verification/i);
  assert.match(content, /base-context index/i);
});
