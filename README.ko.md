# Shift AX

> 프롬프트 요령보다 가드레일이 더 중요한 팀을 위한 에이전트 기반 개발 전달 레이어.

**기본 문서 언어:** 영어  
**English README:** [README.md](./README.md)

Shift AX는 자연어 개발 요청을 문서 기반, 리뷰 게이트 기반 워크플로우로 바꿔서 최종적으로 의미 있는 로컬 git 커밋까지 연결합니다.

## Shift AX가 하는 일

Shift AX는 기존 코딩 에이전트 런타임 위에 제어 평면을 추가해서 팀이 다음을 일관되게 수행할 수 있게 합니다.

- 도메인/정책 문서를 추적 가능한 형태로 온보딩
- 계획/구현 전에 관련 문맥 문서 해석
- 요청별 topic 디렉터리와 git worktree 생성
- 사람의 계획 승인 게이트에서 중단
- 승인 후 자동 검증과 구조화된 리뷰 레인 실행
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

### 1. 설치 및 검증

```bash
npm install
npm test
npm run build
```

### 2. base context 온보딩

대화형 온보딩:

```bash
npm run ax -- onboard-context
```

파일 기반 온보딩:

```bash
npm run ax -- onboard-context --input ./onboarding.json
```

이 과정은 `docs/base-context/` 아래 문서를 만들고, `docs/base-context/index.md`를 갱신하고, `.ax/project-profile.json`에 공통 엔지니어링 기본값을 저장합니다.

### 3. 요청 시작

```bash
npm run ax -- run-request --request "Build safer auth refresh flow"
```

이 명령은 다음을 만듭니다.

- `.ax/topics/<topic-slug>/`
- `.ax/worktrees/<topic-slug>/`
- request / summary / brainstorm / spec / `execution-handoff.json` / workflow-state / review / finalization 아티팩트

기본적으로 이 단계에서 planning interview를 먼저 수행한 뒤 planning 아티팩트를 쓰고, 이후 사람의 계획 리뷰 게이트에서 멈춥니다.

### 4. 계획 승인 기록

```bash
npm run ax -- approve-plan \
  --topic .ax/topics/<topic-slug> \
  --reviewer "Alex" \
  --decision approve
```

### 5. 승인 후 재개

```bash
npm run ax -- run-request \
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
npm run ax -- run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --no-auto-commit
```

## 필수 사람 검토 중단 트리거

계획이 승인된 뒤에도 아래 상황이 생기면 Shift AX는 반드시 멈추고 사람 검토를 받아야 합니다.

1. 승인된 계획에 없던 새로운 사용자 플로우가 필요해질 때
2. 도메인/정책 문서와 구현 접근 방식이 충돌할 때
3. 데이터 변경 또는 권한 변경이 테스트만으로 안전하게 감당하기 어렵다고 판단될 때

이 중단 상태는 다음처럼 workflow-state 에 기록할 수 있습니다.

```bash
npm run ax -- run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --escalation policy-conflict:"Auth policy conflicts with the proposed flow"
```

사람 검토 후에는 이렇게 재개합니다.

```bash
npm run ax -- run-request \
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
