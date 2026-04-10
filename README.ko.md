# Shift AX

> 프롬프트 요령보다 가드레일이 더 중요한 팀을 위한 에이전트 기반 개발 전달 레이어.

**기본 문서 언어:** 영어  
**English README:** [README.md](./README.md)

Shift AX는 자연어 개발 요청을 문서 기반, 리뷰 게이트 기반 워크플로우로 바꿔서 최종적으로 의미 있는 로컬 git 커밋까지 연결합니다.

이제 기본 재사용 지식 베이스는 아래에 둡니다.

- `~/.shift-ax/`
- 메인 인덱스: `~/.shift-ax/index.md`

이제 아래처럼 플랫폼별 **대화형 셸**로도 바로 실행할 수 있습니다.

- `shift-ax --codex`
- `shift-ax --claude-code`

Codex나 Claude Code로 넘기기 전에, Shift AX는 사용자 선호 언어를 한 번만 묻고 `~/.shift-ax/settings.json`에 저장합니다. 그 다음부터는 그 언어를 재사용하고, 시작하자마자 긴 설명 메시지로 첫 턴을 낭비하지 않고 바로 셸을 엽니다.

## Shift AX가 하는 일

Shift AX는 기존 코딩 에이전트 런타임 위에 제어 평면을 추가해서 팀이 다음을 일관되게 수행할 수 있게 합니다.

- 재사용 가능한 업무 지식을 글로벌 `~/.shift-ax/` 인덱스로 온보딩
- 그 지식을 작업 유형 / 관련 레포 / 레포별 작업 방식 / 도메인 언어로 구조화
- 메인 인덱스를 링크 중심으로 유지해서 토큰 낭비를 줄임
- 계획/구현 전에 관련 문맥 문서 해석
- authoritative docs를 먼저 확인한 뒤 유사한 완료 topic을 참고 자료로 회수
- 중요한 결정을 파일 기반으로 기록하고 언제부터 유효한지 추적
- 팀이 왜 그런 정책이 생겼는지 떠올려야 할 때 source topic summary까지 포함해 decision memory를 검색
- setup 이나 launcher 상태가 수상할 때 repo/topic/launcher health 를 compact 하게 점검
- 요청별 topic 디렉터리와 git worktree 생성
- 사람의 계획 승인 게이트에서 중단
- 계획상 필요한 공유 정책/base-context 문서 수정이 있으면 구현 전에 반드시 먼저 반영
- 승인 후 자동 검증과 구조화된 리뷰 레인 실행
- downstream review/CI 실패 시 file-backed reaction trail과 함께 구현 단계로 되돌리기
- 현재 phase / review / execution / 마지막 실패 이유를 빠르게 보는 compact topic status 제공
- 별도 dashboard 없이도 여러 topic을 가볍게 볼 수 있는 compact multi-topic status 제공
- 게이트가 통과됐을 때만 Lore 프로토콜 로컬 커밋 생성

## 현재 v1 범위

**현재 구현된 v1 범위는 request-to-commit 입니다.**

즉, 현재는 아래 흐름을 지원합니다.

1. 최초 context 온보딩
2. 요청별 topic/worktree 부트스트랩
3. base-context 문서 해석
4. brainstorm / spec / implementation plan 아티팩트 생성
5. 사람의 계획 승인
6. 리뷰 레인 집계
7. 로컬 커밋 finalization

**v1 범위 밖:** GitHub push / PR 자동화

## 빠른 시작

## 관련 아키텍처 문서

- [`docs/vision.md`](./docs/vision.md): 제품 방향
- [`docs/architecture/shift-ax-architecture.md`](./docs/architecture/shift-ax-architecture.md): 목적, 차별점, 레이어별 차용 개념을 정리한 기본 아키텍처 문서
- [`docs/architecture/shift-ax-architecture.ko.md`](./docs/architecture/shift-ax-architecture.ko.md): 위 문서의 한국어 버전
- [`docs/setup/llm-install-and-bootstrap.md`](./docs/setup/llm-install-and-bootstrap.md): LLM 에이전트 기준 설치/부트스트랩 기본 문서
- [`docs/setup/llm-install-and-bootstrap.ko.md`](./docs/setup/llm-install-and-bootstrap.ko.md): 위 문서의 한국어 버전

