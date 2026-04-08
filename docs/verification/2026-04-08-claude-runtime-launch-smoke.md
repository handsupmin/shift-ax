# Claude Runtime Launch Smoke — 2026-04-08

## Goal

Verify that `ax launch-execution --platform claude-code` can launch a real Claude task from `execution-handoff.json` and produce a concrete worktree change.

## Result

- Status: success
- Marker file: `/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex/smoke-marker.txt`
- Marker contents: `claude runtime smoke complete.`

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
    "indexPath": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/docs/base-context/index.md",
    "entries": [
      {
        "label": "Runtime smoke policy",
        "path": "docs/base-context/runtime-smoke-policy.md"
      }
    ]
  },
  "profile": {
    "version": 1,
    "updated_at": "2026-04-08T00:18:45.815Z",
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
  "topicSlug": "2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex",
  "topicDir": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex",
  "metadata": {
    "version": 1,
    "topic_slug": "2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex",
    "created_at": "2026-04-08T00:18:46.243Z",
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
    "index_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/docs/base-context/index.md",
    "query": "Create a smoke marker file for claude runtime execution verification",
    "matches": [
      {
        "label": "Runtime smoke policy",
        "path": "docs/base-context/runtime-smoke-policy.md",
        "absolute_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/docs/base-context/runtime-smoke-policy.md",
        "score": 2,
        "content": "# Runtime Smoke Policy\n\nCreate the smallest possible verified artifact.\n"
      }
    ],
    "unresolved_paths": []
  },
  "worktree": {
    "version": 1,
    "topic_slug": "2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex",
    "branch_name": "ax/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex",
    "worktree_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex",
    "base_branch": "main",
    "created": true,
    "reused": false
  },
  "workflow": {
    "version": 1,
    "topic_slug": "2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex",
    "phase": "awaiting_plan_review",
    "created_at": "2026-04-08T00:18:46.243Z",
    "updated_at": "2026-04-08T00:18:46.243Z",
    "plan_review_status": "pending",
    "escalation": {
      "status": "clear",
      "triggers": []
    },
    "worktree": {
      "branch_name": "ax/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex",
      "worktree_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex",
      "base_branch": "main"
    },
    "resolved_context": {
      "index_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/docs/base-context/index.md",
      "query": "Create a smoke marker file for claude runtime execution verification",
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
  "reviewed_at": "2026-04-08T00:18:46.706Z",
  "approved_plan_fingerprint": {
    "plan_path": "implementation-plan.md",
    "sha256": "a487c8957719328b3299590a872caec68ea30348667467ed3facca3856245a8c"
  }
}
```

### Launch Plan
```json
{
  "platform": "claude-code",
  "launched": false,
  "topic_dir": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex",
  "tasks": [
    {
      "task_id": "task-2",
      "source_text": "Implement Create smoke-marker.txt with the exact text claude runtime smoke complete. inside: smoke-marker.txt.",
      "execution_mode": "subagent",
      "working_directory": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex",
      "prompt_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex/execution-prompts/task-2.md",
      "output_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex/execution-results/task-2.json",
      "command": [
        "/bin/sh",
        "-lc",
        "cat '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex/execution-prompts/task-2.md' | claude -p --output-format json --permission-mode bypassPermissions --add-dir '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex' > '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex/execution-results/task-2.json'"
      ],
      "shell_command": "cat '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex/execution-prompts/task-2.md' | claude -p --output-format json --permission-mode bypassPermissions --add-dir '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex' > '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex/execution-results/task-2.json'"
    }
  ]
}
```

### Launch Result
```json
{
  "platform": "claude-code",
  "launched": true,
  "topic_dir": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex",
  "tasks": [
    {
      "task_id": "task-2",
      "source_text": "Implement Create smoke-marker.txt with the exact text claude runtime smoke complete. inside: smoke-marker.txt.",
      "execution_mode": "subagent",
      "working_directory": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex",
      "prompt_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex/execution-prompts/task-2.md",
      "output_path": "/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex/execution-results/task-2.json",
      "command": [
        "/bin/sh",
        "-lc",
        "cat '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex/execution-prompts/task-2.md' | claude -p --output-format json --permission-mode bypassPermissions --add-dir '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex' > '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex/execution-results/task-2.json'"
      ],
      "shell_command": "cat '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex/execution-prompts/task-2.md' | claude -p --output-format json --permission-mode bypassPermissions --add-dir '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/worktrees/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex' > '/var/folders/3t/gfy8tm3558sgzwgk8q10qkhc0000gn/T/tmp.4TMiZFZqlK/.ax/topics/2026-04-08-create-a-smoke-marker-file-for-claude-runtime-ex/execution-results/task-2.json'"
    }
  ]
}
```

### Claude Output Artifact
```json
{"type":"result","subtype":"success","is_error":false,"duration_ms":4528,"duration_api_ms":4519,"num_turns":2,"result":"`smoke-marker.txt` created with the exact text `claude runtime smoke complete.`","stop_reason":"end_turn","session_id":"e7f44fc5-b091-4e1e-98d9-772a4f74612a","total_cost_usd":0.05191875,"usage":{"input_tokens":3,"cache_creation_input_tokens":11219,"cache_read_input_tokens":22045,"output_tokens":215,"server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},"service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":11219,"ephemeral_5m_input_tokens":0},"inference_geo":"","iterations":[],"speed":"standard"},"modelUsage":{"claude-sonnet-4-6":{"inputTokens":3,"outputTokens":215,"cacheReadInputTokens":22045,"cacheCreationInputTokens":11219,"webSearchRequests":0,"costUSD":0.05191875,"contextWindow":200000,"maxOutputTokens":32000}},"permission_denials":[],"terminal_reason":"completed","fast_mode_state":"off","uuid":"bf7f4adf-d4b2-4804-80ea-a3867c0e506f"}
```
