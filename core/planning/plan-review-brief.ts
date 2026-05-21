import { writeFile } from 'node:fs/promises';

import { topicArtifactPath } from '../topics/topic-artifacts.js';
import type { TopicWorktreeCreateResult } from '../topics/worktree-runtime.js';
import type { ShiftAxExecutionHandoff } from './execution-handoff.js';
import {
  extractMarkdownBullets,
  parseMarkdownSections,
  readPlanSection,
} from './implementation-plan.js';
import type { ShiftAxPlanningReadinessAssessment } from './readiness-assessment.js';

export interface ShiftAxPlanReviewBrief {
  version: 1;
  status: 'requires_human_review';
  generated_at: string;
  user_language: 'en' | 'ko' | 'ja';
  topic_dir: string;
  worktree_path: string;
  request: string;
  goal: string;
  matched_context: string[];
  constraints: string[];
  out_of_scope: string[];
  acceptance_criteria: string[];
  likely_files_touched: string[];
  verification_commands: string[];
  risks_and_attention: string[];
  execution_tasks: Array<{
    id: string;
    summary: string;
    execution_mode: 'subagent' | 'tmux';
  }>;
  readiness: {
    status: ShiftAxPlanningReadinessAssessment['status'];
    ambiguity_score: number;
    ambiguity_threshold: number;
    blockers: string[];
    clarification_decision: string;
  };
  review_prompt: string;
  response_options: Array<{
    value: '1' | '2' | '3';
    label: string;
    action: 'approve_and_continue' | 'request_changes' | 'reject';
    assistant_behavior: string;
  }>;
}

interface LocalizedPlanReviewCopy {
  reviewPrompt: string;
  optionLabels: {
    approve: string;
    change: string;
    reject: string;
  };
  optionBehaviors: {
    approve: string;
    change: string;
    reject: string;
  };
  chatHeading: string;
  ambiguityHeading: string;
  detailedHeading: string;
  noBlockers: string;
  ambiguityReady: string;
  ambiguityBlocked: string;
  implementationIntro: string;
  contextIntro: string;
  constraintsIntro: string;
  scopeIntro: string;
  criteriaIntro: string;
  filesIntro: string;
  verificationIntro: string;
  risksIntro: string;
  tasksIntro: string;
  responseIntro: string;
  presentFullyInstruction: string;
}

