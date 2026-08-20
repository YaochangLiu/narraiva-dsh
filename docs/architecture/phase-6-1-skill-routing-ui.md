# Phase 6.1 — Skill Routing & UI Refinement

## Goal

Make Narraiva's writing method selection accurate, understandable, and author-adjustable without exposing DSH internals or weakening Ask/Write authority.

## Product contract

- Automatic routing remains the default.
- The author may override the method for the next request from a context-valid list; an invalid or stale override falls back to automatic routing rather than widening context or authority.
- Compound methods remain deterministic: AI-flavor reduction includes the appropriate selection rewrite method; second-direction writing includes cursor continuation.
- The visible receipt states method, automatic/manual source, reason, context actually sent, and output boundary.
- Historical user turns render their persisted receipt, not a route recomputed from current editor state.
- `@选中文本` remains the explicit authorization gesture for selection content.

## Routing rules

Ask supports ordinary discussion, chapter diagnosis, selection diagnosis, and Proposal/Change Set explanation. Write supports short/long selection rewrite, AI-flavor reduction, cursor continuation, second-direction writing, and active Proposal refinement. Context prerequisites determine which manual choices are offered.

Broad conversational uses of words such as “问题” must not accidentally select chapter diagnosis. Diagnostics require an explicit review/analysis intent. Manual choices cannot switch Ask to Proposal output or Write to prose output.

## UI

The compact method card sits between context chips and retrieval evidence. It exposes an accessible method selector and a details disclosure. The summary remains usable in the narrow assistant column and shows the effective method before send. Details show the routing reason, context scope, output contract, and whether selection text is authorized.

## Contract seams

1. `routeWritingSkills()` and `availableWritingSkillOptions()` define routing and manual-choice behavior.
2. Ask/Write prompt metadata persists the complete effective route receipt.
3. Browser Client source/bundle contracts require the accessible method selector, compact receipt, and historical automatic/manual label.

## Non-goals

- No Storybase, Stylebase, semantic RAG, new filesystem authority, multi-file Proposal, or Full Access.
- No literary-quality claim; Phase 6B remains responsible for comparative evaluation.

## Acceptance

- Context-valid manual method choices work and stale choices fail safe.
- Automatic routing avoids documented false positives and preserves compound methods.
- UI and history display the same persisted route receipt sent to DSH.
- Ask stays read-only; Write stays Proposal-only and within the existing source range.
- Full tests, profile verification, package dry-run, and two-axis review pass.
