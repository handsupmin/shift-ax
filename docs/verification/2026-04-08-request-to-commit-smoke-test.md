# Smoke Test — 2026-04-08 Request-to-Commit CLI Flow

## Scope

This log captures a full sample topic run through the current user-facing CLI flow:

1. onboarding context
2. start request pipeline
3. approve plan
4. resume with verification
5. finalize local commit

> Note: timestamps emitted by the CLI are UTC (`Z`).

## Temporary Repo

- Temp repo root: `/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE`
- Topic directory: `/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/.ax/topics/2026-04-07-build-safer-auth-refresh-flow`
- Worktree directory: `/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/.ax/worktrees/2026-04-07-build-safer-auth-refresh-flow`

## Commands Run

```bash
npm --silent run ax -- onboard-context --root "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE" --input "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/onboarding.json"
npm --silent run ax -- run-request --root "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE" --request "Build safer auth refresh flow"
npm --silent run ax -- approve-plan --topic "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/.ax/topics/2026-04-07-build-safer-auth-refresh-flow" --reviewer "Alex Reviewer" --decision approve
npm --silent run ax -- run-request --topic "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/.ax/topics/2026-04-07-build-safer-auth-refresh-flow" --resume --verify-command "git status --short"
npm --silent run ax -- finalize-commit --topic "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/.ax/topics/2026-04-07-build-safer-auth-refresh-flow"
```

## Key Outputs

### Onboard Result

```json
{
  "documents": [
    {
      "label": "Auth policy",
      "path": "docs/base-context/auth-policy.md"
    },
    {
      "label": "Wallet domain",
      "path": "docs/base-context/wallet-domain.md"
    }
  ],
  "index": {
    "indexPath": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/docs/base-context/index.md",
    "entries": [
      {
        "label": "Auth policy",
        "path": "docs/base-context/auth-policy.md"
      },
      {
        "label": "Wallet domain",
        "path": "docs/base-context/wallet-domain.md"
      }
    ]
  },
  "profile": {
    "version": 1,
    "updated_at": "2026-04-07T16:06:39.048Z",
    "docs_root": "docs/base-context",
    "index_path": "docs/base-context/index.md",
    "context_docs": [
      {
        "label": "Auth policy",
        "path": "docs/base-context/auth-policy.md"
      },
      {
        "label": "Wallet domain",
        "path": "docs/base-context/wallet-domain.md"
      }
    ],
    "engineering_defaults": {
      "test_strategy": "tdd",
      "architecture": "clean-boundaries",
      "short_task_execution": "subagent",
      "long_task_execution": "tmux",
      "verification_commands": [
        "npm test",
        "npm run build"
      ]
    }
  }
}
```

### Start Result

