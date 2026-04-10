import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLoreCommitMessage,
  buildTopicLoreCommitMessage,
  validateLoreCommitMessage,
} from '../core/finalization/commit-message.js';

test('validateLoreCommitMessage rejects messages without lore trailers', () => {
  const result = validateLoreCommitMessage('Bad message\n\nMissing trailers.\n');

  assert.equal(result.valid, false);
  assert.match(result.issues.join('\n'), /Constraint:/);
  assert.match(result.issues.join('\n'), /Confidence:/);
  assert.match(result.issues.join('\n'), /Scope-risk:/);
  assert.match(result.issues.join('\n'), /Tested:/);
  assert.match(result.issues.join('\n'), /Not-tested:/);
});

test('buildLoreCommitMessage produces a valid lore protocol commit message', () => {
  const message = buildLoreCommitMessage({
    intent: 'Advance auth refresh automation safely',
    body: 'This commit wires the reviewed request-to-commit flow into the local repository.',
    constraint: 'v1 stops at a meaningful local git commit',
    confidence: 'high',
    scopeRisk: 'moderate',
    directive: 'Do not reintroduce GitHub-coupled finalization into the v1 core',
    tested: 'npm test; npm run build',
    notTested: 'Host-runtime AI delegation beyond fixture coverage',
  });

  const result = validateLoreCommitMessage(message);

  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
  assert.match(message, /Constraint:/);
  assert.match(message, /Confidence: high/);
});

test('buildTopicLoreCommitMessage produces a valid generated lore message', () => {
  const message = buildTopicLoreCommitMessage({
    request: 'Build safer auth refresh flow',
    requestSummary: 'Reviewed auth refresh delivery flow',
    topicSlug: '2026-04-08-build-safer-auth-refresh-flow',
    verificationCommands: ['npm test', 'npm run build'],
  });

  const result = validateLoreCommitMessage(message);

  assert.equal(result.valid, true);
  assert.match(message, /Deliver reviewed change:/);
  assert.match(message, /Shift AX review lanes; npm test; npm run build/);
  assert.match(message, /Related: topic:2026-04-08-build-safer-auth-refresh-flow/);
});

test('buildTopicLoreCommitMessage localizes intent and body for Korean while preserving lore trailers', () => {
  const message = buildTopicLoreCommitMessage({
    request: '결제 롤백 절차를 더 안전하게 만들기',
    requestSummary: '검토된 결제 롤백 전달 흐름',
    topicSlug: '2026-04-10-safer-payment-rollback',
    verificationCommands: ['npm test'],
    locale: 'ko',
  });

  const result = validateLoreCommitMessage(message);

  assert.equal(result.valid, true);
  assert.match(message, /검토된 변경 반영:/);
  assert.match(message, /검토된 Shift AX 작업을 반영합니다/);
  assert.match(message, /Constraint:/);
  assert.match(message, /Tested: Shift AX review lanes; npm test/);
});