### 1. 설치

npm 전역 설치:

```bash
npm install -g @handsupmin/shift-ax
```

원커맨드 설치:

```bash
curl -fsSL https://raw.githubusercontent.com/handsupmin/shift-ax/main/scripts/install-global.sh | bash
```

### 2. 검증

설치 후 바로:

```bash
shift-ax --codex
# 또는
shift-ax --claude-code
```

소스 체크아웃 기준:

```bash
npm install
npm test
npm run build
npm link
shift-ax doctor
```

### 3. 온보딩 실행

대화형 플랫폼 셸로 바로 시작:

```bash
shift-ax --codex
# 또는
shift-ax --claude-code
```

런타임이 열리기 전에, 저장된 언어가 없다면 딱 한 번 아래를 묻습니다.

- `1. English (default)`
- `2. Korean`

그리고 최초 설정 때는 기본 full-auto 모드를 켤지도 같이 묻습니다.

선택 결과는 `~/.shift-ax/settings.json`에 저장되고, 다음 실행부터 그대로 재사용됩니다.

- 기본 full-auto가 켜져 있으면:
  - Codex는 `--yolo`
  - Claude Code는 `--dangerously-skip-permissions`
  를 자동으로 붙여서 실행합니다.
- 기본 full-auto가 꺼져 있으면:
  - `--full-auto` 플래그를 줄 때만 그 옵션들을 붙입니다.

`~/.shift-ax/index.md`가 아직 없다면 셸 안에서 바로 다음을 실행하면 됩니다.

```text
# Codex
$onboard

# Claude Code
/onboard
```

Shift AX는 먼저 아래 안내로 시작해야 합니다.

> 이 절차가 가장 중요합니다. 당신을 잘 이해하기 위해 10분의 시간을 투자해주세요.

온보딩은 다음을 구조적으로 모아야 합니다.

1. 작업 유형
2. 관련 레포
3. 레포별 작업 방식
4. 도메인 언어

결과는 `~/.shift-ax/` 아래에 기록되고, `~/.shift-ax/index.md`는 자세한 페이지들로 링크만 거는 가벼운 인덱스로 유지됩니다.

셸은 바로 열려야 합니다. Shift AX가 command surface를 설명하려고 첫 응답 한 턴을 긴 startup monologue로 소비하면 안 됩니다.

셸 안에서는 아래 같은 product-shell 명령을 사용할 수 있어야 합니다.

- Codex: `$onboard`
- Claude Code: `/onboard`
- `/doctor` 또는 `$doctor`
- `/request <text>` 또는 `$request <text>`
- `/export-context`
- `/status`
- `/topics`
- `/resume <topic>`
- `/review <topic>`

플랫폼별 native command 파일도 같이 scaffold 됩니다.

- Codex: `.codex/skills/{onboard,request,export-context,doctor,status,topics,resume,review}/SKILL.md`
- Claude Code: `.claude/commands/{onboard,request,export-context,doctor,status,topics,resume,review}.md`

대화형 온보딩:

```bash
shift-ax onboard-context
```

파일 기반 온보딩:

```bash
shift-ax onboard-context --input ./onboarding.json
```

문서 탐색 기반 온보딩:

```bash
shift-ax onboard-context --discover
```

이 과정은 `~/.shift-ax/` 아래 지식을 만들거나 마이그레이션하고, `~/.shift-ax/index.md`를 갱신하며, 공통 엔지니어링 기본값을 `~/.shift-ax/profile.json`에 저장합니다.

### 4. 요청 시작

```bash
shift-ax run-request --request "Build safer auth refresh flow"
```

이 명령은 다음을 만듭니다.

