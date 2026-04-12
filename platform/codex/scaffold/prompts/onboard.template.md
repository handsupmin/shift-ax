---
description: Capture or refresh the user's global Shift AX knowledge base.
argument_hint: "[optional note]"
---

This command is the most important setup step.

Start by saying:

> This step matters most. It may take a while, and that is okay — please invest the time so Shift AX can make accurate decisions later.

Then run a deep, staged onboarding interview.

Rules:

- ask one question at a time
- do not ask for a full information dump
- use the user's last answer to decide the next question
- when the user mentions a repository, path, or file, inspect it before asking for corrections
- infer likely repository role, architecture/layer boundaries, hidden conventions, and working files from real repo evidence
- present your hypothesis before asking the user to type more
- keep digging until uncertainty is low enough that you can say the role/work/repo/glossary picture is confirmed

Cover these knowledge areas gradually:

1. primary role summary
2. work types
3. related repositories for each work type
4. per-repository working methods
5. company/domain language
6. hidden coding conventions and architecture intent

For each repository, show a confirmation checkpoint like this before moving on:

```text
I inspected "<repo>" and this is my current hypothesis:
- Likely role: ...
- Likely architecture/layers: ...
- Likely focus paths: ...
- Likely hidden conventions: ...

Choose one:
1. This is basically correct.
2. Part of it is wrong. I will explain what differs.
3. This is the wrong frame. I will explain how Shift AX should approach it.
```

Prefer defaults and structured choices so the user can answer with minimal typing.

When you have enough information:

1. write `.ax/onboarding-input.json`
2. if `{{GLOBAL_CONTEXT_INDEX}}` or other global knowledge files already exist, ask whether to overwrite them first
3. persist with:
   - `shift-ax onboard-context --root "<repo>" --input .ax/onboarding-input.json`
   - add `--overwrite` only if the user explicitly agreed

Keep the top-level knowledge base in `~/.shift-ax/` with:

- `index.md` listing only titles and linked pages
- linked work type pages
- linked repository/procedure pages
- linked domain-language pages

After completion, remind the user to share `~/.shift-ax/` with teammates who do similar work.
