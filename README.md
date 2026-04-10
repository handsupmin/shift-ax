# Shift AX

> Request-to-commit guardrails for Codex and Claude Code.

**한국어:** [README.ko.md](./README.ko.md)

## What it is

Shift AX sits on top of coding-agent runtimes and makes them work in a safer delivery loop:

1. capture reusable work knowledge in `~/.shift-ax/`
2. resolve context before planning
3. create a request-scoped topic/worktree
4. pause at human plan review
5. resume through verification, review, and commit

It is for teams that want a repeatable workflow, not prompt rituals.

## Install

```bash
npm install -g shift-ax
```

Or:

```bash
curl -fsSL https://raw.githubusercontent.com/handsupmin/shift-ax/main/scripts/install-global.sh | bash
```

From a source checkout:

```bash
npm install
npm run build
npm link
```

## How to use it

### Start a shell

```bash
shift-ax --codex
```

or

```bash
shift-ax --claude-code
```

On first run, Shift AX asks:

1. preferred language
2. whether full-auto should be enabled by default

Those settings are stored in:

- `~/.shift-ax/settings.json`

If full-auto is enabled:

- Codex gets `--yolo`
- Claude Code gets `--dangerously-skip-permissions`

### Onboard your reusable context

Shift AX keeps reusable knowledge in:

- `~/.shift-ax/index.md`
- `~/.shift-ax/work-types/`
- `~/.shift-ax/procedures/`
- `~/.shift-ax/domain-language/`

Inside the runtime:

- **Codex:** `$onboard`
- **Claude Code:** `/onboard`

### Start work

Inside the runtime:

- **Codex:** `$request <text>`
- **Claude Code:** `/request <text>`

Other common commands:

- Codex: `$doctor`, `$status`, `$topics`, `$resume`, `$review`, `$export-context`
- Claude Code: `/doctor`, `/status`, `/topics`, `/resume`, `/review`, `/export-context`

### CLI mode

You can also run the workflow directly:

```bash
shift-ax onboard-context --discover
shift-ax run-request --request "Build safer auth refresh flow"
shift-ax approve-plan --topic .ax/topics/<topic> --reviewer "Alex" --decision approve
shift-ax run-request --topic .ax/topics/<topic> --resume
```

## Give this prompt to another LLM

If you want another LLM to install and use Shift AX for you, give it this:

```text
You are setting up and using Shift AX in this repository.

Goal:
- install Shift AX
- start the correct runtime shell
- onboard reusable context
- start the first request safely

Rules:
- use `shift-ax`, not `ax`, in user-facing commands
- if Shift AX is not installed, run `npm install -g shift-ax`
- if working from a source checkout instead of a global install, run:
  - `npm install`
  - `npm run build`
  - `npm link`
- prefer `shift-ax --codex` unless the user explicitly wants Claude Code
- on first run, answer the language question using the user's language preference
- on first run, answer the full-auto question cautiously
- if `~/.shift-ax/index.md` does not exist, onboard first
- in Codex use `$onboard` and `$request ...`
- in Claude Code use `/onboard` and `/request ...`
- do not start implementation before plan approval
- if shared policy/context docs must change first, update them before resume

Suggested first commands:
1. `shift-ax --codex`
2. run `$onboard`
3. run `$request <the user's task>`
```

## More docs

- Architecture: [`docs/architecture/shift-ax-architecture.md`](./docs/architecture/shift-ax-architecture.md)
- LLM setup details: [`docs/setup/llm-install-and-bootstrap.md`](./docs/setup/llm-install-and-bootstrap.md)
- Release notes: [`docs/release-notes/`](./docs/release-notes/)
