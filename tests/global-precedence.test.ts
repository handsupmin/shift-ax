import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { buildContextBundle } from '../core/context/context-bundle.js';
import { withTempGlobalHome } from './helpers/global-home.js';

test('buildContextBundle prefers reviewed artifacts first and local repo evidence over global knowledge', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shift-ax-precedence-'));
  const topicDir = join(root, '.ax', 'topics', '2026-04-09-precedence');

  try {
    await withTempGlobalHome('shift-ax-precedence-home-', async (home) => {
      await mkdir(join(root, 'docs', 'base-context'), { recursive: true });
      await mkdir(topicDir, { recursive: true });

      await writeFile(
        join(home, 'index.md'),
        '# Shift AX Global Index\n\n## Work Types\n\n- Refund Policy -> work-types/refund-policy.md\n\n## Domain Language\n\n- None yet.\n',
        'utf8',
      );
      await mkdir(join(home, 'work-types'), { recursive: true });
      await writeFile(
        join(home, 'work-types', 'refund-policy.md'),
        '# Refund Policy\n\nGlobal guidance says use the legacy refund flow.\n',
        'utf8',
      );

      await writeFile(
        join(root, 'docs', 'base-context', 'index.md'),
        '# Base Context Index\n\n- Refund Policy -> docs/base-context/refund-policy.md\n',
        'utf8',
      );
      await writeFile(
        join(root, 'docs', 'base-context', 'refund-policy.md'),
        '# Refund Policy\n\nRepo-local evidence says use the new refund flow.\n',
        'utf8',
      );

      await writeFile(
        join(topicDir, 'spec.md'),
        '# Topic Spec\n\nReviewed request-local truth says do not touch billing during refund work.\n',
        'utf8',
      );

      const bundle = await buildContextBundle({
        rootDir: root,
        topicDir,
        query: 'refund flow billing',
        maxChars: 4000,
      });

      assert.equal(bundle.sections[0]?.kind, 'reviewed_artifacts');
      assert.equal(bundle.sections[1]?.kind, 'base_context');
      assert.match(bundle.sections[0]?.items[0]?.content ?? '', /do not touch billing/i);
      assert.match(bundle.sections[1]?.items[0]?.content ?? '', /new refund flow/i);
      assert.doesNotMatch(bundle.sections[1]?.items[0]?.content ?? '', /legacy refund flow/i);
      assert.ok(
        bundle.rendered.indexOf('Reviewed request-local truth') <
          bundle.rendered.indexOf('Repo-local evidence says use the new refund flow.'),
      );
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
