# Phase 3.1 — Proposal Review UI

Phase 3.1 separates machine protocol from author-facing transcript and makes Patch review happen in full manuscript context.

## Acceptance

- `NARRAIVA_PROPOSAL_V1` envelopes never render as ordinary assistant prose.
- Pending, accepted, rejected, conflicted, and rolled-back states use one Proposal/Change Set lifecycle surface.
- The editor review surface preserves the complete document and places each pending change at its exact source offset.
- Proposal cards locate the matching editor change and expose per-change rejection plus whole-Proposal decisions.
- Long content cannot create horizontal page or chat scroll traps.
- Ask remains unchanged; write/apply/undo safety semantics from Phase 3 remain unchanged.

The current DSH Browser Client does not ship a rich editor runtime. Phase 3.1 therefore introduces a renderer-independent Patch View Model and a contextual review surface. A later CodeMirror/Monaco adapter can consume the same view model without changing Proposal or Change Set semantics.
