import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { buildContextBundle } from '../core/context/context-bundle.js';
import { recordDecision } from '../core/memory/decision-register.js';

async function writeTopic(root: string, slug: string, phase = 'committed') {
  const topicDir = join(root, '.ax', 'topics', slug);
  await mkdir(topicDir, { recursive: true });
  await writeFile(join(topicDir, 'request.md'), `Request for ${slug}\n`, 'utf8');
  await writeFile(join(topicDir, 'request-summary.md'), `Summary for ${slug}\n`, 'utf8');
  await writeFile(join(topicDir, 'spec.md'), `# Topic Spec\n\n${slug} spec mentions refund rollback.\n`, 'utf8');
  await writeFile(
    join(topicDir, 'workflow-state.json'),
    JSON.stringify(
      {
        version: 1,
        topic_slug: slug,
        phase,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        plan_review_status: 'approved',
      },
      null,
      2,
    ),
    'utf8',
  );
  return topicDir;
}

test('buildContextBundle keeps docs-first ordering ahead of decisions and topic recall', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-context-bundle-'));

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

    const topicDir = await writeTopic(root, '2026-04-09-refund-fix', 'approved');
    await writeFile(
      join(topicDir, 'resolved-context.json'),
      JSON.stringify(
        {
          version: 1,
          query: 'refund rollback',
          matches: [
            {
              label: 'Audit Policy',
              path: 'docs/base-context/audit-policy.md',
              absolute_path: join(root, 'docs', 'base-context', 'audit-policy.md'),
              score: 2,
              content: '# Audit Policy\n\nRefund changes must preserve customer-visible traceability.\n',
            },
          ],
          unresolved_paths: [],
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(
      join(topicDir, 'brainstorm.md'),
      '# Brainstorm\n\n## Constraints\n\n- Audit Policy applies.\n',
      'utf8',
    );
    await writeFile(
      join(topicDir, 'implementation-plan.md'),
      '# Implementation Plan\n\n1. Implement refund rollback helper.\n',
      'utf8',
    );

    await recordDecision({
      rootDir: root,
      title: 'Require refund rollback traceability',
      summary: 'Refund rollback work must preserve traceability.',
      category: 'policy',
      validFrom: '2026-04-09',
      sourceTopic: '2026-04-09-refund-fix',
    });
    await writeTopic(root, '2026-04-01-old-refund-fix', 'committed');

    const bundle = await buildContextBundle({
      rootDir: root,
      topicDir,
      query: 'refund rollback',
      maxChars: 4000,
    });

    assert.equal(bundle.sections[0]?.kind, 'reviewed_artifacts');
    assert.equal(bundle.sections[1]?.kind, 'base_context');
    assert.equal(bundle.sections[2]?.kind, 'decision_memory');
    assert.equal(bundle.sections[3]?.kind, 'topic_recall');
    assert.match(bundle.rendered, /## Base Context/);
    assert.match(bundle.rendered, /## Reviewed Artifacts/);
    assert.match(bundle.rendered, /## Decision Memory/);
    assert.match(bundle.rendered, /## Past Topic Recall/);
    assert.ok(
      bundle.rendered.indexOf('## Reviewed Artifacts') < bundle.rendered.indexOf('## Base Context'),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('buildContextBundle respects maxChars and trims lower-priority sections first', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-context-bundle-trim-'));

  try {
    await mkdir(join(root, 'docs', 'base-context'), { recursive: true });
    const longDoc = '# Audit Policy\n\n' + 'refund traceability '.repeat(200);
    await writeFile(join(root, 'docs', 'base-context', 'audit-policy.md'), longDoc, 'utf8');
    await writeFile(
      join(root, 'docs', 'base-context', 'index.md'),
      '# Base Context Index\n\n- Audit Policy -> docs/base-context/audit-policy.md\n',
      'utf8',
    );

    const bundle = await buildContextBundle({
      rootDir: root,
      query: 'refund traceability',
      maxChars: 500,
    });

    assert.ok(bundle.rendered.length <= 500);
    assert.equal(bundle.sections[0]?.kind, 'base_context');
    assert.equal(bundle.sections.some((section) => section.kind === 'topic_recall'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