const PLAN_REVIEW_COPY: Record<ShiftAxPlanReviewBrief['user_language'], LocalizedPlanReviewCopy> = {
  en: {
    reviewPrompt:
      'Reply with 1 to approve and start implementation, 2 to request plan changes, or 3 to reject this request. The assistant handles the internal approval and resume commands.',
    optionLabels: {
      approve: 'Approve and start implementation',
      change: 'Request plan changes',
      reject: 'Reject this request',
    },
    optionBehaviors: {
      approve: 'Record approval internally, then resume implementation automatically through implementation, verification, review, commit, and final report.',
      change: 'Capture the requested changes, update the planning artifacts, and present the revised review packet.',
      reject: 'Record the rejection internally and stop the request flow.',
    },
    chatHeading: 'Chat Approval Packet',
    ambiguityHeading: 'Ambiguity / Clarification Check',
    detailedHeading: 'Detailed Plan For Review',
    noBlockers: 'None.',
    ambiguityReady:
      'No additional user question is required before approval because the artifacts identify the goal, constraints, out-of-scope boundaries, acceptance criteria, likely files, verification commands, risky surfaces, and execution tasks.',
    ambiguityBlocked:
      'Do not ask for approval yet. The request still has unresolved blockers that must be clarified or planned explicitly.',
    implementationIntro: 'Implementation will proceed as follows.',
    contextIntro: 'Context used',
    constraintsIntro: 'Constraints that must be preserved',
    scopeIntro: 'Out of scope for this request',
    criteriaIntro: 'Acceptance criteria',
    filesIntro: 'Likely files and surfaces',
    verificationIntro: 'Verification evidence required',
    risksIntro: 'Risk and side-effect checks',
    tasksIntro: 'Execution tasks',
    responseIntro: 'Please reply with one number only',
    presentFullyInstruction:
      'Assistant instruction: present this packet in chat before asking for 1/2/3. Do not replace it with a terse path-only or headline-only summary.',
  },
  ko: {
    reviewPrompt:
      '1은 승인하고 구현 시작, 2는 계획 수정 요청, 3은 요청 거절입니다. 내부 승인/resume 명령은 assistant가 직접 처리합니다.',
    optionLabels: {
      approve: '승인하고 구현 시작',
      change: '계획 수정 요청',
      reject: '요청 거절',
    },
    optionBehaviors: {
      approve: '내부적으로 승인을 기록한 뒤 구현, 검증, 리뷰, 커밋, 최종 보고까지 자동으로 이어갑니다.',
      change: '수정 요청을 반영해 계획 artifact를 갱신하고 변경된 승인 패킷을 다시 제시합니다.',
      reject: '거절을 내부 기록으로 남기고 request 흐름을 중단합니다.',
    },
    chatHeading: '채팅 승인 패킷',
    ambiguityHeading: '모호성 / 추가 질문 점검',
    detailedHeading: '검토용 상세 계획',
    noBlockers: '없음.',
    ambiguityReady:
      '추가 질문 없이 승인 단계로 갈 수 있습니다. 현재 artifact에 목표, 제약, 범위 제외, 인수 조건, 예상 수정 파일, 검증 명령, 위험 지점, 실행 태스크가 명시되어 있습니다.',
    ambiguityBlocked:
      '아직 승인 요청을 하면 안 됩니다. 먼저 아래 blocker를 사용자 질문이나 계획 수정으로 해소해야 합니다.',
    implementationIntro: '구현은 아래 순서로 진행됩니다.',
    contextIntro: '참고한 컨텍스트',
    constraintsIntro: '반드시 지켜야 할 제약',
    scopeIntro: '이번 요청에서 제외되는 범위',
    criteriaIntro: '완료 조건',
    filesIntro: '예상 수정 파일과 영향 표면',
    verificationIntro: '필수 검증 증거',
    risksIntro: '리스크와 사이드 이펙트 점검',
    tasksIntro: '실행 태스크',
    responseIntro: '아래 번호 하나로만 답해주세요',
    presentFullyInstruction:
      'Assistant 지시: 사용자에게 1/2/3을 묻기 전에 이 패킷을 채팅에 충분히 자세히 제시하세요. 경로나 핵심 요약만 남기는 식으로 줄이지 마세요.',
  },
  ja: {
    reviewPrompt:
      '1は承認して実装開始、2は計画修正の依頼、3はこの依頼の却下です。内部の承認/resumeコマンドはassistantが処理します。',
    optionLabels: {
      approve: '承認して実装開始',
      change: '計画修正を依頼',
      reject: 'この依頼を却下',
    },
    optionBehaviors: {
      approve: '内部で承認を記録し、実装、検証、レビュー、コミット、最終報告まで自動で続行します。',
      change: '修正依頼を反映して計画artifactを更新し、改訂版の承認パケットを再提示します。',
      reject: '却下を内部に記録し、requestフローを停止します。',
    },
    chatHeading: 'チャット承認パケット',
    ambiguityHeading: '曖昧さ / 追加質問チェック',
    detailedHeading: 'レビュー用の詳細計画',
    noBlockers: 'なし。',
    ambiguityReady:
      '追加質問なしで承認段階に進めます。現在のartifactには目標、制約、スコープ外、受け入れ条件、想定変更ファイル、検証コマンド、リスク面、実行タスクが明示されています。',
    ambiguityBlocked:
      'まだ承認を求めてはいけません。下記blockerを質問または計画修正で解消してください。',
    implementationIntro: '実装は次の順序で進めます。',
    contextIntro: '参照したコンテキスト',
    constraintsIntro: '守るべき制約',
    scopeIntro: '今回の対象外',
    criteriaIntro: '完了条件',
    filesIntro: '想定変更ファイルと影響面',
    verificationIntro: '必要な検証証跡',
    risksIntro: 'リスクと副作用チェック',
    tasksIntro: '実行タスク',
    responseIntro: '次の番号だけで返信してください',
    presentFullyInstruction:
      'Assistant instruction: 1/2/3を尋ねる前に、このパケットをチャット上で十分詳しく提示してください。パスだけ、または見出しだけの短い要約に置き換えないでください。',
  },
};

function compactLines(value: string): string[] {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .map((line) => line.replace(/^[-*]\s+|^\d+\.\s+/, '').trim())
    .filter(Boolean);
}

function firstLine(...values: string[]): string {
  for (const value of values) {
    const [line] = compactLines(value);
    if (line) return line;
  }
  return 'Review the generated plan before implementation starts.';
}

function fallbackItems(items: string[], fallback: string): string[] {
  return items.length > 0 ? items : [fallback];
}

function detectUserLanguage(value: string): ShiftAxPlanReviewBrief['user_language'] {
  if (/[가-힣]/.test(value)) return 'ko';
  if (/[\u3040-\u30ff]/.test(value)) return 'ja';
  return 'en';
}

