import {
  SHIFT_AX_ESCALATION_KINDS,
  readWorkflowState,
  writeWorkflowState,
  type ShiftAxWorkflowEscalation,
  type ShiftAxWorkflowEscalationKind,
  type ShiftAxWorkflowState,
} from './workflow-state.js';

export interface ShiftAxWorkflowEscalationInput {
  kind: ShiftAxWorkflowEscalationKind;
  summary: string;
}

export function defaultEscalationSummary(
  kind: ShiftAxWorkflowEscalationKind,
): string {
  switch (kind) {
    case 'new-user-flow':
      return 'Implementation requires a new user flow that is not in the reviewed plan.';
    case 'policy-conflict':
      return 'A domain or policy document conflicts with the implementation approach.';
    case 'risky-data-or-permission-change':
      return 'A risky data or permission change needs human review before continuing.';
  }
}

export function parseEscalationArgument(
  raw: string,
): ShiftAxWorkflowEscalationInput {
  const [kindPart, ...summaryParts] = String(raw || '').split(':');
  const kind = kindPart?.trim() as ShiftAxWorkflowEscalationKind | undefined;

  if (!kind || !SHIFT_AX_ESCALATION_KINDS.includes(kind)) {
    throw new Error(
      `Invalid escalation trigger "${raw}". Expected one of: ${SHIFT_AX_ESCALATION_KINDS.join(', ')}`,
    );
  }

  const summary = summaryParts.join(':').trim() || defaultEscalationSummary(kind);
  return {
    kind,
    summary,
  };
}

function nextPhaseAfterEscalationClear(
  workflow: ShiftAxWorkflowState,
): ShiftAxWorkflowState['phase'] {
  if (workflow.phase !== 'awaiting_human_escalation') {
    return workflow.phase;
  }

  return workflow.plan_review_status === 'approved'
    ? 'approved'
    : 'awaiting_plan_review';
}

export async function recordWorkflowEscalations({
  topicDir,
  triggers,
  now = new Date(),
}: {
  topicDir: string;
  triggers: ShiftAxWorkflowEscalationInput[];
  now?: Date;
}): Promise<ShiftAxWorkflowState> {
  if (!triggers || triggers.length === 0) {
    throw new Error('At least one escalation trigger is required.');
  }

  const workflow = await readWorkflowState(topicDir);
  const resolvedHistory =
    workflow.escalation?.triggers.filter((trigger) => trigger.resolved_at) ?? [];
  const activeTriggers: ShiftAxWorkflowEscalation[] = triggers.map((trigger) => ({
    kind: trigger.kind,
    summary: trigger.summary.trim(),
    detected_at: now.toISOString(),
  }));

  workflow.phase = 'awaiting_human_escalation';
  workflow.updated_at = now.toISOString();
  workflow.escalation = {
    status: 'required',
    triggers: [...resolvedHistory, ...activeTriggers],
  };

  await writeWorkflowState(topicDir, workflow);
  return workflow;
}

export async function clearWorkflowEscalations({
  topicDir,
  resolution,
  now = new Date(),
}: {
  topicDir: string;
  resolution?: string;
  now?: Date;
}): Promise<ShiftAxWorkflowState> {
  const workflow = await readWorkflowState(topicDir);

  const updatedTriggers = (workflow.escalation?.triggers ?? []).map((trigger) =>
    trigger.resolved_at
      ? trigger
      : {
          ...trigger,
          resolved_at: now.toISOString(),
          ...(resolution?.trim() ? { resolution: resolution.trim() } : {}),
        },
  );

  workflow.updated_at = now.toISOString();
  workflow.phase = nextPhaseAfterEscalationClear(workflow);
  workflow.escalation = {
    status: 'clear',
    triggers: updatedTriggers,
  };

  await writeWorkflowState(topicDir, workflow);
  return workflow;
}
