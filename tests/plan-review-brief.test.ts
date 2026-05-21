import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPlanReviewBrief,
  renderPlanReviewBriefMarkdown,
} from '../core/planning/plan-review-brief.js';

const SPEC = [
  '# Topic Spec',
  '',
  '## Goal',
  '',
  'Implement queue migration.',
  '',
  '## Constraints',
  '',
  '- Do not run production migrations.',
  '',
  '## Out of Scope',
  '',
  '- Production deploy.',
].join('\n');

const PLAN = [
  '# Implementation Plan',
  '',
  '## Acceptance Criteria',
  '',
  '- Queue migration is covered by tests.',
  '',
  '## Verification Commands',
  '',
  '- npm test',
  '',
  '## Likely Files Touched',
  '',
  '- src/queue.ts',
  '- tests/queue.test.ts',
  '',
  '## Risks / Needs Attention',
  '',
  '- Worker and queue side effects need rollback review.',
  '',
  '## Execution Tasks',
  '',
  '1. Add queue migration tests using TDD.',
  '2. Update queue worker behavior.',
].join('\n');

function briefFor(request: string) {
  return buildPlanReviewBrief({
    topicDir: '/tmp/topic',
    request,
    resolvedContext: { matches: [{ label: 'Queue workflow' }] },
    readinessAssessment: {
      version: 1,
      generated_at: '2026-05-21T00:00:00.000Z',
      ambiguity_threshold: 0.2,
      ambiguity_score: 0.05,
      status: 'ready',
      dimensions: [],
      blockers: [],
      recommendations: [],
    },
    specContent: SPEC,
    implementationPlanContent: PLAN,
    executionHandoff: {
      version: 1,
      generated_at: '2026-05-21T00:00:00.000Z',
      topic_slug: 'queue-migration',
      default_short_execution: 'subagent',
      default_long_execution: 'tmux',
      tasks: [
        {
          id: 'task-1',
          source_text: 'Add queue migration tests using TDD.',
          execution_mode: 'subagent',
          reason: 'bounded test task',
        },
        {
          id: 'task-2',
          source_text: 'Update queue worker behavior.',
          execution_mode: 'subagent',
          reason: 'bounded implementation task',
        },
      ],
    },
    worktree: {
      version: 1,
      topic_slug: 'queue-migration',
      branch_name: 'shift-ax/queue-migration',
      worktree_path: '/tmp/worktree',
      base_branch: 'main',
      created: true,
      reused: false,
    },
    now: new Date('2026-05-21T00:00:00.000Z'),
  });
}

test('plan review brief renders detailed Korean approval packet and localized options', () => {
  const brief = briefFor('큐 migration을 테스트까지 포함해서 바꿔줘');
  const markdown = renderPlanReviewBriefMarkdown(brief);

  assert.equal(brief.user_language, 'ko');
  assert.match(brief.review_prompt, /승인하고 구현 시작/);
  assert.equal(brief.response_options[0]?.label, '승인하고 구현 시작');
  assert.equal(brief.response_options[1]?.label, '계획 수정 요청');
  assert.equal(brief.response_options[2]?.label, '요청 거절');
  assert.match(markdown, /채팅 승인 패킷/);
  assert.match(markdown, /모호성 \/ 추가 질문 점검/);
  assert.match(markdown, /추가 질문 없이 승인 단계로 갈 수 있습니다/);
  assert.match(markdown, /검토용 상세 계획/);
  assert.match(markdown, /완료 조건/);
  assert.match(markdown, /리스크와 사이드 이펙트 점검/);
  assert.match(markdown, /1\. 승인하고 구현 시작/);
  assert.doesNotMatch(markdown, /shift-ax approve-plan/);
});

test('plan review brief localizes Japanese response choices', () => {
  const brief = briefFor('キュー移行をテスト込みで実装して');
  const markdown = renderPlanReviewBriefMarkdown(brief);

  assert.equal(brief.user_language, 'ja');
  assert.equal(brief.response_options[0]?.label, '承認して実装開始');
  assert.equal(brief.response_options[1]?.label, '計画修正を依頼');
  assert.equal(brief.response_options[2]?.label, 'この依頼を却下');
  assert.match(markdown, /チャット承認パケット/);
  assert.match(markdown, /曖昧さ \/ 追加質問チェック/);
  assert.match(markdown, /1\. 承認して実装開始/);
});
