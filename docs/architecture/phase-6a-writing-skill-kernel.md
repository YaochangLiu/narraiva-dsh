# Phase 6A — Writing Skill Kernel

## Goal

Upgrade Narraiva DSH from a safe general writing conversation into a fiction-writing Harness with deterministic task routing and DSH-native, on-demand writing skills.

## Contract seams

1. `routeWritingSkills()` is the public routing seam. It returns the selected intent, skills, reason, context scope, and output contract from the visible request state.
2. Ask/Write prompt builders are the model-protocol seam. They carry the route receipt and explicitly invoke the selected DSH skills; Ask remains prose-only and Write remains `NARRAIVA_PROPOSAL_V1`-only.
3. Profile composition is the authority seam. The unified preset exposes only DSH's native `skill` loader and bundled Narraiva skills while shell, filesystem, search, and direct-edit tools remain disabled.

## Scope

- Ship ten Narraiva fiction-method skills derived from the current Narraiva Desktop product vocabulary.
- Route chapter/selection diagnosis, ordinary response, revision explanation, selection rewrite, short rewrite, AI-flavor reduction, cursor continuation, active-Proposal refinement, and second-direction writing.
- Show the selected skill, routing reason, context scope, and output contract before sending.
- Keep one DSH Conversation for Ask and Write.
- Keep project retrieval author-selected and read-only.

## Non-goals

- No Storybase, Stylebase, cloud service, Full Access, multi-file Proposal, shell, filesystem tool, or direct model write access.
- No claim that deterministic routing alone proves literary quality; Phase 6B owns comparative evaluation.

## Acceptance

- All ten bundled skills are discoverable through the unified preset and load through DSH's native skill mechanism.
- Ask routes never request a Proposal. Write routes always retain the existing Proposal-only protocol.
- A route receipt is visible in the UI and encoded in request metadata/history.
- Existing Proposal validation, review, conflict, rollback, and retrieval tests remain green.
- Profile verification proves `skill-filesystem` and `tool-skill` are enabled while dangerous tools remain disabled.
