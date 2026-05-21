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

- **決定的なエージェントハーネス**
  LLM にオーケストレーションを任せず、FSM、SQLite queue、DAG readiness、retry、idempotency をスクリプトが所有するレールの中でエージェント作業を実行します。

---

## インストール & クイックスタート

```bash
npm install -g shift-ax@latest
shift-ax --version
shift-ax update
shift-ax --codex
```

Claude Code で始めるなら:

```bash
shift-ax --claude-code
```

これで始められます。
初回起動時には優先言語と full-auto のデフォルトを聞かれ、そのまま適切なランタイムフローに入ります。
起動時には最大 24 時間に 1 回だけ npm `latest` を確認します。インストール済みのバージョンが古い場合は更新するか聞かれ、そのバージョンをスキップするとバージョンと最終確認時刻が `~/.shift-ax/settings.json` に保存され、同じ案内が繰り返されません。
ランタイム skills はプロジェクトごとではなくグローバルにだけインストールされます。Codex は `~/.codex/skills` と `~/.codex/prompts`、Claude Code は `~/.claude/commands` と `~/.claude/hooks` を使います。Codex が新しく追加された Shift AX skill や prompt の承認を求めた場合は一度だけ承認してください。以降の repo は同じグローバルインストールを再利用します。古いバージョンが作ったプロジェクトローカルの Shift AX skill コピーは、コマンドが二重表示されないよう自動で整理されます。

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

- `~/.shift-ax/index.md`: 検索可能な label、alias、repository、workflow、domain term を集めた単一 dictionary
- `~/.shift-ax/role/`
- `~/.shift-ax/work-types/`
- `~/.shift-ax/repos/`
- `~/.shift-ax/procedures/`
- `~/.shift-ax/domain-language/`

ランタイム内では:

- **Codex:** `$onboard`
- **Claude Code:** `/onboard`

この段階で、Shift AX はあなたの仕事の言葉と進め方を覚え始めます。関連 repo をそれぞれ調べ、マージ済み PR 履歴とユーザーが与えたルールから repo 別 review gate を作り、dictionary が実在するドキュメントへリンクしているか、保存されたコンテキストが使える状態かを検証します。

### リクエストを始める

ランタイム内では:

- **Codex:** `$request <text>`
- **Claude Code:** `/request <text>`

Shift AX は先にコンテキストを解決し、リクエスト専用の topic/worktree を作り、チャット内でユーザー言語の詳細な承認パケットを提示して `1/2/3` のレビューを受けます。承認後は実装 / 検証 / レビュー / コミットへ自動的に進みます。内部の approve/resume コマンドは通常のユーザー操作ではなく、復旧用です。

### 後からレビュー / 状態確認する

よく使うランタイムコマンド:

- **Codex:** `$doctor`, `$status`, `$topics`, `$review`, `$export-context`
- **Claude Code:** `/doctor`, `/status`, `/topics`, `/review`, `/export-context`

### 必要なら CLI から直接回す

```bash
shift-ax onboard-context --discover
shift-ax onboard-context --gctree-reference /path/to/reference
shift-ax run-request --request "Build safer auth refresh flow"
shift-ax topic-status --topic .shift-ax/topics/<topic>
```

Product shell の自動化では、エージェントがリクエスト内のファイルとリポジトリ構造を先に確認し、具体的な brainstorm/spec/plan ファイルを作ってから `run-request` に渡します。非対話 planning 入力が空の場合は失敗させ、placeholder の計画が誤って承認されないようにします。

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

- **独立レビューゲート**
  最終レビューでは、保存済みの成果物だけを見る clean-context ゲートで、コミット前にオンボーディング準拠、PRD 証拠、パス範囲、side-effect リスク、テスト関連性を再確認します。

- **request-to-commit ループ**
  コンテキスト解決、計画、決定的オーケストレーション、実装、検証、レビュー、コミットを一つの流れとして扱う構造です。

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
- if Shift AX is not installed, run `npm install -g shift-ax@latest`
- if Shift AX says npm latest is newer, choose update unless the user explicitly wants to skip that version
- use `shift-ax update` to reinstall npm latest and refresh global runtime commands
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
- if shared policy/context docs must change first, update them before implementation continues

Suggested first commands:
1. `shift-ax --codex`
2. run `$onboard`
3. run `$request <the user's task>`
```

---

## 客観的な品質指標

`shift-ax eval` は request-to-commit の品質を、定性的な説明ではなく数値で検証します。現在の objective eval baseline は objective score 100% (18/18)、raw matched context 比で token reduction 89%、review gate allow/block accuracy 100%、deterministic harness checks 100% です。

```bash
shift-ax eval --output .shift-ax/evals/latest
npm run eval:objective
npm run eval:all
```

結果は `objective-eval-report.json` と `objective-eval-report.md` に保存され、threshold を 1 つでも下回ると exit code 1 で失敗します。

---

## ドキュメント

- Vision: [`docs/vision.md`](./docs/vision.md)
- Architecture: [`docs/architecture/shift-ax-architecture.md`](./docs/architecture/shift-ax-architecture.md)
- LLM setup details: [`docs/setup/llm-install-and-bootstrap.md`](./docs/setup/llm-install-and-bootstrap.md)
- Operator guide: [`docs/operations/operator-guide.md`](./docs/operations/operator-guide.md)
- Objective eval framework: [`docs/evaluation/objective-eval.md`](./docs/evaluation/objective-eval.md)
- Release notes: [`docs/release-notes/`](./docs/release-notes/)