```json
{
  "topicSlug": "2026-04-07-build-safer-auth-refresh-flow",
  "topicDir": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/.ax/topics/2026-04-07-build-safer-auth-refresh-flow",
  "metadata": {
    "version": 1,
    "topic_slug": "2026-04-07-build-safer-auth-refresh-flow",
    "created_at": "2026-04-07T16:06:39.439Z",
    "status": "bootstrapped",
    "artifacts": {
      "request": "request.md",
      "request_summary": "request-summary.md",
      "resolved_context": "resolved-context.json",
      "brainstorm": "brainstorm.md",
      "spec": "spec.md",
      "plan_review": "plan-review.json",
      "implementation_plan": "implementation-plan.md",
      "workflow_state": "workflow-state.json",
      "review_dir": "review",
      "final_dir": "final",
      "commit_message": "final/commit-message.md",
      "commit_state": "final/commit-state.json",
      "verification": "final/verification.md",
      "worktree_plan": "worktree-plan.json",
      "worktree_state": "worktree-state.json"
    }
  },
  "resolvedContext": {
    "version": 1,
    "index_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/docs/base-context/index.md",
    "query": "Build safer auth refresh flow",
    "matches": [
      {
        "label": "Auth policy",
        "path": "docs/base-context/auth-policy.md",
        "absolute_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/docs/base-context/auth-policy.md",
        "score": 1,
        "content": "# Auth Policy\n\nRefresh token rotation is required.\n"
      }
    ],
    "unresolved_paths": []
  },
  "worktree": {
    "version": 1,
    "topic_slug": "2026-04-07-build-safer-auth-refresh-flow",
    "branch_name": "ax/2026-04-07-build-safer-auth-refresh-flow",
    "worktree_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/.ax/worktrees/2026-04-07-build-safer-auth-refresh-flow",
    "base_branch": "main",
    "created": true,
    "reused": false
  },
  "workflow": {
    "version": 1,
    "topic_slug": "2026-04-07-build-safer-auth-refresh-flow",
    "phase": "awaiting_plan_review",
    "created_at": "2026-04-07T16:06:39.439Z",
    "updated_at": "2026-04-07T16:06:39.439Z",
    "plan_review_status": "pending",
    "escalation": {
      "status": "clear",
      "triggers": []
    },
    "worktree": {
      "branch_name": "ax/2026-04-07-build-safer-auth-refresh-flow",
      "worktree_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/.ax/worktrees/2026-04-07-build-safer-auth-refresh-flow",
      "base_branch": "main"
    },
    "resolved_context": {
      "index_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/docs/base-context/index.md",
      "query": "Build safer auth refresh flow",
      "matches": 1,
      "unresolved_paths": []
    }
  }
}
```

### Approve Result

```json
{
  "version": 1,
  "status": "approved",
  "reviewer": "Alex Reviewer",
  "reviewed_at": "2026-04-07T16:06:40.181Z",
  "approved_plan_fingerprint": {
    "plan_path": "implementation-plan.md",
    "sha256": "542f3ec4bf7870bca8b9922b04592f6bce927c6a770e5e31fa11e48963363afe"
  }
}
```

### Resume Result

```json
{
  "workflow": {
    "version": 1,
    "topic_slug": "2026-04-07-build-safer-auth-refresh-flow",
    "phase": "commit_ready",
    "created_at": "2026-04-07T16:06:39.439Z",
    "updated_at": "2026-04-07T16:06:40.607Z",
    "plan_review_status": "approved",
    "escalation": {
      "status": "clear",
      "triggers": []
    },
    "worktree": {
      "branch_name": "ax/2026-04-07-build-safer-auth-refresh-flow",
      "worktree_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/.ax/worktrees/2026-04-07-build-safer-auth-refresh-flow",
      "base_branch": "main"
    },
    "resolved_context": {
      "index_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/docs/base-context/index.md",
      "query": "Build safer auth refresh flow",
      "matches": 1,
      "unresolved_paths": []
    },
    "verification": [
      {
        "command": "git status --short",
        "exit_code": 0,
        "stdout": "?? feature.txt\n",
        "stderr": ""
      }
    ],
    "review": {
      "overall_status": "approved",
      "commit_allowed": true,
      "next_stage": "finalization"
    }
  },
  "aggregate": {
    "version": 1,
    "overall_status": "approved",
    "commit_allowed": true,
    "next_stage": "finalization",
    "required_lanes": [
      "domain-policy",
      "spec-conformance",
      "test-adequacy",
      "engineering-discipline",
      "conversation-trace"
    ],
    "approved_lanes": [
      "domain-policy",
      "spec-conformance",
      "test-adequacy",
      "engineering-discipline",
      "conversation-trace"
    ],
    "changes_requested_lanes": [],
    "blocked_lanes": [],
    "missing_lanes": [],
    "verdicts": [
      {
        "version": 1,
        "lane": "domain-policy",
        "status": "approved",
        "checked_at": "2026-04-07T16:06:40.724Z",
        "summary": "Relevant base-context documents were resolved and no unresolved paths were recorded."
      },
      {
        "version": 1,
        "lane": "spec-conformance",
        "status": "approved",
        "checked_at": "2026-04-07T16:06:40.725Z",
        "summary": "Spec and implementation plan are approved, fingerprint-matched, and free of unresolved placeholders."
      },
      {
        "version": 1,
        "lane": "test-adequacy",
        "status": "approved",
        "checked_at": "2026-04-07T16:06:40.724Z",
        "summary": "Implementation plan explicitly references test or TDD expectations."
      },
      {
        "version": 1,
        "lane": "engineering-discipline",
        "status": "approved",
        "checked_at": "2026-04-07T16:06:40.724Z",
        "summary": "Implementation plan references the configured engineering-method guardrails."
      },
      {
        "version": 1,
        "lane": "conversation-trace",
        "status": "approved",
        "checked_at": "2026-04-07T16:06:40.725Z",
        "summary": "Request, summary, brainstorm, and spec artifacts are traceable to the original request."
      }
    ]
  },
  "verification": [
    {
      "command": "git status --short",
      "exit_code": 0,
      "stdout": "?? feature.txt\n",
      "stderr": ""
    }
  ]
}
```

