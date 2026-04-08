# Shift AX 운영 가이드

**English version:** [operator-guide.md](./operator-guide.md)

## 목적

이 문서는 Shift AX를 실제로 운영하는 팀을 위한 일상 운영 가이드입니다.

요청부터 리뷰된 로컬 커밋까지 가는 가장 짧고 안전한 경로를 설명합니다.

## 기본 운영 흐름

### 1. 공유 context 온보딩

```bash
npm run ax -- onboard-context --discover
```

이미 준비된 문서가 있다면 파일 기반 온보딩도 사용할 수 있습니다.

```bash
npm run ax -- onboard-context --input ./onboarding.json
```

### 2. 저장소 상태 점검

```bash
npm run ax -- doctor
```

### 3. 요청 시작

```bash
npm run ax -- run-request --request "<request>"
```

이 명령은 topic, worktree, planning artifacts, human review gate를 만듭니다.

### 4. 사람 계획 승인 기록

```bash
npm run ax -- approve-plan \
  --topic .ax/topics/<topic-slug> \
  --reviewer "<name>" \
  --decision approve
```

### 5. 정책 문서 변경이 필요하면 먼저 반영

검토된 계획에서 공유 정책 문서나 base-context 문서 수정이 필요하면 Shift AX는 구현 전에 멈춥니다.

```bash
npm run ax -- sync-policy-context \
  --topic .ax/topics/<topic-slug> \
  --summary "구현 전에 공유 정책 문서를 갱신함" \
  --path docs/base-context/<doc>.md
```

### 6. 구현과 리뷰 재개

```bash
npm run ax -- run-request \
  --topic .ax/topics/<topic-slug> \
  --resume \
  --verify-command "npm test" \
  --verify-command "npm run build"
```

### 7. downstream feedback로 다시 구현해야 하면 reopen

```bash
npm run ax -- react-feedback \
  --topic .ax/topics/<topic-slug> \
  --kind review-changes-requested \
  --summary "리뷰어가 rollback coverage를 추가 요청함"
```

## 상태 확인 명령

### 단일 topic

```bash
npm run ax -- topic-status --topic .ax/topics/<topic-slug>
```

보여주는 것:
- phase
- review status
- execution status
- policy sync status
- latest failure reason

### 여러 topic

```bash
npm run ax -- topics-status --limit 10
```

별도 dashboard 없이 compact한 운영 뷰가 필요할 때 사용합니다.

실제 팀 rollout 시에는 [pilot-plan.ko.md](./pilot-plan.ko.md)와 함께 보세요.

## launch-execution을 직접 써야 할 때

런타임이 실제 task를 수행하게 하고 싶을 때 platform launcher를 직접 사용합니다.

### Codex

```bash
npm run ax -- launch-execution \
  --platform codex \
  --topic .ax/topics/<topic-slug> \
  --task-id task-1
```

### Claude Code

```bash
npm run ax -- launch-execution \
  --platform claude-code \
  --topic .ax/topics/<topic-slug> \
  --task-id task-1
```

## 자주 만나는 중단 상태

### `resolved context still has unresolved base-context paths`
링크된 문서가 없거나 index가 오래됐다는 뜻입니다.

대응:
- 깨진 문서 경로 수정
- onboarding 재실행 또는 index 갱신

### `policy context sync is required before implementation can start`
계획에서 공유 문서를 먼저 수정하라고 판단한 상태입니다.

대응:
- 공유 문서 수정
- `ax sync-policy-context` 실행

### `review requested more implementation work`
리뷰 게이트가 실제 갭을 발견했다는 뜻입니다.

대응:
- 빠진 구현 보완
- execution artifacts와 테스트를 같이 정리
- 필요하면 resume 재실행 또는 `ax react-feedback` 사용

## 운영 규칙

- base-context docs를 source of truth로 취급한다.
- human plan review를 건너뛰지 않는다.
- 공유 문서가 먼저 바뀌어야 하는 경우 policy sync를 우회하지 않는다.
- 수동 디버깅 전에 `doctor`, `topic-status`, `topics-status`를 먼저 본다.
- execution output artifacts는 선택적 메모가 아니라 증거로 취급한다.