- `.ax/topics/<topic-slug>/`
- `.ax/worktrees/<topic-slug>/`
- request / summary / brainstorm / spec / `execution-handoff.json` / workflow-state / review / finalization 아티팩트

기본적으로 이 단계에서 planning interview를 먼저 수행한 뒤 planning 아티팩트를 쓰고, 이후 사람의 계획 리뷰 게이트에서 멈춥니다.

글로벌 인덱스가 없으면 `/request`는 기본적으로 멈추고 먼저 `onboard` 를 권장해야 합니다. 사용자가 명시적으로 낮은 정확도로 진행하겠다고 할 때만 계속할 수 있습니다.

### 5. 계획 승인 기록

```bash
shift-ax approve-plan \
  --topic .ax/topics/<topic-slug> \
  --reviewer "Alex" \
  --decision approve
```

### 6. 승인 후 재개

승인된 계획에 공유 정책 문서나 base-context 문서 업데이트가 포함되어 있다면, 구현 재개 전에 먼저 기록합니다.

```bash
shift-ax sync-policy-context \
  --topic .ax/topics/<topic-slug> \
  --summary "구현 전에 공유 auth policy 문서를 먼저 갱신함" \
  --path docs/base-context/auth-policy.md
```

그 다음 재개합니다.

```bash
shift-ax run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --verify-command "npm test" \
  --verify-command "npm run build"
```

리뷰 게이트가 통과되면 Shift AX가 Lore 형식 커밋 메시지를 자동 생성하고, 기본적으로 로컬 커밋까지 자동으로 생성합니다.

- `.ax/topics/<topic-slug>/final/commit-message.md`
- `.ax/topics/<topic-slug>/execution-handoff.json`

사람이 마지막 커밋 단계를 일부러 붙잡고 싶을 때만 `--no-auto-commit`을 사용합니다.

```bash
shift-ax run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --no-auto-commit
```

### 7. 필요하면 플랫폼 실행 명령 생성

```bash
shift-ax launch-execution \
  --platform codex \
  --topic .ax/topics/<topic-slug> \
  --dry-run
```

이 명령은 `execution-handoff.json`을 읽어 task별 execution prompt를 만들고, Codex / Claude / tmux 실행 명령을 반환합니다.

### 8. 필요할 때 compact topic status 확인

```bash
shift-ax topic-status --topic .ax/topics/<topic-slug>
```

## 필수 사람 검토 중단 트리거

계획이 승인된 뒤에도 아래 상황이 생기면 Shift AX는 반드시 멈추고 사람 검토를 받아야 합니다.

1. 승인된 계획에 없던 새로운 사용자 플로우가 필요해질 때
2. 도메인/정책 문서와 구현 접근 방식이 충돌할 때
3. 데이터 변경 또는 권한 변경이 테스트만으로 안전하게 감당하기 어렵다고 판단될 때

이 중단 상태는 다음처럼 workflow-state 에 기록할 수 있습니다.

```bash
shift-ax run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --escalation policy-conflict:"Auth policy conflicts with the proposed flow"
```

사람 검토 후에는 이렇게 재개합니다.

```bash
shift-ax run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --clear-escalations \
  --escalation-resolution "Reviewer approved the updated approach"
```

지원하는 escalation kind:

- `new-user-flow`
- `policy-conflict`
- `risky-data-or-permission-change`

## 현재 리뷰 레인

현재 필수 리뷰 레인은 5개입니다.

- domain-policy
- spec-conformance
- test-adequacy
- engineering-discipline
- conversation-trace

집계 결과는 아래에 기록됩니다.

- `.ax/topics/<topic-slug>/review/aggregate.json`
- `.ax/topics/<topic-slug>/review/summary.md`

## 핵심 원칙

Shift AX는 다음을 강하게 우선합니다.

- 추측보다 문서
- 숨겨진 문맥보다 파일 아티팩트
- 믿어달라는 자동화보다 승인 게이트
- 자유도보다 안전한 기본값

목표는 하나입니다. **AX에 익숙하지 않은 팀도 안전하게 쓸 수 있어야 한다**는 것입니다.
