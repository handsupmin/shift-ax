# Shift AX

<div align="center">

<img src="./logo.png" alt="logo de Shift AX" width="260" />

### Un helper AX fácil para reducir trabajo repetitivo por encima del proyecto.

Reduce la reinyección de contexto entre repositorios, deja que la herramienta aprenda tu lenguaje de dominio y convierte el flujo request-to-commit en un circuito guiado.

[![npm version](https://img.shields.io/npm/v/shift-ax)](https://www.npmjs.com/package/shift-ax)
[![npm downloads](https://img.shields.io/npm/dm/shift-ax)](https://www.npmjs.com/package/shift-ax)
[![GitHub stars](https://img.shields.io/github/stars/handsupmin/shift-ax)](https://github.com/handsupmin/shift-ax/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](https://github.com/handsupmin/shift-ax/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

[English](https://github.com/handsupmin/shift-ax/blob/main/README.md) | [한국어](https://github.com/handsupmin/shift-ax/blob/main/README.ko.md) | [简体中文](https://github.com/handsupmin/shift-ax/blob/main/README.zh.md) | [日本語](https://github.com/handsupmin/shift-ax/blob/main/README.ja.md) | [Español](https://github.com/handsupmin/shift-ax/blob/main/README.es.md)

</div>

Está hecho para quienes quieren meter IA en trabajo real, pero no quieren convertirse antes en especialistas en rituales de prompts.

`shift-ax` es un helper AX sencillo que vive **por encima de un proyecto concreto**. Mantiene contexto reutilizable a nivel global, aprende tu lenguaje de dominio con el tiempo y convierte los runtimes de agentes de código en un flujo guiado de request-to-commit.

---

## Por qué Shift AX

La fricción real del desarrollo asistido por IA no suele ser “¿puede el modelo escribir código?”.

Normalmente el dolor aparece aquí:

- vuelves a inyectar el mismo contexto una y otra vez entre varios proyectos
- el lenguaje de dominio y la forma de trabajar del equipo no quedan fijados en ningún sitio duradero
- incluso el trabajo rutinario sigue necesitando demasiado acompañamiento manual
- sabes que el diseño importa, pero el resto del flujo sigue siendo frágil
- ni siquiera tienes claro cómo “usar bien la IA”, así que entrar cuesta más de lo que debería

Shift AX existe para hacer esa capa mucho más fácil.

Si consigues dejar bien aterrizados el diseño y los requisitos, Shift AX está pensado para que el resto del flujo avance con mucha menos repetición de prompts y con una guía de proceso mucho más fuerte.

---

## Qué te da

- **Contexto global reutilizable**
  El contexto importante vive fuera de cada proyecto, así que no tienes que reinyectarlo repo por repo.

- **Lenguaje de dominio que se aprende con el tiempo**
  Puedes enseñarle una vez tus términos, políticas, procedimientos y conceptos recurrentes, y reutilizarlos después.

- **Un flujo afinado para trabajo rutinario de delivery**
  Encaja especialmente bien en trabajo de ingeniería donde requests, planes, reviews y verificación deben seguir un patrón repetible.

- **Onboarding detallado con buenos valores por defecto**
  Incluso si no eres especialmente bueno usando herramientas de IA para programar, Shift AX está diseñado para ponerte rápido en un camino útil.

- **Guardrails de request-to-commit**
  Primero resuelve contexto, luego revisa el plan y solo después pasa a implementación, verificación, review y commit con menos ambigüedad.

---

## Instalación y arranque rápido

```bash
npm install -g shift-ax
shift-ax --codex
```

Si prefieres empezar con Claude Code:

```bash
shift-ax --claude-code
```

Con eso ya puedes arrancar.
En la primera ejecución, Shift AX te pregunta el idioma preferido y si quieres activar full-auto por defecto, y a partir de ahí te mete directamente en el flujo correcto.

Después solo tienes que hacer onboarding una vez, enseñarle tu contexto reutilizable y empezar a lanzar requests.

- **Comando CLI:** `shift-ax`
- **Requisito:** Node.js 20+

Si quieres usarlo desde el código fuente en vez de una instalación global:

```bash
npm install
npm run build
npm link
```

---

## Movimientos habituales

### Haz onboarding del contexto reutilizable una vez

Shift AX guarda el conocimiento reutilizable en:

- `~/.shift-ax/index.md` como diccionario único de labels, alias, repositorios, workflows y términos de dominio buscables
- `~/.shift-ax/role/`
- `~/.shift-ax/work-types/`
- `~/.shift-ax/repos/`
- `~/.shift-ax/procedures/`
- `~/.shift-ax/domain-language/`

Dentro del runtime:

- **Codex:** `$onboard`
- **Claude Code:** `/onboard`

Aquí es donde Shift AX empieza a aprender cómo suena y cómo fluye tu trabajo real. Antes de considerar terminado el onboarding, verifica que el diccionario apunte a documentos reales y que el contexto guardado sea usable.

### Inicia un request

Dentro del runtime:

- **Codex:** `$request <text>`
- **Claude Code:** `/request <text>`

Shift AX resuelve primero el contexto, crea un topic/worktree específico para ese request, se detiene en la review del plan y luego continúa con implementación, verificación, review y commit.

### Reanuda, revisa e inspecciona más tarde

Comandos habituales del runtime:

- **Codex:** `$doctor`, `$status`, `$topics`, `$resume`, `$review`, `$export-context`
- **Claude Code:** `/doctor`, `/status`, `/topics`, `/resume`, `/review`, `/export-context`

### Si hace falta, ejecuta el flujo desde CLI

```bash
shift-ax onboard-context --discover
shift-ax run-request --request "Build safer auth refresh flow"
shift-ax approve-plan --topic .ax/topics/<topic> --reviewer "Alex" --decision approve
shift-ax run-request --topic .ax/topics/<topic> --resume
```

---

## Por qué se siente natural

**Shift AX trabaja por encima del proyecto, pero encaja con las herramientas que ya usas.**

Eso importa porque gran parte del coste repetitivo de AX no pertenece realmente a un solo repositorio.
Suele vivir en cosas como:

- cómo nombra conceptos tu equipo
- cómo expresa el dominio sus políticas y reglas de negocio
- qué significa de verdad “hecho”
- qué pasos de review y verificación nunca deberían saltarse
- qué tareas rutinarias vuelven una y otra vez

Shift AX mantiene ese contexto a nivel global, en lugar de obligarte a reconstruirlo dentro de cada repo.

Así, en vez de rehacer la misma pila de contexto cada vez que abres una sesión, vas acumulando una capa operativa reutilizable:

- contexto global
- lenguaje de dominio aprendido
- procedimientos reutilizables
- una forma repetible de manejar requests

Por eso se siente menos como malabarismo con prompts y más como un sistema de trabajo de verdad.

---

## Un flujo de trabajo realista

Imagina que trabajas entre:

- varios repos de producto
- un repo interno de plataforma
- uno o dos repos específicos de cliente
- un flujo constante de tareas de delivery que se parecen entre sí

Sin Shift AX, cada sesión nueva con IA repite el mismo overhead:

- volver a explicar el dominio
- volver a explicar el lenguaje interno de la empresa
- volver a explicar las reglas de review
- volver a explicar el flujo esperado de delivery

Con Shift AX, haces onboarding de esa capa reutilizable una vez, la mantienes a nivel global y haces que cada request nuevo arranque desde una base mucho más fuerte.

La promesa central es esta:

> menos reinyección repetitiva de contexto,
> más delivery guiado que se vuelve mejor cuanto más lo usas.

---

## Conceptos clave

- **Contexto global**
  Conocimiento de trabajo reutilizable que vive por encima de un solo repositorio.

- **Lenguaje de dominio**
  Términos, conceptos y expresiones de política que tu organización usa una y otra vez.

- **Topic/worktree**
  Un carril de trabajo dedicado a un request, con sus propios artefactos y estado.

- **Puerta de review del plan**
  Un punto de parada explícito para que una persona valide el plan antes de implementar.

- **Bucle request-to-commit**
  Context resolution, planificación, implementación, verificación, review y commit como un solo flujo guiado.

---

## Dale este prompt a otro LLM

Si quieres que otro LLM instale y use Shift AX por ti, dale esto:

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

## Documentación

- Vision: [`docs/vision.md`](./docs/vision.md)
- Architecture: [`docs/architecture/shift-ax-architecture.md`](./docs/architecture/shift-ax-architecture.md)
- LLM setup details: [`docs/setup/llm-install-and-bootstrap.md`](./docs/setup/llm-install-and-bootstrap.md)
- Operator guide: [`docs/operations/operator-guide.md`](./docs/operations/operator-guide.md)
- Release notes: [`docs/release-notes/`](./docs/release-notes/)
