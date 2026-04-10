---
description: Run structured Shift AX review for a topic.
argument-hint: "<topic-dir>"
---

Run:

`shift-ax review --topic $ARGUMENTS --run`

Then:

1. summarize the review lanes, aggregate verdict, and remaining blockers
2. if the aggregate verdict says `commit_allowed=true`, do not stop at the summary
3. immediately finish with:

`shift-ax finalize-commit --topic $ARGUMENTS`

That finalization path writes the localized lore commit message (based on the saved Shift AX language setting) and creates the local git commit.
