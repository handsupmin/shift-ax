# Shift AX 아키텍처

**기본 문서 언어:** 영어  
**English version:** [shift-ax-architecture.md](./shift-ax-architecture.md)

이 문서는 Shift AX를 아키텍처 관점에서 설명합니다.

1. 무엇을 위해 만들었는지
2. 무엇이 차별점인지
3. 외부 시스템에서 어떤 개념을 차용했고, 그것을 Shift AX 각 레이어에서 어떤 철학으로 번역했는지

상세한 채용 backlog는 [../roadmap/source-adoption-backlog.md](../roadmap/source-adoption-backlog.md)를 참고하세요.

## 1. Shift AX는 무엇을 위해 만들어졌는가

Shift AX는 **AX 스타일 워크플로우에 익숙하지 않은 팀도 에이전트 기반 개발 전달을 안전하게 도입할 수 있게 만들기 위해** 존재합니다.

목표는 모델이 더 많은 코드를 쓰게 만드는 것이 아닙니다.  
목표는 팀의 전달 흐름에 다음을 넣어 더 신뢰 가능한 SDLC를 만드는 것입니다.

- 문서 기반 grounding
- 요청 단위 artifact
- planning interview
- 사람의 계획 리뷰
- 정책 문서 반영 게이트
- 구조화된 리뷰
- 의미 있는 finalization

즉 Shift AX는 **코딩 에이전트 런타임 위의 control plane** 입니다.

## 2. 무엇이 차별점인가

Shift AX는 프롬프트 묶음이나 느슨한 스킬 번들과는 의도적으로 다르게 설계됩니다.

### 2.1 memory-first가 아니라 docs-first

가장 우선하는 source of truth는:

1. `docs/base-context/index.md`
2. 그 index가 가리키는 markdown 문서
3. review된 topic artifact

장기 기억, topic recall, decision memory, support summary는 모두 그 아래에 위치합니다.

### 2.2 model-first가 아니라 workflow-first

Shift AX의 제품 철학은:

- 모델 성능은 이미 충분히 높다
- 병목은 workflow reliability 이다
- 엔지니어링 규율은 workflow가 책임져야 한다

라는 전제 위에 있습니다.

그래서 planning, review, policy sync, commit gate를 부가 기능이 아니라 핵심 제품 기능으로 다룹니다.

### 2.3 hidden context가 아니라 file-backed artifact

Shift AX는 보이지 않는 대화 맥락보다 파일을 선호합니다.

- request
- summary
- resolved context
- brainstorm
- spec
- implementation plan
- execution state
- review 결과
- verification evidence
- commit state

이렇게 해야 AX에 익숙하지 않은 팀도 학습 가능하고, 리뷰 가능하고, 재개 가능하게 됩니다.

### 2.4 AX 비전문 팀을 위한 제품

Shift AX는 프롬프트 요령을 잘 아는 운영자보다,

- 안전한 기본 경로
- 명확한 명령
- 읽기 쉬운 상태
- 분명한 pause/resume 지점
- 뚜렷한 사람 리뷰 게이트

를 원하는 팀을 우선 대상으로 둡니다.

## 3. 아키텍처의 전체 모양

Shift AX의 큰 흐름은 아래와 같습니다.

```text
shared docs / base-context
        ↓
context resolution
        ↓
topic + artifact bootstrap
        ↓
planning interview + reviewed spec/plan
        ↓
policy sync gate
        ↓
execution orchestration
        ↓
structured review
        ↓
local finalization / commit

support memory + support state + observability
        ↳ 모든 단계를 돕지만 shared docs를 이기지는 못함
```

repo 구조도 이 흐름을 반영합니다.

```text
core/
  context/
  topics/
  planning/
  review/
  finalization/
  memory/
  observability/
  diagnostics/
  policies/

platform/
  codex/
  claude-code/

adapters/
  codex/
  claude-code/

scripts/
  ax command surfaces
```

## 4. 레이어별 아키텍처와 차용 개념