### Finalize Result

```json
{
  "version": 1,
  "status": "committed",
  "commit_sha": "aa6ee11de7e67cf56b72f3b0a8e2af881241d498",
  "committed_at": "2026-04-07T16:06:41.065Z",
  "git_cwd": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/.ax/worktrees/2026-04-07-build-safer-auth-refresh-flow",
  "message_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/.ax/topics/2026-04-07-build-safer-auth-refresh-flow/final/commit-message.md",
  "review_summary_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/.ax/topics/2026-04-07-build-safer-auth-refresh-flow/review/summary.md"
}
```

## Final Workflow State

```json
{
  "version": 1,
  "topic_slug": "2026-04-07-build-safer-auth-refresh-flow",
  "phase": "committed",
  "created_at": "2026-04-07T16:06:39.439Z",
  "updated_at": "2026-04-07T16:06:41.065Z",
  "plan_review_status": "approved",
  "escalation": {
    "status": "clear",
    "triggers": []
  },
  "worktree": {
    "branch_name": "ax/2026-04-07-build-safer-auth-refresh-flow",
    "worktree_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/.ax/worktrees/2026-04-07-build-safer-auth-refresh-flow",
    "base_branch": "main"
  },
  "resolved_context": {
    "index_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.W9MD4PvCUE/docs/base-context/index.md",
    "query": "Build safer auth refresh flow",
    "matches": 1,
    "unresolved_paths": []
  },
  "verification": [
    {
      "command": "git status --short",
      "exit_code": 0,
      "stdout": "?? feature.txt\n",
      "stderr": ""
    }
  ],
  "review": {
    "overall_status": "approved",
    "commit_allowed": true,
    "next_stage": "finalization"
  }
}
```

## Generated Commit Message

```text
Deliver reviewed change: Build safer auth refresh flow

This commit captures the reviewed Shift AX work for "Build safer auth refresh flow". The request passed context resolution, human plan review, and review gates before local finalization.

Constraint: v1 finalization stops at a meaningful local git commit
Confidence: high
Scope-risk: moderate
Directive: Re-run plan-review, escalation, and review gates before changing finalization semantics
Tested: Shift AX review lanes; git status --short
Not-tested: GitHub push or PR automation beyond the v1 local-commit boundary
Related: topic:2026-04-07-build-safer-auth-refresh-flow
```

## Final Git Log

```text
Deliver reviewed change: Build safer auth refresh flow

This commit captures the reviewed Shift AX work for "Build safer auth refresh flow". The request passed context resolution, human plan review, and review gates before local finalization.

Constraint: v1 finalization stops at a meaningful local git commit
Confidence: high
Scope-risk: moderate
Directive: Re-run plan-review, escalation, and review gates before changing finalization semantics
Tested: Shift AX review lanes; git status --short
Not-tested: GitHub push or PR automation beyond the v1 local-commit boundary
Related: topic:2026-04-07-build-safer-auth-refresh-flow
```

## Assertions Observed

- Workflow reached `committed`
- Aggregate review allowed commit
- Commit message artifact was Lore-compatible
- Local git commit was created successfully
- Final commit SHA: `aa6ee11de7e67cf56b72f3b0a8e2af881241d498`
