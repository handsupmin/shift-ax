---
description: Capture or refresh the user's global Shift AX knowledge base.
argument_hint: "[optional note]"
---

This command is the most important setup step.

Start by saying:

> This step matters most. Please invest 10 minutes so Shift AX can understand how you work.

Then run a conversational interview that captures:

1. primary role summary
2. work types
3. related repositories for each work type
4. per-repository working methods
5. company/domain language

For each work type and repository:

- ask which directories matter
- inspect the repository when a path is available
- infer likely workflow details from real files
- present your inferred workflow back to the user
- ask them to correct anything wrong or missing

When you have enough information:

1. write `.ax/onboarding-input.json`
2. if `{{GLOBAL_CONTEXT_INDEX}}` or other global knowledge files already exist, ask whether to overwrite them first
3. persist with:
   - `ax onboard-context --root "<repo>" --input .ax/onboarding-input.json`
   - add `--overwrite` only if the user explicitly agreed

Keep the top-level knowledge base in `~/.shift-ax/` with:

- `index.md` listing only titles and linked pages
- linked work type pages
- linked repository/procedure pages
- linked domain-language pages

After completion, remind the user to share `~/.shift-ax/` with teammates who do similar work.