function copyFor(language: ShiftAxPlanReviewBrief['user_language']): LocalizedPlanReviewCopy {
  return PLAN_REVIEW_COPY[language] ?? PLAN_REVIEW_COPY.en;
}

function renderBulletList(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}

function renderNumberedList(items: string[]): string[] {
  return items.map((item, index) => `${index + 1}. ${item}`);
}

export function buildPlanReviewBrief({
  topicDir,
  request,
  resolvedContext,
  readinessAssessment,
  specContent,
  implementationPlanContent,
  executionHandoff,
  worktree,
  now = new Date(),
}: {
  topicDir: string;
  request: string;
  resolvedContext: { matches?: Array<{ label?: string }> };
  readinessAssessment: ShiftAxPlanningReadinessAssessment;
  specContent: string;
  implementationPlanContent: string;
  executionHandoff: ShiftAxExecutionHandoff;
  worktree: TopicWorktreeCreateResult;
  now?: Date;
}): ShiftAxPlanReviewBrief {
  const userLanguage = detectUserLanguage(request);
  const copy = copyFor(userLanguage);
  const specSections = parseMarkdownSections(specContent);
  const planSections = parseMarkdownSections(implementationPlanContent);
  const matchedContext = (resolvedContext.matches ?? [])
    .map((match) => match.label)
    .filter((label): label is string => Boolean(label));
  const clarificationDecision =
    readinessAssessment.status === 'ready' && readinessAssessment.blockers.length === 0
      ? copy.ambiguityReady
      : copy.ambiguityBlocked;

  return {
    version: 1,
    status: 'requires_human_review',
    generated_at: now.toISOString(),
    user_language: userLanguage,
    topic_dir: topicDir,
    worktree_path: worktree.worktree_path,
    request: request.trim(),
    goal: firstLine(readPlanSection(specSections, 'Goal'), request),
    matched_context: fallbackItems(matchedContext, 'No matched global context document was recorded.'),
    constraints: fallbackItems(
      extractMarkdownBullets(readPlanSection(specSections, 'Constraints')),
      'No explicit constraints were recorded; ask for clarification before approval.',
    ),
    out_of_scope: fallbackItems(
      extractMarkdownBullets(readPlanSection(specSections, 'Out of Scope')),
      'No explicit out-of-scope boundary was recorded; ask for clarification before approval.',
    ),
    acceptance_criteria: fallbackItems(
      extractMarkdownBullets(readPlanSection(planSections, 'Acceptance Criteria')),
      'No acceptance criteria were recorded; do not approve yet.',
    ),
    likely_files_touched: fallbackItems(
      extractMarkdownBullets(readPlanSection(planSections, 'Likely Files Touched')),
      'No likely files were recorded; do not approve broad implementation.',
    ),
    verification_commands: fallbackItems(
      extractMarkdownBullets(readPlanSection(planSections, 'Verification Commands')),
      'No verification command was recorded; do not approve yet.',
    ),
    risks_and_attention: fallbackItems(
      extractMarkdownBullets(
        readPlanSection(
          planSections,
          'Risks / Needs Attention',
          'Risk / Needs Attention',
          'Risks And Mitigations',
          'Risks',
          'Checkpoints',
        ),
      ),
      'No risky surfaces were recorded; request plan changes before approval if the work touches data, migrations, workers, permissions, destructive operations, deployment, rollback, or verification scope.',
    ),
    execution_tasks: executionHandoff.tasks.map((task) => ({
      id: task.id,
      summary: task.source_text,
      execution_mode: task.execution_mode,
    })),
    readiness: {
      status: readinessAssessment.status,
      ambiguity_score: readinessAssessment.ambiguity_score,
      ambiguity_threshold: readinessAssessment.ambiguity_threshold,
      blockers: readinessAssessment.blockers,
      clarification_decision: clarificationDecision,
    },
    review_prompt: copy.reviewPrompt,
    response_options: [
      {
        value: '1',
        label: copy.optionLabels.approve,
        action: 'approve_and_continue',
        assistant_behavior: copy.optionBehaviors.approve,
      },
      {
        value: '2',
        label: copy.optionLabels.change,
        action: 'request_changes',
        assistant_behavior: copy.optionBehaviors.change,
      },
      {
        value: '3',
        label: copy.optionLabels.reject,
        action: 'reject',
        assistant_behavior: copy.optionBehaviors.reject,
      },
    ],
  };
}

