# Shift AX Internal Pilot Plan

**한국어 버전:** [pilot-plan.ko.md](./pilot-plan.ko.md)

## Objective

Run a controlled internal pilot that proves Shift AX can be adopted by a real team with low AX familiarity while preserving the required product behavior:

- docs-first grounding
- planning-aware context resolution
- mandatory human plan review
- mandatory policy sync before implementation when shared docs must change
- structured review and feedback reopen
- platform-backed execution with visible operator status

## Pilot scope

### Recommended pilot size

- **duration:** 2 weeks
- **repositories:** 1 pilot repo in week 1, optional 2nd repo in week 2
- **people:** 3-5 core participants
- **request volume:** 5-10 real requests total

### Recommended pilot repo shape

Choose a repo that is:

- actively maintained
- small to medium in size
- has at least one working test/build command
- already has some domain/policy/architecture docs, even if incomplete
- likely to produce both a normal happy-path request and at least one policy-sensitive request

Avoid for the first pilot:

- monorepos with many unrelated apps
- repos with unstable build tooling
- repos with no tests at all
- repos where no one can act as the human plan reviewer

## Roles

### 1. Pilot owner

Responsible for:

- choosing the pilot repo
- enforcing pilot scope
- deciding go / no-go at the end of each week

### 2. Domain reviewer

Responsible for:

- reviewing base-context docs
- confirming policy docs are authoritative
- approving or rejecting the plan review step
- deciding whether a policy sync is sufficient when shared docs must change

### 3. Operator

Responsible for:

- running Shift AX commands
- keeping `doctor`, `topic-status`, and `topics-status` visible
- recording failures and turnaround times

### 4. Runtime owner

Responsible for:

- ensuring Codex and/or Claude Code runtime access exists
- validating launcher health in the pilot environment
- triaging runtime-specific failures

## Success criteria

The pilot is successful only if all of these are true.

### Workflow criteria

- at least 1 request completes through the full request-to-commit flow
- at least 1 request is correctly blocked by a real gate
- at least 1 request uses `react-feedback` to reopen work after downstream feedback
- at least 1 real platform-backed execution succeeds for each platform being piloted

### Safety criteria

- no request bypasses human plan review
- no request bypasses policy sync when shared docs actually needed changes
- no request proceeds with unresolved base-context paths

### Usability criteria

- the operator can explain when to use:
  - `doctor`
  - `topic-status`
  - `topics-status`
  - `sync-policy-context`
  - `react-feedback`
- the team reports that the flow is understandable without AX-specific tribal knowledge

### Evidence criteria

- every pilot request leaves topic artifacts
- verification commands are recorded
- failure reasons are visible in topic status or review artifacts

## Week 1 plan

### Day 1 — Setup and shared context

1. choose the pilot repo
2. gather domain/policy/architecture docs
3. run:

```bash
npm run ax -- onboard-context --discover
npm run ax -- doctor
```

4. review:
- `docs/base-context/index.md`
- `docs/base-context/domain-glossary.md`
- `.ax/project-profile.json`

Exit condition:
- `doctor` is `ok`
- the reviewer agrees the base-context docs are usable

### Day 2 — First happy-path request

1. start 1 small request
2. inspect generated brainstorm/spec/implementation plan
3. record plan review
4. resume with verification commands
5. check `topic-status`

Target outcome:
- one reviewed local commit or one well-explained review failure

### Day 3 — Policy-sensitive request

Pick a request that should touch shared policy/docs.

1. start request
2. approve plan
3. confirm the workflow stops at the policy sync gate
4. update the shared doc
5. run `ax sync-policy-context`
6. resume flow

Target outcome:
- prove the policy-sync gate is not theoretical

### Day 4 — Runtime validation

Run at least one real execution task per platform in scope.

#### Codex

```bash
npm run ax -- launch-execution --platform codex --topic <topic> --task-id <id>
```

#### Claude Code

```bash
npm run ax -- launch-execution --platform claude-code --topic <topic> --task-id <id>
```

Target outcome:
- confirm real file edits happened
- confirm execution output artifact was written

### Day 5 — Feedback reopen

1. pick a topic that reached review-ready or commit-ready
2. simulate downstream feedback
3. run:

```bash
npm run ax -- react-feedback \
  --topic <topic> \
  --kind review-changes-requested \
  --summary "Pilot feedback requested more work"
```

4. confirm:
- topic returns to `implementation_running`
- `topic-status` shows the failure reason
- `topics-status` shows the reopened topic

## Week 2 plan

### Expand carefully

Only expand if week 1 exit criteria are met.

Choose one:

- a second repo
- a second team
- a more complex multi-file task

Do **not** expand all three at once.

### Week 2 goals

- reduce operator hesitation
- confirm the team can self-serve common commands
- collect repetitive failure modes for future product hardening

## Daily operator routine

At the start of the day:

```bash
npm run ax -- doctor
npm run ax -- topics-status --limit 10
```

Per active topic:

```bash
npm run ax -- topic-status --topic <topic>
```

When a request is blocked:

- read the latest status
- check whether the stop is:
  - unresolved context
  - policy sync
  - review changes requested
  - downstream feedback reopen
- take the smallest explicit recovery action

## Metrics to track

Keep this lightweight. Track these in a shared note or sheet.

### Required metrics

- number of requests started
- number of requests completed
- number of requests blocked by each gate
- average time from `run-request` to plan approval
- average time from plan approval to review result
- average time to recover from a blocked topic

### Qualitative notes

- which command names were confusing
- where operators needed to ask for help
- whether reviewers trusted the artifacts
- whether docs-first grounding actually changed behavior

## Go / no-go rules

### Go to broader rollout when

- week 1 success criteria are met
- at least one real runtime-backed execution succeeded per platform in scope
- the team can operate the flow without hand-holding
- gate failures are understandable rather than mysterious

### Do not expand yet when

- operators still do not know which command to use next
- reviewers ignore the generated plan/spec because they do not trust it
- platform runtime failures are frequent and unexplained
- shared docs are still too incomplete to serve as the source of truth

## Pilot retrospective template

Use these questions at the end of each week:

1. Which stop or gate prevented a real mistake?
2. Which command caused the most confusion?
3. Did the team actually consult base-context docs, or merely generate them?
4. Did `topic-status` / `topics-status` reduce operator uncertainty?
5. Which failure should become the next product improvement?

## Deliverables at the end of the pilot

- reviewed `docs/base-context/index.md`
- reviewed glossary
- at least one successful request-to-commit artifact trail
- at least one successful policy-sync example
- at least one successful feedback-reopen example
- a short written recommendation:
  - expand now
  - expand with limits
  - hold and fix specific gaps first
