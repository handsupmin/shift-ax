import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { listVerificationDebt } from '../core/observability/verification-debt.js';

test('listVerificationDebt returns failing verification commands and non-approved review lanes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-verification-debt-'));
  const topicDir = join(root, '.ax', 'topics', '2026-04-09-auth-fix');

  try {
    await mkdir(join(topicDir, 'review'), { recursive: true });
    await writeFile(
      join(topicDir, 'workflow-state.json'),
      JSON.stringify(
        {
          version: 1,
          topic_slug: '2026-04-09-auth-fix',
          phase: 'implementation_running',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          plan_review_status: 'approved',
          verification: [
            {
              command: 'npm test',
              exit_code: 1,
              stdout: '',
              stderr: 'failing test',
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(topicDir, 'review', 'spec-conformance.json'),
      JSON.stringify(
        {
          version: 1,
          lane: 'spec-conformance',
          status: 'changes_requested',
          checked_at: new Date().toISOString(),
          summary: 'Execution state is not completed.',
          issues: [
            {
              severity: 'high',
              message: 'execution-state.json reports pending.',
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    const debt = await listVerificationDebt({ rootDir: root });
    assert.equal(debt.length, 2);
    assert.match(debt[0]?.message ?? '', /npm test|verification/i);
    assert.match(debt[1]?.message ?? '', /spec-conformance|pending/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
