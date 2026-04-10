# Shift AX LLM 설치 및 부트스트랩 가이드

**기본 문서 언어:** 영어  
**English version:** [llm-install-and-bootstrap.md](./llm-install-and-bootstrap.md)

이 문서는 **사람이 아니라 LLM 에이전트**를 위한 설치/운영 가이드다.

목표는 LLM이 Shift AX repo를 받았을 때 다음을 스스로 안전하게 수행할 수 있게 하는 것이다.

1. Shift AX 설치 및 검증
2. target repo에 대해 Shift AX 실행
3. 어떤 onboarding 경로를 택해야 하는지 판단
4. 추측 없이 request-to-commit 흐름 시작

## 1. 완료 조건

아래가 모두 참일 때만 설치/부트스트랩이 완료된 것으로 본다.

- Shift AX repo에서 `npm install` 성공
- `npm test` 성공
- `npm run build` 성공
- `npm run ax -- doctor`가 Shift AX repo 기준 `ok`
- target repo가
  - discovery-assisted onboarding 또는
  - file-driven onboarding
  중 하나로 온보딩 완료
- 글로벌 Shift AX 프로필이 아래에 존재
  - `~/.shift-ax/profile.json`
  - `~/.shift-ax/index.md`
  - `~/.shift-ax/` 아래 linked knowledge pages

## 2. 기본 가정

- Shift AX는
  - npm 전역 설치 상태이거나
  - source checkout 상태
  둘 다 가능하다.
- 가장 안전한 기본값은:
  - 설치된 Shift AX에서 실행하고
  - `--root`로 target repo를 가리키는 방식
- 도메인 사실을 추측하지 않는다.
- target repo에 이미 문서가 있으면, 수동 onboarding 문서를 지어내기 전에 `--discover`를 우선 검토한다.

## 3. Shift AX 자체 설치

권장 설치:

```bash
npm install -g @handsupmin/shift-ax
```

원커맨드 설치:

```bash
curl -fsSL https://raw.githubusercontent.com/handsupmin/shift-ax/main/scripts/install-global.sh | bash
```

source checkout 기준 검증 경로:

```bash
npm install
npm test
npm run build
npm run ax -- doctor
```

기대 결과:

- install 성공
- tests pass
- build 성공
- doctor가 Shift AX repo 기준 `overall_status: "ok"`

실패하면:

1. 즉시 중단
2. 실패한 명령과 stdout/stderr를 기록
3. target repo onboarding으로 넘어가지 않는다

## 4. target repo에 대해 어떻게 실행할지 결정

### 권장 기본 경로

설치된 Shift AX에서 실행하면서 `--root`로 target repo를 지정:

```bash
ax <command> --root /absolute/path/to/target-repo
```

source checkout에서 실행 중이라면:

```bash
npm run ax -- <command> --root /absolute/path/to/target-repo
```

### 권장 대화형 진입점

대화형 사용이라면 플랫폼 셸을 바로 여는 방식을 우선한다.

```bash
ax --codex --root /absolute/path/to/target-repo
# 또는
ax --claude-code --root /absolute/path/to/target-repo
```

onboarding artifact가 없으면 Shift AX가:

1. `~/.shift-ax/settings.json`에 언어가 없으면 먼저 선호 언어를 묻고
2. 맞는 플랫폼 세션을 열고
3. 사용자가 `/onboarding` 을 실행하게 하고
4. 재사용 가능한 지식을 `~/.shift-ax/` 아래에 기록한다

### 선택 경로: global CLI 노출

source checkout을 전역 bin에 연결해야 할 때만:

```bash
npm run build
npm link
```

그 이후 예:

```bash
ax doctor --root /path/to/repo
```

하지만 필요 없다면 `npm link`는 생략한다.

## 5. onboarding 경로 선택 규칙

### Path A — discovery-assisted onboarding

target repo에 이미 쓸 만한 문서가 있으면 discovery를 사용한다.

신호 예시:

- `docs/` 존재
- 여러 `README.md` 혹은 architecture/policy/domain 문서 존재
- 서비스/패키지 문서가 이미 시스템을 설명하고 있음

명령:

```bash
npm run ax -- onboard-context --discover --root /absolute/path/to/target-repo
```

### Path B — file-driven onboarding

discovery가 너무 약하거나 noisy 할 것 같으면 file-driven onboarding을 사용한다.

대표 상황:

- docs가 빈약함
- 중요한 맥락이 서비스별 README에만 흩어져 있음
- discovery만으로는 business/policy context를 안전하게 만들 수 없음

예시 파일:

```json
{
  "primaryRoleSummary": "이 사람이 주로 하는 일",
  "workTypes": [
    {
      "name": "API development",
      "summary": "이 업무가 보통 어떤 식으로 진행되는지",
      "repositories": [
        {
          "repository": "payments-api",
          "repositoryPath": "/absolute/path/to/payments-api",
          "purpose": "이 레포의 역할",
          "directories": ["src/controllers", "src/services", "src/dto"],
          "workflow": "이 레포에서 실제로 일하는 방식"
        }
      ]
    }
  ],
  "domainLanguage": [
    {
      "term": "LedgerX",
      "definition": "회사 내부 의미"
    }
  ],
  "onboardingContext": {
    "primary_role_summary": "이 사람이 주로 하는 일",
    "work_types": ["API development"],
    "domain_language": ["LedgerX"]
  },
  "engineeringDefaults": {
    "test_strategy": "tdd",
    "architecture": "clean-architecture",
    "short_task_execution": "subagent",
    "long_task_execution": "tmux",
    "verification_commands": ["npm test", "npm run build"]
  }
}
```

