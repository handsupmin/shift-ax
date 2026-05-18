# Shift AX LLM Install and Bootstrap Guide

**Default language:** English  
**한국어 버전:** [llm-install-and-bootstrap.ko.md](./llm-install-and-bootstrap.ko.md)

This guide is written for an **LLM agent**, not a human operator.

Use it when an agent has the Shift AX repository available and needs to:

1. install and verify Shift AX
2. use Shift AX against a target repository
3. pick the safest onboarding path
4. start a request-to-commit workflow without guessing

## 1. Goal state

Treat the task as complete only when all of these are true:

- `npm install` completed successfully in the Shift AX repository
- `npm test` passed
- `npm run build` passed
- `shift-ax doctor` returned an `ok` repo health result for the Shift AX repository
- a target repository can be onboarded with either:
  - discovery-assisted onboarding, or
  - file-driven onboarding
- the global Shift AX profile exists at:
  - `~/.shift-ax/profile.json`
  - `~/.shift-ax/index.md`
  - linked knowledge pages under `~/.shift-ax/`

## 2. Assumptions

- You may run Shift AX either from:
  - a global npm install, or
  - a source checkout
- The safest default is:
  - run Shift AX from a known install
  - point `--root` at the target repository
- Do not guess domain facts.
- If the target repository already has useful docs, prefer `--discover` before inventing onboarding content manually.

## 3. Install Shift AX itself

Preferred install:

```bash
npm install -g shift-ax@latest
shift-ax update
```

One-command install:

```bash
curl -fsSL https://raw.githubusercontent.com/handsupmin/shift-ax/main/scripts/install-global.sh | bash
```

Source-checkout verification path:

```bash
npm install
npm test
npm run build
npm link
shift-ax doctor
```

Expected result:

- install succeeds
- `shift-ax update` can reinstall npm latest and refresh global runtime assets
- tests pass
- build succeeds
- doctor reports `overall_status: "ok"` for the Shift AX repo

If any step fails:

1. stop
2. capture the failing command and stderr/stdout
3. do not continue into target-repo onboarding

## 4. Choose how to operate on a target repository

### Recommended default

Run Shift AX and point to the target repo:

```bash
shift-ax <command> --root /absolute/path/to/target-repo
```

If you are running from a source checkout instead of a global install, use:

```bash
npm link
shift-ax <command> --root /absolute/path/to/target-repo
```

### Recommended interactive entrypoint

For conversational use, prefer launching the platform shell directly:

```bash
shift-ax --codex --root /absolute/path/to/target-repo
# or
shift-ax --claude-code --root /absolute/path/to/target-repo
```

If onboarding artifacts are missing, Shift AX will:

1. ask for the preferred language first if `~/.shift-ax/settings.json` does not already store it
2. check npm `latest` at most once every 24 hours and ask whether to update now or skip that specific version when the installed package is behind
3. ask whether full-auto mode should be enabled by default if the setting is still missing
4. open the matching platform session
5. in Codex, let the user run `$onboard`; in Claude Code, let the user run `/onboard`
6. write the reusable knowledge base to `~/.shift-ax/`

Choosing “skip this version” records the skipped package version and the last check time in `~/.shift-ax/settings.json`, so the same update prompt does not reappear until npm publishes a newer version. Fresh checks are cached for 24 hours to avoid repeated network calls on every shell launch.

### Optional: global CLI exposure

Only do this if the workflow explicitly benefits from linking a source checkout into your global npm bin:

```bash
npm run build
npm link
```

After that, commands such as `shift-ax doctor --root /path/to/repo` should work.

If `npm link` is unnecessary, skip it.

### Runtime asset scope

The normal `shift-ax --codex` / `shift-ax --claude-code` launcher installs Shift AX runtime commands globally, not inside every target repository.

- Codex: `~/.codex/skills/<command>/SKILL.md` and `~/.codex/prompts/shift-ax-bootstrap.md`
- Claude Code: `~/.claude/commands/<command>.md` and `~/.claude/hooks/shift-ax-session-start.md`

This prevents duplicate `$request` / `$onboard` entries when the same user works across multiple repositories. If Codex asks to approve newly discovered Shift AX skills or prompts, approve them once. Shift AX does not bypass Codex trust prompts; it reduces the prompt to a one-time global install and cleans older project-local Shift AX copies that it generated.

To refresh an existing installation, run:

```bash
shift-ax update
```

The command reinstalls `shift-ax@latest` from npm, then runs global runtime scaffolding again for Codex and Claude Code.

## 5. Decide the onboarding path

Use this decision rule:

### Path A — discovery-assisted onboarding

Use discovery when the target repo already has documentation that looks reusable.

Signal examples:

- `docs/` exists
- multiple `README.md` or architecture/policy/domain docs exist
- service/package docs already describe the system

Command:

```bash
shift-ax onboard-context --discover --root /absolute/path/to/target-repo
```

### Path B — file-driven onboarding

Use file-driven onboarding when discovery would be too weak or too noisy.

Typical cases:

- docs are sparse
- important context lives in service READMEs only
- the repo needs curated business/policy context that discovery cannot infer safely

Create an onboarding file like:

