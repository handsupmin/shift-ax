# Shift AX Workflow Skill Contract

This document defines the standard contract for every Shift AX workflow skill.

## Required sections

Every workflow skill must define:

- trigger / when to use
- process steps
- anti-rationalization guidance
- verification requirements
- exit criteria

## Clarify

- always consult the base-context index first
- reduce ambiguity through direct questioning
- surface assumptions explicitly
- stop only when the request is specific enough to plan

## Plan

- turn clarified intent into a spec and implementation plan
- keep task slices small, ordered, and testable
- preserve out-of-scope boundaries
- require a human plan-review gate before execution

## Implement

- follow engineering defaults from the project profile
- use subagent for short bounded slices
- use tmux for long-running or cross-cutting slices
- keep execution evidence file-backed

## Review

- verify domain/policy alignment
- verify spec conformance
- verify tests cover the agreed behavior
- verify engineering-method discipline
- verify conversation-trace and execution-result alignment

## Finalize

- only finalize after review gates pass
- preserve Lore commit protocol requirements
- record final verification evidence and commit state

## Anti-rationalization

Shift AX workflows must explicitly block common shortcuts such as:

- skipping the base-context index
- guessing through ambiguity
- starting implementation before plan review
- weakening healthy tests instead of fixing logic
- treating memory or prior transcripts as higher priority than authoritative docs

## Verification

Every workflow skill must state:

- which files/artifacts prove the stage is complete
- which commands provide verification evidence
- which failures should block continuation

## Base-context priority

The base-context index and linked markdown documents remain the primary source of truth.
Any memory-assist or prior-topic recall system must sit below them.
