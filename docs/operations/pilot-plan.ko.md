# Shift AX 사내 Pilot Plan

**English version:** [pilot-plan.md](./pilot-plan.md)

## 목적

AX 경험이 많지 않은 실제 팀에서도 Shift AX가 아래 핵심 동작을 유지하면서 도입 가능한지 검증하는 내부 pilot 계획입니다.

- docs-first grounding
- planning-aware context resolution
- mandatory human plan review
- shared docs 변경이 필요한 경우 implementation 전 policy sync 강제
- structured review / feedback reopen
- platform-backed execution과 visible operator status

## Pilot 범위

### 권장 pilot 크기

- **기간:** 2주
- **repository:** 1주차에 1개, 필요하면 2주차에 2번째 repo 추가
- **참여 인원:** 3~5명
- **요청 수:** 총 5~10개 실제 요청

### 권장 pilot repo 조건

다음 조건을 만족하는 repo를 고릅니다.

- 실제로 유지보수 중인 repo
- 너무 작지도 너무 크지도 않은 repo
- 최소 1개 이상의 동작하는 test/build 명령이 있는 repo
- domain/policy/architecture 문서가 최소한 일부라도 있는 repo
- happy path 요청과 policy-sensitive 요청이 둘 다 나올 가능성이 있는 repo

첫 pilot에서는 피할 것:

- 서로 unrelated app이 너무 많은 monorepo
- build tooling이 불안정한 repo
- 테스트가 전혀 없는 repo
- human plan reviewer 역할을 맡을 사람이 없는 repo

## 역할

### 1. Pilot owner

책임:

- pilot repo 선택
- pilot 범위 통제
- 매주 go / no-go 판단

### 2. Domain reviewer

책임:

- base-context docs 검토
- policy docs가 authoritative source인지 확인
- plan review 승인/반려
- shared docs 변경이 필요한 경우 policy sync가 충분한지 판단

### 3. Operator

책임:

- Shift AX 명령 실행
- `doctor`, `topic-status`, `topics-status` 확인
- 실패와 회복 시간 기록

### 4. Runtime owner

책임:

- Codex 및/또는 Claude Code runtime 접근 보장
- pilot 환경에서 launcher 상태 검증
- runtime-specific failure triage

## 성공 기준

pilot은 아래가 모두 충족될 때만 성공으로 본다.

### Workflow 기준

- 최소 1개의 요청이 full request-to-commit flow를 통과
- 최소 1개의 요청이 real gate에 의해 제대로 차단됨
- 최소 1개의 요청이 `react-feedback`로 reopen됨
- pilot 범위에 포함된 각 platform마다 최소 1개의 real execution success가 있음

### Safety 기준

- human plan review를 우회한 요청이 없음
- shared docs 변경이 필요했는데 policy sync를 우회한 요청이 없음
- unresolved base-context path가 있는 상태로 진행한 요청이 없음

### Usability 기준

- operator가 아래 명령의 용도를 설명할 수 있음
  - `doctor`
  - `topic-status`
  - `topics-status`
  - `sync-policy-context`
  - `react-feedback`
- 팀이 AX-specific tribal knowledge 없이도 흐름이 이해된다고 느낀다

### Evidence 기준

- 모든 pilot 요청에 topic artifacts가 남는다
- verification commands가 기록된다
- failure reason이 status 또는 review artifact에서 보인다

## Week 1 계획

### Day 1 — Setup 및 공유 context 정리

1. pilot repo 선택
2. domain/policy/architecture docs 수집
3. 실행:

```bash
npm run ax -- onboard-context --discover
npm run ax -- doctor
```

4. 검토:
- `docs/base-context/index.md`
- `docs/base-context/domain-glossary.md`
- `.ax/project-profile.json`

종료 조건:
- `doctor` 결과가 `ok`
- reviewer가 base-context docs를 usable 하다고 판단

### Day 2 — 첫 happy-path 요청

1. 작은 요청 1개 시작
2. 생성된 brainstorm/spec/implementation plan 검토
3. plan review 기록
4. verification command와 함께 resume
5. `topic-status` 확인

목표:
- reviewed local commit 1개 또는 잘 설명된 review failure 1개 확보

### Day 3 — Policy-sensitive 요청

shared policy/docs를 실제로 건드려야 하는 요청을 고른다.

