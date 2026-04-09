# Shift AX 도입 체크리스트

**English version:** [rollout-checklist.md](./rollout-checklist.md)

## 목표

AX 경험이 많지 않은 팀도 Shift AX를 도입할 수 있게 만드는 체크리스트입니다.

실행할 때는 상세 계획 문서인 [pilot-plan.ko.md](./pilot-plan.ko.md)와 같이 보세요.

## 1단계 — 사전 조건

- [ ] pilot repository 1개 선정
- [ ] 해당 repo에 최소한의 test/build baseline이 존재하는지 확인
- [ ] plan approval를 담당할 사람 지정
- [ ] authoritative source가 될 공유 정책/문서 영역 1~2개 지정
- [ ] pilot 팀이 Codex 및/또는 Claude Code runtime을 실제로 사용할 수 있는지 확인

## 2단계 — 공유 context 준비

- [ ] domain / policy / architecture 문서 준비
- [ ] 실행:
  - [ ] `npm run ax -- onboard-context --discover`
  - 또는
  - [ ] `npm run ax -- onboard-context --input ./onboarding.json`
- [ ] `docs/base-context/index.md` 검토
- [ ] `docs/base-context/domain-glossary.md` 검토
- [ ] `npm run ax -- doctor` 실행
- [ ] doctor 결과가 `ok`인지 확인

## 3단계 — pilot 흐름 검증

- [ ] 작은 요청 1개를 `ax run-request`로 시작
- [ ] 생성된 brainstorm/spec/implementation plan 검토
- [ ] 실제 human approval를 `ax approve-plan`으로 기록
- [ ] 공유 문서 수정이 필요하면 `ax sync-policy-context`가 실제로 사용되는지 확인
- [ ] verification command와 함께 resume 실행
- [ ] `topic-status`에서 phase 전이가 기대대로 보이는지 확인
- [ ] reviewed local commit이 실제로 생성되거나, review gate가 올바르게 막는지 확인

## 4단계 — runtime 검증

실제로 사용할 platform마다 최소 1개 task를 실행합니다.

### Codex
- [ ] `ax launch-execution --platform codex --topic ... --task-id ...`
- [ ] worktree 안에 실제 파일 변경이 있었는지 확인
- [ ] execution output artifact가 생성됐는지 확인

### Claude Code
- [ ] `ax launch-execution --platform claude-code --topic ... --task-id ...`
- [ ] worktree 안에 실제 파일 변경이 있었는지 확인
- [ ] execution output artifact가 생성됐는지 확인

## 5단계 — 실패 처리

- [ ] `ax react-feedback`로 review-fix 또는 CI-fix reopen을 한 번 실행
- [ ] topic이 `implementation_running`으로 되돌아가는지 확인
- [ ] `topics-status`에 reopened item이 제대로 보이는지 확인

## 6단계 — 팀 준비도

- [ ] 팀이 아래 명령을 언제 쓰는지 설명할 수 있는지 확인
  - [ ] `doctor`
  - [ ] `topic-status`
  - [ ] `topics-status`
  - [ ] `sync-policy-context`
  - [ ] `react-feedback`
- [ ] 팀이 base-context docs가 memory/recall보다 우선한다는 점을 이해하는지 확인
- [ ] 팀이 공유 문서 수정이 필요한 경우 구현보다 먼저 반영해야 한다는 점을 이해하는지 확인

## 종료 기준

아래가 충족되면 더 넓은 rollout로 넘어갈 수 있습니다.

- [ ] onboarding이 반복 가능함
- [ ] pilot repo에서 doctor가 깨끗함
- [ ] 최소 1개의 full request-to-commit path가 성공함
- [ ] 최소 1개의 policy-sync stop이 제대로 처리됨
- [ ] 최소 1개의 downstream feedback reopen이 제대로 처리됨
- [ ] 사용할 각 platform마다 최소 1개의 real execution success가 있음