```json
{
  "primaryRoleSummary": "What this person mainly works on.",
  "workTypes": [
    {
      "name": "API development",
      "summary": "How this work usually looks.",
      "repositories": [
        {
          "repository": "payments-api",
          "repositoryPath": "/absolute/path/to/payments-api",
          "purpose": "What this repo does.",
          "directories": ["src/controllers", "src/services", "src/dto"],
          "workflow": "How work is actually done in this repo."
        }
      ]
    }
  ],
  "domainLanguage": [
    {
      "term": "LedgerX",
      "definition": "Company-specific meaning."
    }
  ],
  "onboardingContext": {
    "primary_role_summary": "What this person mainly works on.",
    "work_types": ["API development"],
    "domain_language": ["LedgerX"]
  },
  "engineeringDefaults": {
    "test_strategy": "tdd",
    "architecture": "clean-architecture",
    "short_task_execution": "subagent",
    "long_task_execution": "tmux",
    "verification_commands": ["npm test", "npm run build"]
  }
}
```

Then run:

```bash
shift-ax onboard-context --root /absolute/path/to/target-repo --input /absolute/path/to/onboarding.json
```

### Path C — interactive onboarding

Use interactive onboarding only if a human is present and expects to answer questions in real time:

```bash
shift-ax onboard-context --root /absolute/path/to/target-repo
```

For autonomous LLM execution, prefer **in-shell onboarding through `shift-ax --codex` / `shift-ax --claude-code`** unless you already have a curated onboarding file.

## 6. Verify onboarding

After onboarding, run:

```bash
shift-ax doctor --root /absolute/path/to/target-repo
```

Expected artifacts:

- `~/.shift-ax/index.md`
- `~/.shift-ax/work-types/*.md`
- `~/.shift-ax/procedures/*.md`
- `~/.shift-ax/domain-language/*.md`
- `~/.shift-ax/profile.json`

If doctor reports that the global index points to missing files:

1. repair the index or document paths
2. rerun doctor
3. do not start request execution until doctor is healthy

## 7. Start the request-to-commit workflow

### Step 1 — start a request

```bash
shift-ax run-request \
  --root /absolute/path/to/target-repo \
  --request "Implement safer refund rollback audit flow"
```

Expected result:

- a topic under `.shift-ax/topics/<topic-slug>/`
- resolved-context, brainstorm, spec, and implementation-plan artifacts
- `plan-review-brief.md` is generated and the product-shell agent asks the user for `1` approve/start, `2` request changes, or `3` reject
- after `1`, the agent records approval and resumes internally; users should not normally type approve/resume commands

### Step 2 — manual recovery: record plan approval

Only run this directly when the product-shell automation failed or an operator is debugging the workflow. In normal use, the user approves in chat.

### Step 3 — sync shared policy docs if required

If the approved plan indicates shared policy/base-context updates are required, do not skip this step:

```bash
shift-ax sync-policy-context \
  --topic /absolute/path/to/target-repo/.shift-ax/topics/<topic-slug> \
  --summary "Updated shared policy docs before implementation" \
  --path docs/base-context/refund-policy.md
```

### Step 4 — manual recovery: resume with verification

Only run this directly when the product-shell agent could not continue after chat approval or when an operator intentionally needs a CLI recovery path.

```bash
shift-ax run-request \
  --topic /absolute/path/to/target-repo/.shift-ax/topics/<topic-slug> \
  --resume \
  --verify-command "npm test" \
  --verify-command "npm run build"
```

## 8. Useful support commands for LLM operators

### Repo / topic health

```bash
shift-ax doctor --root /absolute/path/to/target-repo
shift-ax topic-status --topic /absolute/path/to/topic
shift-ax topics-status --root /absolute/path/to/target-repo
```

### Docs-first context packaging

```bash
shift-ax build-context-bundle \
  --root /absolute/path/to/target-repo \
  --query "refund rollback audit traceability"

shift-ax init-context \
  --root /absolute/path/to/target-repo \
  --query "refund rollback audit traceability" \
  --workflow-step planning
```

### Context pressure

```bash
shift-ax context-health \
  --root /absolute/path/to/target-repo \
  --query "refund rollback audit traceability"

shift-ax monitor-context \
  --root /absolute/path/to/target-repo \
  --query "refund rollback audit traceability"
```

### Safe pause / resume support

```bash
shift-ax pause-work \
  --topic /absolute/path/to/topic \
  --summary "Pause after review preparation." \
  --next-step "Resume after policy clarification." \
  --command "shift-ax topic-status --topic /absolute/path/to/topic"
```

## 9. Hard rules for autonomous LLM usage

### Rule 1 — prefer docs over recall

If `~/.shift-ax/index.md` and its linked pages can answer the question, use that first.  
Do not jump straight to memory-style support tools.

### Rule 2 — do not bypass plan review

Never treat planning artifacts as implementation approval.  
Approval must be recorded explicitly.

### Rule 3 — do not bypass policy sync

If a plan says shared docs must change first, sync them before implementation resumes.

### Rule 4 — prefer deterministic commands

For autonomous execution:

- prefer `--discover`
- prefer `--input`
- avoid interactive mode unless a human is clearly participating

### Rule 5 — stop on failed prerequisites

Do not continue if:

- install failed
- tests failed
- build failed
- doctor reports broken base-context docs

## 10. Minimal machine-oriented happy path

If you need the shortest safe sequence for an LLM:

```bash
# in the Shift AX repo
npm install
npm test
npm run build
shift-ax doctor

# against the target repo
shift-ax onboard-context --discover --root /absolute/path/to/target-repo
shift-ax doctor --root /absolute/path/to/target-repo
shift-ax run-request --root /absolute/path/to/target-repo --request "Implement <task>"
```

If discovery is not good enough, switch to file-driven onboarding before starting the request.

## 11. Related documents

- [../../README.md](../../README.md)
- [../architecture/shift-ax-architecture.md](../architecture/shift-ax-architecture.md)
- [../../scripts/README.md](../../scripts/README.md)