Shift AX는 특정 시스템을 그대로 포장한 것이 아니라, 외부 시스템의 개념을 선별적으로 흡수해 자기 철학 아래 다시 구성한 것이다.

### 4.1 Product / workflow control-plane layer

**Shift AX 철학**

- workflow가 곧 제품이다
- guardrail은 1급 기능이다
- 사람 리뷰 게이트는 명시적이어야 한다
- AX 비전문 팀도 안전하게 따라갈 수 있어야 한다

**차용한 개념**

- **OMX / OMC**: clarify → plan → execute → verify 같은 단계형 흐름
- **agent-skills**: workflow discipline, anti-rationalization, spec-first 실행 규율

**Shift AX에서의 번역**

- request-to-commit을 형식적인 workflow로 다룬다
- 단계는 파일과 CLI에 명시적으로 드러난다
- workflow는 hidden chat memory가 아니라 stop/resume/review/escalation 가능한 artifact로 유지된다

### 4.2 Context grounding layer

**Shift AX 철학**

- 관련 문서가 있으면 반드시 본다
- 조직이 이미 써놓은 도메인 사실을 에이전트가 추측해서는 안 된다

**차용한 개념**

- **agent-skills**: context hierarchy
- **mempalace**: onboarding interview, room/entity detection
- **honcho**: bounded context packaging

**Shift AX에서의 번역**

- `docs/base-context/index.md`가 최상위 routing surface
- onboarding은 shared doc을 만들거나 발견한다
- glossary seeding / discovery는 docs 레이어를 보강한다
- `build-context-bundle`, `init-context`는 docs-first bundle을 만든다
- support recall은 붙일 수 있지만 shared docs 위로 올라갈 수는 없다

### 4.3 Topic / workspace artifact layer

**Shift AX 철학**

- 모든 요청은 파일 기반 흔적을 가져야 한다
- 이전 대화를 기억하지 못해도 재개 가능해야 한다

**차용한 개념**

- **OMX / OMC**: persistent state/log/artifact layout
- **get-shit-done**: file-backed state, handoff discipline

**Shift AX에서의 번역**

- 모든 요청은 `.ax/topics/` 아래 topic 디렉토리를 가진다
- 요청, 요약, 문맥, 계획, 리뷰, finalization artifact가 topic 안에 저장된다
- worktree 계획도 topic과 연결된다
- `.ax/STATE.md`와 topic `handoff.md`가 사람에게 읽히는 상태를 제공한다

### 4.4 Planning and human review layer

**Shift AX 철학**

- 구현 전 ambiguity를 줄여야 한다
- planning은 사람 승인 전에는 완료된 것이 아니다

**차용한 개념**

- **agent-skills**: spec-first, planning and task breakdown
- **OMX / OMC**: clarify-first flow, gated progression

**Shift AX에서의 번역**

- planning artifact를 쓰기 전에 interview를 수행한다
- brainstorm, spec, implementation plan을 분리한다
- 계획 승인 상태를 명시적으로 기록한다
- stale 하거나 충돌하는 계획은 막을 수 있다
- 공유 정책/base-context 문서 반영이 필요하면 구현 전에 policy sync로 반드시 멈춘다

### 4.5 Execution orchestration layer

**Shift AX 철학**

- 짧은 작업과 긴 작업은 같은 실행 형태가 아니다
- 실행은 관측 가능하고 재개 가능해야 한다

**차용한 개념**

- **OMX / OMC**: subagent vs tmux execution split
- **agent-orchestrator**: lifecycle / session 개념

**Shift AX에서의 번역**

- execution handoff / execution state를 파일로 기록한다
- 짧은 작업은 subagent에 매핑할 수 있다
- 긴 작업은 tmux-backed 실행에 매핑할 수 있다
- downstream feedback 후 implementation 재개도 workflow state로 표현한다

### 4.6 Review and finalization layer

**Shift AX 철학**

- 리뷰는 예의가 아니라 게이트다
- finalization은 evidence가 있어야 한다

