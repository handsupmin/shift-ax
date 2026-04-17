# Shift AX

<div align="center">

<img src="./logo.png" alt="Shift AX logo" width="260" />

### プロジェクトより一段上で反復作業を減らす、使いやすい AX helper。

複数リポジトリにまたがるコンテキストの再注入を減らし、ドメイン言語を学習し、request-to-commit の流れをガイド付きループに変えます。

[![npm version](https://img.shields.io/npm/v/shift-ax)](https://www.npmjs.com/package/shift-ax)
[![npm downloads](https://img.shields.io/npm/dm/shift-ax)](https://www.npmjs.com/package/shift-ax)
[![GitHub stars](https://img.shields.io/github/stars/handsupmin/shift-ax)](https://github.com/handsupmin/shift-ax/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](https://github.com/handsupmin/shift-ax/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

[English](https://github.com/handsupmin/shift-ax/blob/main/README.md) | [한국어](https://github.com/handsupmin/shift-ax/blob/main/README.ko.md) | [简体中文](https://github.com/handsupmin/shift-ax/blob/main/README.zh.md) | [日本語](https://github.com/handsupmin/shift-ax/blob/main/README.ja.md) | [Español](https://github.com/handsupmin/shift-ax/blob/main/README.es.md)

</div>

AI を実務に入れたいけれど、まずプロンプト職人になるところから始めたくはない。そんな人のために作られています。

`shift-ax` は **個別プロジェクトの上位レイヤー** で動く、扱いやすい AX helper です。再利用できるコンテキストをグローバルに持ち、ドメイン言語を少しずつ覚え、コーディングエージェントのランタイムを request-to-commit のガイド付きフローに変えます。

---

## なぜ Shift AX なのか

AI を使った開発で本当に大変なのは、「モデルがコードを書けるか」ではありません。

実際につらいのは、たいてい次のような部分です。

- 複数プロジェクトにまたがって同じコンテキストを何度も入れ直す
- チーム固有のドメイン用語や仕事の言い回しが、どこにも安定して定着していない
- 定型的な仕事でも、まだ人がずっと付き添わないと不安
- 設計が大事なのは分かっているのに、その後の流れがまだ脆い
- そもそも AI をどう使えばうまくいくのか、自信がない

Shift AX は、このレイヤーを楽にするためのものです。

設計と要件さえきちんと整えられれば、その先は Shift AX が繰り返しのプロンプト作業を減らしつつ、より強いプロセスガイドの中で delivery を前に進めやすくしてくれます。

---

## これで得られること

- **グローバルな再利用コンテキスト**
  大事な文脈をプロジェクトの外側で持てるので、リポジトリごとに同じ説明を繰り返さずに済みます。

- **時間とともに学習されるドメイン言語**
  組織の用語、ポリシー、手順、繰り返し出てくる概念を一度ずつ教え、継続的に再利用できます。

- **定型 delivery 作業に向いたワークフロー**
  リクエスト、計画、レビュー、検証を毎回似た手順で回したい日常的なエンジニアリング作業に特に向いています。

- **詳しいオンボーディングと強いデフォルト**
  AI コーディングツールに慣れていなくても、実用的な流れに入りやすいよう設計されています。

- **request-to-commit のガードレール**
  先にコンテキストを解決し、計画を確認してから、実装 / 検証 / レビュー / コミットまでをぶれにくい形で進められます。

---

## インストール & クイックスタート

```bash
npm install -g shift-ax
shift-ax --codex
```

Claude Code で始めるなら:

```bash
shift-ax --claude-code
```

これで始められます。
初回起動時には優先言語と full-auto のデフォルトを聞かれ、そのまま適切なランタイムフローに入ります。

あとは一度オンボードし、再利用コンテキストを教えて、そこからリクエストを始めれば大丈夫です。

- **CLI コマンド:** `shift-ax`
- **要件:** Node.js 20+

グローバルインストールではなくソースから使う場合:

```bash
npm install
npm run build
npm link
```

---

## よく使う流れ

### 再利用コンテキストを一度オンボードする

Shift AX は再利用知識を次に保存します。

- `~/.shift-ax/index.md`
- `~/.shift-ax/work-types/`
- `~/.shift-ax/procedures/`
- `~/.shift-ax/domain-language/`

ランタイム内では:

- **Codex:** `$onboard`
- **Claude Code:** `/onboard`

この段階で、Shift AX はあなたの仕事の言葉と進め方を覚え始めます。

### リクエストを始める

ランタイム内では:

- **Codex:** `$request <text>`
- **Claude Code:** `/request <text>`

Shift AX は先にコンテキストを解決し、リクエスト専用の topic/worktree を作り、計画レビューで止まり、その後に実装 / 検証 / レビュー / コミットへ進みます。

### 後から再開 / レビュー / 状態確認する

よく使うランタイムコマンド:

- **Codex:** `$doctor`, `$status`, `$topics`, `$resume`, `$review`, `$export-context`
- **Claude Code:** `/doctor`, `/status`, `/topics`, `/resume`, `/review`, `/export-context`

### 必要なら CLI から直接回す

```bash
shift-ax onboard-context --discover
shift-ax run-request --request "Build safer auth refresh flow"
shift-ax approve-plan --topic .ax/topics/<topic> --reviewer "Alex" --decision approve
shift-ax run-request --topic .ax/topics/<topic> --resume
```

---

## しっくりくる理由

**Shift AX はプロジェクトの外側で動くのに、すでに使っているツール群に自然に馴染みます。**

大事なのは、多くの AX の反復コストが一つのリポジトリだけに閉じていないことです。
たとえば:

- チームが概念をどう呼ぶか
- ドメインでポリシーや業務ルールをどう表現するか
- 何をもって完了とみなすか
- どのレビューや検証が毎回必要か
- どんな定型作業が何度も戻ってくるか

Shift AX は、こうしたコンテキストを各 repo の中に毎回埋め込む代わりに、グローバルレベルで保持します。

その結果、セッションのたびに文脈を積み直すのではなく、再利用できる運用レイヤーが少しずつ育っていきます。

- グローバルコンテキスト
- 学習されたドメイン言語
- 再利用できる手順
- 再現性のある request 処理フロー

だから Shift AX は、単なるプロンプトの小技集ではなく、実際に使えるシステムのように感じられます。

---

## 現実的なワークフロー

たとえば、次のような環境で働いているとします。

- 複数のプロダクトリポジトリ
- 社内プラットフォームリポジトリ
- 顧客別リポジトリが 1〜2 個
- 継続的に発生する定型的な delivery 作業

Shift AX がないと、新しい AI セッションごとに同じオーバーヘッドが発生します。

- ドメインをまた説明する
- 会社の言い回しをまた説明する
- レビュー規則をまた説明する
- 期待する delivery フローをまた説明する

Shift AX があれば、その再利用レイヤーを一度オンボードしてグローバルに持ち、新しいリクエストをもっと強いデフォルトから始められます。

つまり約束しているのは、

> コンテキストの再注入を減らし、
> 使うほど強くなるガイド付き delivery フローを作ることです。

---

## コア概念

- **グローバルコンテキスト**
  単一リポジトリを越えて再利用される仕事の知識です。

- **ドメイン言語**
  組織が繰り返し使う用語、概念、ポリシー表現です。

- **topic/worktree**
  1 つのリクエストのための独立した作業レーンと成果物セットです。

- **計画レビューゲート**
  実装前に必ず人が計画を確認するための停止点です。

- **request-to-commit ループ**
  コンテキスト解決、計画、実装、検証、レビュー、コミットを一つの流れとして扱う構造です。

---

## 別の LLM に渡すためのプロンプト

別の LLM に Shift AX の導入から利用まで任せたいなら、次を渡してください。

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

## ドキュメント

- Vision: [`docs/vision.md`](./docs/vision.md)
- Architecture: [`docs/architecture/shift-ax-architecture.md`](./docs/architecture/shift-ax-architecture.md)
- LLM setup details: [`docs/setup/llm-install-and-bootstrap.md`](./docs/setup/llm-install-and-bootstrap.md)
- Operator guide: [`docs/operations/operator-guide.md`](./docs/operations/operator-guide.md)
- Release notes: [`docs/release-notes/`](./docs/release-notes/)
