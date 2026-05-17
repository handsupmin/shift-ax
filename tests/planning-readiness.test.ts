import test from 'node:test';
import assert from 'node:assert/strict';

import { assessPlanningReadiness } from '../core/planning/readiness-assessment.js';

test('assessPlanningReadiness approves specific file-backed planning artifacts', () => {
  const assessment = assessPlanningReadiness({
    request: 'Add a safer auth refresh flow',
    matchedContextLabels: ['Auth policy'],
    brainstormContent: [
      '# Brainstorm',
      '',
      '## Clarified Outcome',
      '',
      '- Users stay signed in during refresh token rotation.',
      '',
      '## Constraints',
      '',
      '- Auth policy applies.',
      '- No schema changes.',
      '',
      '## Out of Scope',
      '',
      '- Billing flows.',
      '',
      '## Verification Expectations',
      '',
      '- Add auth refresh tests.',
      '- Run npm test and npm run build.',
      '',
    ].join('\n'),
    specContent: [
      '# Topic Spec',
      '',
      '## Goal',
      '',
      'Users stay signed in during refresh token rotation.',
      '',
      '## Constraints',
      '',
      '- Auth policy applies.',
      '- No schema changes.',
      '',
      '## Out of Scope',
      '',
      '- Billing flows.',
      '',
    ].join('\n'),
    implementationPlanContent: [
      '# Implementation Plan',
      '',
      '## Acceptance Criteria',
      '',
      '- Users stay signed in during refresh token rotation.',
      '',
      '## Verification Commands',
      '',
      '- npm test',
      '- npm run build',
      '',
      '## Dependencies',
      '',
      '- Auth policy',
      '',
      '## Likely Files Touched',
      '',
      '- src/auth-refresh.ts',
      '- tests/auth-refresh.test.ts',
      '',
      '## Execution Tasks',
      '',
      '1. Add auth refresh regression tests with TDD.',
      '2. Update src/auth-refresh.ts.',
      '',
    ].join('\n'),
    now: new Date('2026-04-08T00:00:00.000Z'),
  });

  assert.equal(assessment.status, 'ready');
  assert.ok(assessment.ambiguity_score <= 0.2);
  assert.deepEqual(assessment.blockers, []);
});

test('assessPlanningReadiness blocks vague requests without scope or verification', () => {
  const assessment = assessPlanningReadiness({
    request: 'Make auth better',
    matchedContextLabels: [],
    brainstormContent: '# Brainstorm\n\n## Clarified Outcome\n\n- Improve auth.\n',
    specContent: '# Topic Spec\n\n## Goal\n\nMake auth better.\n',
    implementationPlanContent: '# Implementation Plan\n\n## Execution Tasks\n\n1. Do it.\n',
    now: new Date('2026-04-08T00:00:00.000Z'),
  });

  assert.equal(assessment.status, 'needs_clarification');
  assert.ok(assessment.ambiguity_score > 0.2);
  assert.ok(assessment.blockers.some((blocker) => /verification|success/i.test(blocker)));
});