**차용한 개념**

- **agent-skills**: review discipline, engineering hygiene
- **OMX / OMC**: verify-before-complete discipline
- **claw-code**: operator-facing practicality

**Shift AX에서의 번역**

- review lane을 명시적으로 분리한다
  - domain-policy
  - spec-conformance
  - test-adequacy
  - engineering-discipline
  - conversation-trace
- verification evidence를 artifact로 남긴다
- gate가 통과되기 전까지 commit finalization을 막는다
- final commit message는 Lore protocol을 따른다

### 4.7 Support memory / support context layer

**Shift AX 철학**

- support memory는 recall을 돕는다
- support memory는 비공식 두 번째 source of truth가 되면 안 된다

**차용한 개념**

- **mempalace**: lightweight recall, decision continuity
- **honcho**: context bundle, recall ranking, summary/consolidation
- **get-shit-done**: threads, pause-work, readable state, freshness discipline

**Shift AX에서의 번역**

- past-topic recall
- decision register with validity windows
- learned-debug history
- context monitor snapshots
- summary checkpoints
- verification debt
- cross-topic thread
- entity-memory / consolidation support tool

이 레이어는 다음을 돕기 위한 보조 도구다.

- continuity
- operator handoff
- debugging reuse
- long-running work

하지만 절대 아래 우선순위를 넘어서지 못한다.

1. base-context docs
2. reviewed spec / implementation plan
3. execution / review artifacts

### 4.8 Operator surface / observability layer

**Shift AX 철학**

- operator는 visibility가 필요하다
- 하지만 rollout 전까지는 compact surface가 우선이다

**차용한 개념**

- **agent-orchestrator**: lifecycle, session, observability
- **claw-code**: doctor-first ergonomics
- **get-shit-done**: readable state, pause/resume continuity

**Shift AX에서의 번역**

- `ax doctor`
- `ax topic-status`
- `ax topics-status`
- `ax context-health`
- `ax monitor-context`
- readable `.ax/STATE.md`

dashboard가 꼭 필요하다는 운영 압력이 생기기 전까지는 **compact CLI observability**를 우선한다.

## 5. 이 아키텍처가 반드시 지키는 규칙

### 5.1 shared docs가 항상 우선

shared docs와 support memory가 충돌하면 shared docs가 이긴다.

### 5.2 support layer는 support layer로 남는다

thread, summary, recall bundle, decision memory, entity view는 operator와 agent를 돕는 도구이지 reviewed planning artifact를 대체하지 않는다.

### 5.3 중요한 전이는 artifact가 된다

Shift AX는 암묵적 chat state보다 명시적 파일을 선호한다.

### 5.4 구현 전과 구현 후 모두 사람 게이트가 있다

- 구현 전: plan review
- 구현 후: structured review lanes

### 5.5 똑똑한 유연성보다 쉬운 기본값

Shift AX는 내부 capability 전체를 노출하기보다, 기본 operator surface를 더 작고 안전하게 유지한다.

## 6. 왜 이 아키텍처가 제품 목표에 맞는가

이 아키텍처는 결국 하나의 약속을 지키기 위해 설계되었다.

> AX를 잘 모르는 팀도 Shift AX를 도입하면 안전한 request-to-commit 흐름을 얻을 수 있어야 한다

그래서 Shift AX는 계속해서 아래를 선택한다.

- 추측보다 문서
- 숨겨진 chat memory보다 파일
- 믿어달라는 자동화보다 게이트
- 거대한 control panel보다 compact operator surface
- shared truth 위의 memory가 아니라, shared truth 아래의 support memory

## 7. 관련 문서

- [../vision.md](../vision.md)
- [./initial-repo-structure.md](./initial-repo-structure.md)
- [./workflow-skill-contract.md](./workflow-skill-contract.md)
- [../roadmap/source-adoption-backlog.md](../roadmap/source-adoption-backlog.md)
- [../acknowledgements.md](../acknowledgements.md)
