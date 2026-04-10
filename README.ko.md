# Shift AX

> Codex와 Claude Code를 위한 request-to-commit 가드레일.

**English:** [README.md](./README.md)

## 이게 뭐냐

Shift AX는 코딩 에이전트 런타임 위에 얹는 제어 레이어다.

주요 흐름:

1. `~/.shift-ax/`에 재사용 가능한 업무 지식 저장
2. 계획 전에 문맥 해석
3. 요청별 topic/worktree 생성
4. 사람 계획 리뷰에서 중단
5. 검증, 리뷰, 커밋까지 이어감

즉, 프롬프트 요령이 아니라 **반복 가능한 개발 절차**를 만들기 위한 도구다.

## 설치

```bash
npm install -g @handsupmin/shift-ax
```

또는:

```bash
curl -fsSL https://raw.githubusercontent.com/handsupmin/shift-ax/main/scripts/install-global.sh | bash
```

소스 체크아웃에서 직접 쓰려면:

```bash
npm install
npm run build
npm link
```

## 사용법

### 셸 시작

```bash
shift-ax --codex
```

또는

```bash
shift-ax --claude-code
```

첫 실행에서는:

1. 선호 언어
2. full-auto 기본 사용 여부

를 물어보고, 아래에 저장한다:

- `~/.shift-ax/settings.json`

full-auto가 켜져 있으면:

- Codex: `--yolo`
- Claude Code: `--dangerously-skip-permissions`

### 재사용 문맥 온보딩

Shift AX는 재사용 지식을 여기에 저장한다:

- `~/.shift-ax/index.md`
- `~/.shift-ax/work-types/`
- `~/.shift-ax/procedures/`
- `~/.shift-ax/domain-language/`

런타임 안에서:

- **Codex:** `$onboard`
- **Claude Code:** `/onboard`

### 작업 시작

런타임 안에서:

- **Codex:** `$request <text>`
- **Claude Code:** `/request <text>`

다른 자주 쓰는 명령:

- Codex: `$doctor`, `$status`, `$topics`, `$resume`, `$review`, `$export-context`
- Claude Code: `/doctor`, `/status`, `/topics`, `/resume`, `/review`, `/export-context`

### CLI로 직접 실행

셸 없이도 가능:

```bash
shift-ax onboard-context --discover
shift-ax run-request --request "Build safer auth refresh flow"
shift-ax approve-plan --topic .ax/topics/<topic> --reviewer "Alex" --decision approve
shift-ax run-request --topic .ax/topics/<topic> --resume
```

## 다른 LLM에게 넘길 프롬프트

다른 LLM이 설치부터 사용까지 대신 하게 하려면 아래를 넘기면 된다:

```text
You are setting up and using Shift AX in this repository.

Goal:
- install Shift AX
- start the correct runtime shell
- onboard reusable context
- start the first request safely

Rules:
- use `shift-ax`, not `ax`, in user-facing commands
- if Shift AX is not installed, run `npm install -g @handsupmin/shift-ax`
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

## 더 보기

- Architecture: [`docs/architecture/shift-ax-architecture.md`](./docs/architecture/shift-ax-architecture.md)
- LLM setup detail: [`docs/setup/llm-install-and-bootstrap.ko.md`](./docs/setup/llm-install-and-bootstrap.ko.md)
- Release notes: [`docs/release-notes/`](./docs/release-notes/)
