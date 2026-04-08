# 2026-04-08 Real Claude Code-edit Success

## Goal

Confirm that Shift AX can drive a **real Claude Code file edit**
through `ax launch-execution`, not just a fake launcher test.

## Verified path

1. initialize a temp git repo
2. write reviewed planning artifacts for a minimal single-file task
3. run:

```bash
node --import tsx scripts/ax.ts launch-execution \
  --platform claude-code \
  --topic <topic-dir> \
  --task-id task-1
```

## Result

- command returned success
- Claude created the requested file in the topic worktree:
  - `real-claude-marker.txt`
- exact file content:

```text
Real Claude ready.
```

- execution output artifact was also written:
  - `execution-results/task-1.json`

Recorded output excerpt:

```text
**Changed files:**
- `real-claude-marker.txt` — created with text `Real Claude ready.`
```

## What made the difference

The successful path required all of the following launcher changes:

1. run Claude with the **worktree as `cwd`**
2. pass the prompt as an **explicit argument**
3. use `--no-session-persistence`
4. use a **short, imperative execution prompt**
5. **do not** also pass `--add-dir <same-worktree>` on the direct subagent path

## Scope note

This confirms the core real-runtime Claude edit path works for a bounded task.
It does not claim that every larger multi-file task will finish quickly, but it
does prove the launcher can complete a real code-edit successfully.