실행:

```bash
npm run ax -- onboard-context --root /absolute/path/to/target-repo --input /absolute/path/to/onboarding.json
```

### Path C — interactive onboarding

사람이 실제로 질문에 답할 상황일 때만 사용:

```bash
npm run ax -- onboard-context --root /absolute/path/to/target-repo
```

자율 실행 LLM이라면, curated onboarding 파일이 이미 없는 한 **`ax --codex` / `ax --claude-code`를 통한 in-shell onboarding**을 우선한다.

## 6. onboarding 검증

onboarding 후 실행:

```bash
npm run ax -- doctor --root /absolute/path/to/target-repo
```

기대 artifact:

- `~/.shift-ax/index.md`
- `~/.shift-ax/work-types/*.md`
- `~/.shift-ax/procedures/*.md`
- `~/.shift-ax/domain-language/*.md`
- `~/.shift-ax/profile.json`

만약 doctor가 글로벌 index의 broken path를 보고하면:

1. index 또는 문서 경로를 수정
2. doctor 재실행
3. 건강해지기 전까지 request 실행 금지

## 7. request-to-commit 흐름 시작

### Step 1 — request 시작

```bash
npm run ax -- run-request \
  --root /absolute/path/to/target-repo \
  --request "Implement safer refund rollback audit flow"
```

기대 결과:

- `.ax/topics/<topic-slug>/`
- resolved-context / brainstorm / spec / implementation-plan artifact 생성
- workflow는 human plan review 게이트에서 멈춤

### Step 2 — 계획 승인 기록

```bash
npm run ax -- approve-plan \
  --topic /absolute/path/to/target-repo/.ax/topics/<topic-slug> \
  --reviewer "Reviewer Name" \
  --decision approve
```

### Step 3 — 공유 정책 문서 선반영

승인된 계획에서 공유 정책/base-context 문서를 먼저 수정하라고 나오면 이 단계를 생략하면 안 된다.

```bash
npm run ax -- sync-policy-context \
  --topic /absolute/path/to/target-repo/.ax/topics/<topic-slug> \
  --summary "Updated shared policy docs before implementation" \
  --path docs/base-context/refund-policy.md
```

### Step 4 — verification과 함께 재개

```bash
npm run ax -- run-request \
  --topic /absolute/path/to/target-repo/.ax/topics/<topic-slug> \
  --resume \
  --verify-command "npm test" \
  --verify-command "npm run build"
```

## 8. LLM operator용 유용한 support 명령

### repo / topic health

```bash
npm run ax -- doctor --root /absolute/path/to/target-repo
npm run ax -- topic-status --topic /absolute/path/to/topic
npm run ax -- topics-status --root /absolute/path/to/target-repo
```

### docs-first context packaging

```bash
npm run ax -- build-context-bundle \
  --root /absolute/path/to/target-repo \
  --query "refund rollback audit traceability"

npm run ax -- init-context \
  --root /absolute/path/to/target-repo \
  --query "refund rollback audit traceability" \
  --workflow-step planning
```

### context pressure

```bash
npm run ax -- context-health \
  --root /absolute/path/to/target-repo \
  --query "refund rollback audit traceability"

npm run ax -- monitor-context \
  --root /absolute/path/to/target-repo \
  --query "refund rollback audit traceability"
```

### safe pause / resume support

```bash
npm run ax -- pause-work \
  --topic /absolute/path/to/topic \
  --summary "Pause after review preparation." \
  --next-step "Resume after policy clarification." \
  --command "npm run ax -- topic-status --topic /absolute/path/to/topic"
```

## 9. 자율 LLM 실행 시 하드 룰

### Rule 1 — recall보다 문서 우선

`~/.shift-ax/index.md`와 linked pages로 답할 수 있으면 그걸 먼저 쓴다.  
memory-style support tool로 바로 뛰지 않는다.

### Rule 2 — plan review 우회 금지

planning artifact가 있다고 해서 구현 승인이 된 것이 아니다.  
approval는 명시적으로 기록되어야 한다.

### Rule 3 — policy sync 우회 금지

계획에서 공유 문서를 먼저 바꾸라고 하면 구현 재개 전에 반드시 sync한다.

### Rule 4 — deterministic command 우선

자율 실행일 때는:

- `--discover` 우선
- `--input` 우선
- 사람이 명확히 참여 중이 아니면 interactive는 피한다

### Rule 5 — 선행조건 실패 시 중단

아래가 실패하면 계속 진행하지 않는다.

- install 실패
- tests 실패
- build 실패
- doctor가 broken base-context를 보고함

## 10. 가장 짧은 machine-oriented happy path

LLM이 가장 짧게 안전한 경로만 따라야 한다면:

```bash
# Shift AX repo에서
npm install
npm test
npm run build
npm run ax -- doctor

# target repo에 대해
npm run ax -- onboard-context --discover --root /absolute/path/to/target-repo
npm run ax -- doctor --root /absolute/path/to/target-repo
npm run ax -- run-request --root /absolute/path/to/target-repo --request "Implement <task>"
```

discovery가 부족하면 request 시작 전에 file-driven onboarding으로 전환한다.

## 11. 관련 문서

- [../../README.md](../../README.md)
- [../architecture/shift-ax-architecture.md](../architecture/shift-ax-architecture.md)
- [../../scripts/README.md](../../scripts/README.md)