1. 요청 시작
2. plan approve
3. workflow가 policy sync gate에서 실제로 멈추는지 확인
4. shared doc 수정
5. `ax sync-policy-context` 실행
6. flow resume

목표:
- policy sync gate가 문서상 규칙이 아니라 실제 gate라는 점을 증명

### Day 4 — Runtime validation

범위에 포함된 각 platform에서 최소 1개의 real execution task 실행.

#### Codex

```bash
npm run ax -- launch-execution --platform codex --topic <topic> --task-id <id>
```

#### Claude Code

```bash
npm run ax -- launch-execution --platform claude-code --topic <topic> --task-id <id>
```

목표:
- 실제 파일 변경 확인
- execution output artifact 생성 확인

### Day 5 — Feedback reopen

1. review-ready 또는 commit-ready에 도달한 topic 선택
2. downstream feedback 상황을 하나 만든다
3. 실행:

```bash
npm run ax -- react-feedback \
  --topic <topic> \
  --kind review-changes-requested \
  --summary "Pilot feedback requested more work"
```

4. 확인:
- topic이 `implementation_running`으로 돌아가는지
- `topic-status`에 failure reason이 보이는지
- `topics-status`에 reopened topic이 드러나는지

## Week 2 계획

### 점진적 확장

Week 1 종료 조건을 만족했을 때만 확장한다.

확장 방식은 하나만 선택:

- 두 번째 repo
- 두 번째 팀
- 더 복잡한 multi-file task

세 가지를 한 번에 늘리지 않는다.

### Week 2 목표

- operator hesitation 줄이기
- 팀이 common command를 self-serve 할 수 있는지 확인
- 반복적으로 나오는 failure mode를 다음 product hardening 후보로 모으기

## 일일 운영 루틴

하루 시작 시:

```bash
npm run ax -- doctor
npm run ax -- topics-status --limit 10
```

진행 중 topic별:

```bash
npm run ax -- topic-status --topic <topic>
```

요청이 막히면:

- 최신 status를 읽고
- stop 종류를 확인한다
  - unresolved context
  - policy sync
  - review changes requested
  - downstream feedback reopen
- 가장 작은 recovery action을 명시적으로 실행한다

## 추적할 메트릭

무겁게 만들지 말고 가볍게 기록한다.

### 필수 메트릭

- 시작한 요청 수
- 완료한 요청 수
- gate별로 막힌 요청 수
- `run-request`부터 plan approval까지 평균 시간
- plan approval부터 review result까지 평균 시간
- blocked topic을 회복하는 평균 시간

### 정성 메모

- 어떤 command name이 헷갈렸는지
- 어디서 operator가 도움을 요청했는지
- reviewer가 artifact를 신뢰했는지
- docs-first grounding이 실제 행동을 바꿨는지

## Go / no-go 규칙

### 확장해도 되는 조건

- week 1 성공 기준 충족
- 범위에 포함된 각 platform마다 최소 1개의 real runtime success 확보
- 팀이 hand-holding 없이 흐름을 운영 가능
- gate failure가 mysterious 하지 않고 이해 가능

### 아직 확장하면 안 되는 조건

- operator가 다음 command를 아직도 잘 모르겠을 때
- reviewer가 generated plan/spec를 신뢰하지 않을 때
- platform runtime failure가 자주 나는데 원인이 불명확할 때
- shared docs가 아직 source of truth로 쓰기엔 너무 부족할 때

## 주간 retrospective 질문

매주 말 아래 질문으로 회고한다.

1. 어떤 gate나 stop이 실제 실수를 막았는가?
2. 어떤 command가 가장 헷갈렸는가?
3. 팀이 실제로 base-context docs를 읽었는가, 아니면 만들기만 했는가?
4. `topic-status` / `topics-status`가 operator uncertainty를 줄였는가?
5. 다음 product improvement 후보는 무엇인가?

## Pilot 종료 시 남겨야 할 것

- reviewed `docs/base-context/index.md`
- reviewed glossary
- 성공한 request-to-commit artifact trail 최소 1개
- 성공한 policy-sync 예시 최소 1개
- 성공한 feedback-reopen 예시 최소 1개
- 짧은 추천 결론
  - 지금 확대 가능
  - 제한적으로 확대
  - 특정 gap을 고친 뒤 다시 시도
