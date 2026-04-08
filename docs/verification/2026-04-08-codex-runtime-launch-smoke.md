# Codex Runtime Launch Smoke — 2026-04-08

## Goal

Verify that `ax launch-execution --platform codex` can launch a real Codex task from `execution-handoff.json` and produce a concrete worktree change.

## Result

- Status: success
- Marker file: `/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-runtime-execution/smoke-marker.txt`
- Marker contents: `codex runtime smoke complete.`

## Key Outputs

### Onboard
```json
{
  "documents": [
    {
      "label": "Runtime smoke policy",
      "path": "docs/base-context/runtime-smoke-policy.md"
    }
  ],
  "index": {
    "indexPath": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/docs/base-context/index.md",
    "entries": [
      {
        "label": "Runtime smoke policy",
        "path": "docs/base-context/runtime-smoke-policy.md"
      }
    ]
  },
  "profile": {
    "version": 1,
    "updated_at": "2026-04-08T00:16:53.475Z",
    "docs_root": "docs/base-context",
    "index_path": "docs/base-context/index.md",
    "context_docs": [
      {
        "label": "Runtime smoke policy",
        "path": "docs/base-context/runtime-smoke-policy.md"
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

### Start
```json
{
  "topicSlug": "2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
  "topicDir": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
  "metadata": {
    "version": 1,
    "topic_slug": "2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
    "created_at": "2026-04-08T00:16:53.820Z",
    "status": "bootstrapped",
    "artifacts": {
      "request": "request.md",
      "request_summary": "request-summary.md",
      "resolved_context": "resolved-context.json",
      "brainstorm": "brainstorm.md",
      "spec": "spec.md",
      "plan_review": "plan-review.json",
      "implementation_plan": "implementation-plan.md",
      "execution_handoff": "execution-handoff.json",
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
    "index_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/docs/base-context/index.md",
    "query": "Create a smoke marker file for runtime execution verification",
    "matches": [
      {
        "label": "Runtime smoke policy",
        "path": "docs/base-context/runtime-smoke-policy.md",
        "absolute_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/docs/base-context/runtime-smoke-policy.md",
        "score": 2,
        "content": "# Runtime Smoke Policy\n\nCreate the smallest possible verified artifact.\n"
      }
    ],
    "unresolved_paths": []
  },
  "worktree": {
    "version": 1,
    "topic_slug": "2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
    "branch_name": "ax/2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
    "worktree_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
    "base_branch": "main",
    "created": true,
    "reused": false
  },
  "workflow": {
    "version": 1,
    "topic_slug": "2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
    "phase": "awaiting_plan_review",
    "created_at": "2026-04-08T00:16:53.820Z",
    "updated_at": "2026-04-08T00:16:53.820Z",
    "plan_review_status": "pending",
    "escalation": {
      "status": "clear",
      "triggers": []
    },
    "worktree": {
      "branch_name": "ax/2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
      "worktree_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
      "base_branch": "main"
    },
    "resolved_context": {
      "index_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/docs/base-context/index.md",
      "query": "Create a smoke marker file for runtime execution verification",
      "matches": 1,
      "unresolved_paths": []
    }
  }
}
```

### Approve
```json
{
  "version": 1,
  "status": "approved",
  "reviewer": "Alex Reviewer",
  "reviewed_at": "2026-04-08T00:16:54.366Z",
  "approved_plan_fingerprint": {
    "plan_path": "implementation-plan.md",
    "sha256": "aedaa9a9f7b01dc4ec60c611ded673de812e820ba96b5af2d06ffde6e2034135"
  }
}
```

### Launch Plan
```json
{
  "platform": "codex",
  "launched": false,
  "topic_dir": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
  "tasks": [
    {
      "task_id": "task-2",
      "source_text": "Implement Create smoke-marker.txt with the exact text codex runtime smoke complete. inside: smoke-marker.txt.",
      "execution_mode": "subagent",
      "working_directory": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
      "prompt_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-runtime-execution/execution-prompts/task-2.md",
      "output_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-runtime-execution/execution-results/task-2.json",
      "command": [
        "codex",
        "exec",
        "--full-auto",
        "-C",
        "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
        "-o",
        "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-runtime-execution/execution-results/task-2.json",
        "-"
      ],
      "shell_command": "cat '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-runtime-execution/execution-prompts/task-2.md' | codex exec --full-auto -C '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-runtime-execution' -o '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-runtime-execution/execution-results/task-2.json' -"
    }
  ]
}
```

### Launch Result
```json
{
  "platform": "codex",
  "launched": true,
  "topic_dir": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
  "tasks": [
    {
      "task_id": "task-2",
      "source_text": "Implement Create smoke-marker.txt with the exact text codex runtime smoke complete. inside: smoke-marker.txt.",
      "execution_mode": "subagent",
      "working_directory": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
      "prompt_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-runtime-execution/execution-prompts/task-2.md",
      "output_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-runtime-execution/execution-results/task-2.json",
      "command": [
        "codex",
        "exec",
        "--full-auto",
        "-C",
        "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-runtime-execution",
        "-o",
        "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-runtime-execution/execution-results/task-2.json",
        "-"
      ],
      "shell_command": "cat '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-runtime-execution/execution-prompts/task-2.md' | codex exec --full-auto -C '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-runtime-execution' -o '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-runtime-execution/execution-results/task-2.json' -"
    }
  ]
}
```

### Codex Output Artifact
```text
Created [smoke-marker.txt](/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.yuEaf7AYjh/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-runtime-execution/smoke-marker.txt) with the required line `codex runtime smoke complete.`

Verification: `sed` shows the expected text, `wc -c` reports 30 bytes, and `od` confirms the file contains that text followed by a trailing `\n`. Changed files: `smoke-marker.txt`. Simplifications made: kept the scope to a single new file, with no extra tests or artifacts. Remaining risk: if the consumer requires byte-for-byte content with no trailing newline, the current file is a standard POSIX text file and ends with `LF`.
```
