# Shift AX

<div align="center">

<img src="./logo.png" alt="Shift AX 로고" width="260" />

### 프로젝트보다 한 단계 위에서 반복 작업을 줄여주는 쉬운 AX helper.

여러 레포에 걸친 반복 컨텍스트 주입을 줄이고, 도메인 언어를 학습하고, request-to-commit 흐름을 가이드된 루프로 바꿔줍니다.

[![npm version](https://img.shields.io/npm/v/shift-ax)](https://www.npmjs.com/package/shift-ax)
[![npm downloads](https://img.shields.io/npm/dm/shift-ax)](https://www.npmjs.com/package/shift-ax)
[![GitHub stars](https://img.shields.io/github/stars/handsupmin/shift-ax)](https://github.com/handsupmin/shift-ax/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](https://github.com/handsupmin/shift-ax/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

[English](https://github.com/handsupmin/shift-ax/blob/main/README.md) | [한국어](https://github.com/handsupmin/shift-ax/blob/main/README.ko.md) | [简体中文](https://github.com/handsupmin/shift-ax/blob/main/README.zh.md) | [日本語](https://github.com/handsupmin/shift-ax/blob/main/README.ja.md) | [Español](https://github.com/handsupmin/shift-ax/blob/main/README.es.md)

</div>

AI를 실무에 붙이고 싶지만, 프롬프트 요령부터 먼저 마스터하고 싶지는 않은 사람을 위해 만들었습니다.

`shift-ax`는 **개별 프로젝트보다 상위 레벨**에서 동작하는 쉬운 AX helper입니다. 재사용 가능한 컨텍스트를 글로벌 단위로 관리하고, 도메인 언어를 조금씩 학습하고, 코딩 에이전트 런타임을 request-to-commit 전달 루프로 바꿔줍니다.

---

## 왜 Shift AX인가요?

AI 개발 보조에서 진짜 힘든 건 “모델이 코드를 쓸 수 있느냐”가 아닙니다.

실제 불편함은 보통 이런 데서 옵니다.

- 여러 프로젝트에 걸쳐 같은 컨텍스트를 계속 다시 주입해야 함
- 팀의 도메인 용어와 업무 언어가 어디에도 단단하게 고정돼 있지 않음
- 루틴한 업무도 여전히 사람이 계속 붙어서 챙겨야 함
- 설계가 중요하다는 건 알겠는데, 그 뒤 흐름은 여전히 불안정함
- 내가 AI를 잘 쓰는 사람이 아니라서, 시작 자체가 어렵게 느껴짐

Shift AX는 이 레이어를 쉽게 만들기 위해 존재합니다.

설계와 요구사항만 제대로 잡히면, 그다음부터는 Shift AX가 반복 프롬프팅을 크게 줄이고 훨씬 더 강한 프로세스 가이드와 함께 나머지 전달 흐름을 이어갈 수 있도록 설계되어 있습니다.

---

## 바로 얻는 것들

- **글로벌 재사용 컨텍스트**
  중요한 맥락을 프로젝트 밖에서 관리해서 레포마다 같은 설명을 계속 주입하지 않아도 됩니다.

- **시간이 갈수록 학습되는 도메인 언어**
  조직의 용어, 정책, 절차, 반복 개념을 한 번씩 가르치고 계속 재사용할 수 있습니다.

- **루틴한 전달 업무에 맞춰진 워크플로**
  요청, 계획, 리뷰, 검증을 매번 비슷한 방식으로 처리해야 하는 반복 엔지니어링 업무에 특히 잘 맞습니다.

- **상세한 온보딩과 강한 기본값**
  AI 코딩 도구를 원래 잘 쓰지 못해도, Shift AX는 빠르게 쓸 만한 경로로 들어갈 수 있게 설계되어 있습니다.

- **request-to-commit 가드레일**
  먼저 컨텍스트를 해석하고, 계획을 검토한 뒤, 구현 / 검증 / 리뷰 / 커밋까지 덜 흔들리는 흐름으로 이어갑니다.

---

## 설치 & 빠른 시작

```bash
npm install -g shift-ax
shift-ax --codex
```

Claude Code로 시작하려면:

```bash
shift-ax --claude-code
```

이 정도면 시작할 수 있습니다.
첫 실행에서는 선호 언어와 full-auto 기본 사용 여부를 물어보고, 그에 맞는 런타임 흐름으로 바로 이어줍니다.

그다음부터는 온보딩 한 번 하고, 재사용 가능한 컨텍스트를 가르친 뒤, 요청을 시작하면 됩니다.

- **CLI 명령어:** `shift-ax`
- **요구 사항:** Node.js 20+

글로벌 설치 대신 소스 체크아웃에서 직접 쓰고 싶다면:

```bash
npm install
npm run build
npm link
```

---

## 자주 쓰는 흐름

### 재사용 컨텍스트를 한 번 온보딩하기

Shift AX는 재사용 지식을 여기에 저장합니다.

- `~/.shift-ax/index.md`
- `~/.shift-ax/work-types/`
- `~/.shift-ax/procedures/`
- `~/.shift-ax/domain-language/`

런타임 안에서:

- **Codex:** `$onboard`
- **Claude Code:** `/onboard`

이 단계에서 Shift AX가 당신의 업무 언어와 흐름을 익히기 시작합니다.

### 요청 시작하기

런타임 안에서:

- **Codex:** `$request <text>`
- **Claude Code:** `/request <text>`

Shift AX는 먼저 컨텍스트를 해석하고, 요청 전용 topic/worktree를 만들고, 계획 리뷰에서 멈춘 뒤, 구현 / 검증 / 리뷰 / 커밋 흐름으로 다시 이어갑니다.

### 나중에 재개 / 리뷰 / 상태 확인하기

자주 쓰는 런타임 명령:

- **Codex:** `$doctor`, `$status`, `$topics`, `$resume`, `$review`, `$export-context`
- **Claude Code:** `/doctor`, `/status`, `/topics`, `/resume`, `/review`, `/export-context`

### 필요하면 CLI로 직접 흐름 실행하기

```bash
shift-ax onboard-context --discover
shift-ax run-request --request "Build safer auth refresh flow"
shift-ax approve-plan --topic .ax/topics/<topic> --reviewer "Alex" --decision approve
shift-ax run-request --topic .ax/topics/<topic> --resume
```

---

## 왜 자연스럽게 느껴질까요?

**Shift AX는 프로젝트보다 위에서 동작하지만, 이미 쓰는 도구들과 자연스럽게 붙습니다.**

중요한 이유는 많은 AX 반복 비용이 사실 한 레포에만 묶여 있지 않기 때문입니다.
예를 들면 이런 것들입니다.

- 팀이 개념을 부르는 방식
- 도메인에서 정책과 비즈니스 규칙을 말하는 방식
- 보통 무엇을 완료로 보는지
- 어떤 리뷰와 검증 단계를 항상 거쳐야 하는지
- 계속 반복해서 돌아오는 루틴 업무가 무엇인지

Shift AX는 이 컨텍스트를 각 레포 안에 다시 심는 대신, 글로벌 레벨에서 유지합니다.

그래서 세션을 열 때마다 컨텍스트 스택을 처음부터 다시 쌓는 대신, 점점 재사용 가능한 운영 레이어가 만들어집니다.

- 글로벌 컨텍스트
- 학습된 도메인 언어
- 재사용 가능한 절차
- 반복 가능한 request 처리 흐름

이게 Shift AX가 프롬프트 요령 모음이 아니라 실제 시스템처럼 느껴지는 이유입니다.

---

## 현실적인 워크플로

예를 들어 이런 환경에서 일한다고 해봅시다.

- 여러 제품 레포
- 내부 플랫폼 레포
- 고객사별 레포 한두 개
- 계속 반복해서 들어오는 전달 업무

Shift AX가 없으면 새 AI 세션마다 같은 오버헤드가 반복됩니다.

- 도메인 설명 또 하기
- 회사 언어 설명 또 하기
- 리뷰 규칙 설명 또 하기
- 기대하는 전달 흐름 설명 또 하기

Shift AX가 있으면 이 재사용 레이어를 한 번 온보딩하고 글로벌하게 유지한 뒤, 새로운 요청이 훨씬 더 강한 기본값에서 시작되게 만들 수 있습니다.

핵심 약속은 이겁니다.

> 반복적인 컨텍스트 주입은 줄이고,
> 시간이 갈수록 더 강해지는 가이드형 전달 흐름을 만든다.

---

## 핵심 개념

- **글로벌 컨텍스트**
  개별 레포를 넘어서 재사용되는 업무 지식입니다.

- **도메인 언어**
  조직이 반복해서 쓰는 용어, 개념, 정책 표현입니다.

- **topic/worktree**
  요청 하나를 위한 독립적인 작업 레인과 아티팩트 세트입니다.

- **계획 리뷰 게이트**
  구현 전에 반드시 사람이 계획을 확인하도록 멈추는 지점입니다.

- **request-to-commit 루프**
  컨텍스트 해석, 계획, 구현, 검증, 리뷰, 커밋을 하나의 가이드된 흐름으로 묶는 구조입니다.

---

## 다른 LLM에게 넘길 프롬프트

다른 LLM이 설치부터 사용까지 대신 하게 하려면 아래를 넘기면 됩니다.

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

---

## 문서

- Vision: [`docs/vision.md`](./docs/vision.md)
- Architecture: [`docs/architecture/shift-ax-architecture.md`](./docs/architecture/shift-ax-architecture.md)
- LLM setup detail: [`docs/setup/llm-install-and-bootstrap.ko.md`](./docs/setup/llm-install-and-bootstrap.ko.md)
- Operator guide: [`docs/operations/operator-guide.ko.md`](./docs/operations/operator-guide.ko.md)
- Release notes: [`docs/release-notes/`](./docs/release-notes/)
