# Shift AX

<div align="center">

<img src="./logo.png" alt="Shift AX logo" width="260" />

### 一个在项目之上减少重复工作的易用 AX helper。

减少跨仓库重复注入上下文，让工具逐步学会你的领域语言，并把 request-to-commit 交付流程变成一条有引导的闭环。

[![npm version](https://img.shields.io/npm/v/shift-ax)](https://www.npmjs.com/package/shift-ax)
[![npm downloads](https://img.shields.io/npm/dm/shift-ax)](https://www.npmjs.com/package/shift-ax)
[![GitHub stars](https://img.shields.io/github/stars/handsupmin/shift-ax)](https://github.com/handsupmin/shift-ax/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](https://github.com/handsupmin/shift-ax/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

[English](https://github.com/handsupmin/shift-ax/blob/main/README.md) | [한국어](https://github.com/handsupmin/shift-ax/blob/main/README.ko.md) | [简体中文](https://github.com/handsupmin/shift-ax/blob/main/README.zh.md) | [日本語](https://github.com/handsupmin/shift-ax/blob/main/README.ja.md) | [Español](https://github.com/handsupmin/shift-ax/blob/main/README.es.md)

</div>

它是给这样的人准备的：想把 AI 真正用进交付流程里，但并不想先变成一个 prompt 技巧专家。

`shift-ax` 是一个运行在 **单个项目之上** 的易用 AX helper。它以全局方式维护可复用上下文，持续学习你的领域语言，并把编码代理运行时组织成一条 request-to-commit 的引导式交付流程。

---

## 为什么是 Shift AX？

AI 辅助开发里最麻烦的事，通常并不是“模型会不会写代码”。

真正的痛点往往是这些：

- 你要在多个项目之间反复注入同一套上下文
- 团队的领域术语和工作语言没有被稳定沉淀下来
- 很多例行业务依然要靠人持续盯着
- 你知道设计很重要，但后续交付流程还是很脆弱
- 你并不确定怎样才算“把 AI 用好”，所以上手门槛依旧很高

Shift AX 的目标，就是把这一层变简单。

只要设计和需求先梳理清楚，Shift AX 就会尽量减少重复提示，把后续交付流程放进一套更强、更稳的过程引导里。

---

## 你会直接得到什么

- **全局可复用上下文**
  重要上下文不再被锁在某个项目里，也不用一个仓库一个仓库地重复注入。

- **会随着使用逐步学会的领域语言**
  把组织里的术语、政策、流程和高频概念教给 Shift AX，一次沉淀，持续复用。

- **为例行交付工作优化过的工作流**
  特别适合那些请求、计划、评审、验证需要重复稳定执行的工程工作。

- **细致 onboarding + 强默认值**
  即使你并不擅长使用 AI 编码工具，也能更快进入一条真正可用的路径。

- **request-to-commit 护栏**
  先解上下文，再审计划，然后再进入实现、验证、评审和提交，减少整条链路里的模糊地带。

---

## 安装与快速开始

```bash
npm install -g shift-ax
shift-ax --codex
```

如果你想用 Claude Code：

```bash
shift-ax --claude-code
```

这样就能开始了。
首次运行时，Shift AX 会询问你偏好的语言，以及是否默认开启 full-auto，然后把你带进正确的运行时流程。

之后只需要完成一次 onboarding，把可复用上下文教给它，然后就可以开始处理请求。

- **CLI 命令：** `shift-ax`
- **要求：** Node.js 20+

如果你想直接从源码运行，而不是全局安装：

```bash
npm install
npm run build
npm link
```

---

## 常用操作

### 先把可复用上下文 onboard 一次

Shift AX 会把可复用知识放在：

- `~/.shift-ax/index.md`
- `~/.shift-ax/work-types/`
- `~/.shift-ax/procedures/`
- `~/.shift-ax/domain-language/`

在运行时里：

- **Codex:** `$onboard`
- **Claude Code:** `/onboard`

这一步就是 Shift AX 开始学习你的工作语言和工作方式的地方。

### 开始一个请求

在运行时里：

- **Codex:** `$request <text>`
- **Claude Code:** `/request <text>`

Shift AX 会先解析上下文，创建请求专属 topic/worktree，在计划评审处停下来，然后再继续进入实现、验证、评审与提交流程。

### 之后再恢复 / 评审 / 查看状态

常用运行时命令：

- **Codex:** `$doctor`, `$status`, `$topics`, `$resume`, `$review`, `$export-context`
- **Claude Code:** `/doctor`, `/status`, `/topics`, `/resume`, `/review`, `/export-context`

### 需要时也可以直接用 CLI 跑完整流程

```bash
shift-ax onboard-context --discover
shift-ax run-request --request "Build safer auth refresh flow"
shift-ax approve-plan --topic .ax/topics/<topic> --reviewer "Alex" --decision approve
shift-ax run-request --topic .ax/topics/<topic> --resume
```

---

## 为什么它用起来会很顺手

**Shift AX 工作在项目之上，但又能自然地接进你已经在用的工具。**

这很重要，因为很多 AX 的重复成本，本来就不属于某一个仓库本身。
它们更多来自这些东西：

- 团队如何命名概念
- 领域里如何表达政策和业务规则
- 什么才算真正完成
- 哪些评审和验证步骤每次都不能少
- 哪些例行任务会不断重复出现

Shift AX 不会要求你在每个仓库里一遍遍重建这些上下文，而是把它们保存在全局层。

所以你不再需要每次开新会话都从零重新搭上下文栈，而是会逐渐积累出一层可复用的运作层：

- 全局上下文
- 被学会的领域语言
- 可复用的流程
- 可重复的 request 处理方式

这也是为什么它更像一个真实系统，而不是一堆 prompt 技巧拼出来的东西。

---

## 一个更贴近现实的工作流

假设你平时同时在这些地方工作：

- 多个产品仓库
- 一个内部平台仓库
- 一两个客户专用仓库
- 稳定重复出现的交付任务

如果没有 Shift AX，每开一个新的 AI 会话，都会重复同样的额外开销：

- 再讲一遍领域背景
- 再讲一遍公司内部语言
- 再讲一遍评审规则
- 再讲一遍期望的交付流程

有了 Shift AX，你可以先把这层可复用能力 onboard 一次，并以全局方式保存下来，让每个新请求都从一个更强的默认状态开始。

它的核心承诺就是：

> 减少重复性的上下文注入，
> 让交付流程随着使用不断变得更稳、更顺。

---

## 核心概念

- **全局上下文**
  超出单个仓库、可以反复复用的工作知识。

- **领域语言**
  组织里反复出现的术语、概念与政策表达方式。

- **topic/worktree**
  一个请求专属的工作通道，以及与之配套的工件和状态。

- **计划评审关卡**
  在实现开始前，先强制停下来让人确认计划。

- **request-to-commit 闭环**
  把上下文解析、计划、实现、验证、评审和提交组织成一条有引导的流程。

---

## 把这段提示词交给另一个 LLM

如果你希望另一个 LLM 替你完成 Shift AX 的安装与使用，可以把下面这段交给它：

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

## 文档

- Vision: [`docs/vision.md`](./docs/vision.md)
- Architecture: [`docs/architecture/shift-ax-architecture.md`](./docs/architecture/shift-ax-architecture.md)
- LLM setup details: [`docs/setup/llm-install-and-bootstrap.md`](./docs/setup/llm-install-and-bootstrap.md)
- Operator guide: [`docs/operations/operator-guide.md`](./docs/operations/operator-guide.md)
- Release notes: [`docs/release-notes/`](./docs/release-notes/)