function renderChatApprovalPacket(brief: ShiftAxPlanReviewBrief): string[] {
  const copy = copyFor(brief.user_language);
  return [
    `## ${copy.chatHeading}`,
    '',
    copy.presentFullyInstruction,
    '',
    `### ${copy.ambiguityHeading}`,
    '',
    `- Readiness: ${brief.readiness.status}`,
    `- Ambiguity score: ${brief.readiness.ambiguity_score}/${brief.readiness.ambiguity_threshold}`,
    `- Decision: ${brief.readiness.clarification_decision}`,
    '',
    ...(brief.readiness.blockers.length > 0
      ? renderBulletList(brief.readiness.blockers)
      : [`- ${copy.noBlockers}`]),
    '',
    `### ${copy.detailedHeading}`,
    '',
    copy.implementationIntro,
    '',
    `**${copy.contextIntro}**`,
    '',
    ...renderBulletList(brief.matched_context),
    '',
    `**${copy.constraintsIntro}**`,
    '',
    ...renderBulletList(brief.constraints),
    '',
    `**${copy.scopeIntro}**`,
    '',
    ...renderBulletList(brief.out_of_scope),
    '',
    `**${copy.criteriaIntro}**`,
    '',
    ...renderNumberedList(brief.acceptance_criteria),
    '',
    `**${copy.filesIntro}**`,
    '',
    ...renderBulletList(brief.likely_files_touched),
    '',
    `**${copy.verificationIntro}**`,
    '',
    ...renderBulletList(brief.verification_commands),
    '',
    `**${copy.risksIntro}**`,
    '',
    ...renderBulletList(brief.risks_and_attention),
    '',
    `**${copy.tasksIntro}**`,
    '',
    ...(brief.execution_tasks.length > 0
      ? brief.execution_tasks.map(
          (task, index) => `${index + 1}. ${task.summary} (${task.execution_mode}, ${task.id})`,
        )
      : ['1. No execution task was recorded; request plan changes before approval.']),
    '',
    `**${copy.responseIntro}**`,
    '',
    ...brief.response_options.map(
      (option) => `${option.value}. ${option.label}: ${option.assistant_behavior}`,
    ),
    '',
    brief.review_prompt,
  ];
}

export function renderPlanReviewBriefMarkdown(brief: ShiftAxPlanReviewBrief): string {
  const copy = copyFor(brief.user_language);
  return [
    '# Plan Review Brief',
    '',
    `- Topic: ${brief.topic_dir}`,
    `- Worktree: ${brief.worktree_path}`,
    `- User language: ${brief.user_language}`,
    `- Readiness: ${brief.readiness.status} (ambiguity ${brief.readiness.ambiguity_score}/${brief.readiness.ambiguity_threshold})`,
    '',
    ...renderChatApprovalPacket(brief),
    '',
    '## Goal',
    '',
    brief.goal,
    '',
    '## Matched Context',
    '',
    ...brief.matched_context.map((item) => `- ${item}`),
    '',
    '## Constraints',
    '',
    ...brief.constraints.map((item) => `- ${item}`),
    '',
    '## Out Of Scope',
    '',
    ...brief.out_of_scope.map((item) => `- ${item}`),
    '',
    '## Acceptance Criteria',
    '',
    ...brief.acceptance_criteria.map((item) => `- ${item}`),
    '',
    '## Likely Files Touched',
    '',
    ...brief.likely_files_touched.map((item) => `- ${item}`),
    '',
    '## Verification Commands',
    '',
    ...brief.verification_commands.map((item) => `- ${item}`),
    '',
    '## Risks / Needs Attention',
    '',
    ...brief.risks_and_attention.map((item) => `- ${item}`),
    '',
    '## Execution Tasks',
    '',
    ...(brief.execution_tasks.length > 0
      ? brief.execution_tasks.map((task) => `- ${task.id} (${task.execution_mode}): ${task.summary}`)
      : ['- No execution task was recorded; request plan changes before approval.']),
    '',
    '## Readiness Blockers',
    '',
    ...(brief.readiness.blockers.length > 0
      ? brief.readiness.blockers.map((blocker) => `- ${blocker}`)
      : ['- None.']),
    '',
    '## Clarification Decision',
    '',
    brief.readiness.clarification_decision,
    '',
    '## Required Human Response',
    '',
    brief.review_prompt,
    '',
    '## Response Options',
    '',
    ...brief.response_options.map(
      (option) => `- ${option.value}. ${option.label}: ${option.assistant_behavior}`,
    ),
    '',
    '## Assistant Presentation Requirement',
    '',
    copy.presentFullyInstruction,
    '',
  ].join('\n');
}

export async function writePlanReviewBrief(
  topicDir: string,
  brief: ShiftAxPlanReviewBrief,
): Promise<void> {
  await writeFile(
    topicArtifactPath(topicDir, 'plan_review_brief'),
    `${renderPlanReviewBriefMarkdown(brief)}\n`,
    'utf8',
  );
}
