# Shift AX Rollout Checklist

## Goal

Adopt Shift AX in a team without assuming prior AX expertise.

Reference the detailed plan in `docs/operations/pilot-plan.md` while running this checklist.

## Phase 1 — Preconditions

- [ ] Pick 1 pilot repository
- [ ] Confirm the repo already has a working test/build baseline
- [ ] Identify the team owner for plan approval
- [ ] Identify 1-2 shared policy/doc areas that must be authoritative
- [ ] Confirm Codex and/or Claude Code runtime access for the pilot team

## Phase 2 — Shared context setup

- [ ] Create or collect core docs for domain, policy, and architecture
- [ ] Run:
  - [ ] `npm run ax -- onboard-context --discover`
  - or
  - [ ] `npm run ax -- onboard-context --input ./onboarding.json`
- [ ] Review `docs/base-context/index.md`
- [ ] Review generated `docs/base-context/domain-glossary.md`
- [ ] Run `npm run ax -- doctor`
- [ ] Confirm doctor is `ok`

## Phase 3 — Pilot flow

- [ ] Start 1 small request with `ax run-request`
- [ ] Review the generated brainstorm/spec/implementation plan
- [ ] Record a real human plan approval with `ax approve-plan`
- [ ] If shared docs must change, confirm `ax sync-policy-context` is used before implementation
- [ ] Resume with verification commands
- [ ] Confirm `topic-status` shows the expected phase transitions
- [ ] Confirm a reviewed local commit is produced, or confirm the review gate correctly blocks it

## Phase 4 — Runtime validation

Run at least one real execution task per platform the team intends to use.

### Codex
- [ ] `ax launch-execution --platform codex --topic ... --task-id ...`
- [ ] Confirm file edits happened in the worktree
- [ ] Confirm execution output artifact was written

### Claude Code
- [ ] `ax launch-execution --platform claude-code --topic ... --task-id ...`
- [ ] Confirm file edits happened in the worktree
- [ ] Confirm execution output artifact was written

## Phase 5 — Failure handling

- [ ] Trigger a review-fix or CI-fix style reopen with `ax react-feedback`
- [ ] Confirm the topic returns to `implementation_running`
- [ ] Confirm `topics-status` shows the reopened item clearly

## Phase 6 — Team readiness

- [ ] Team can explain when to use:
  - [ ] `doctor`
  - [ ] `topic-status`
  - [ ] `topics-status`
  - [ ] `sync-policy-context`
  - [ ] `react-feedback`
- [ ] Team understands that base-context docs outrank memory/recall
- [ ] Team knows policy doc updates must land before implementation when required

## Exit criteria

The rollout is ready to expand when:

- [ ] onboarding is repeatable
- [ ] doctor is clean on the pilot repo
- [ ] one full request-to-commit path succeeded
- [ ] one policy-sync stop was handled correctly
- [ ] one downstream feedback reopen was handled correctly
- [ ] at least one real platform-backed execution succeeded for each platform the team plans to use
