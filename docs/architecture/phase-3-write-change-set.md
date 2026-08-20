# Phase 3 — Write and Change Set

## Product boundary

DeepSeek Write can only return a `NARRAIVA_PROPOSAL_V1` JSON envelope. It has no filesystem or shell tools. Narraiva validates paths, exact `beforeText`, offsets, overlap, and the source disk revision before showing a reviewable Proposal. No file changes until the author accepts.

## Flow

1. The author explicitly selects Write and sends the current chapter or a real editor selection.
2. A separate DSH session is bound fail-closed to `narraiva-writer`.
3. The Browser Client parses and validates the structured Proposal.
4. The editor presents old/new text and the assistant presents per-change rejection plus whole-Proposal actions.
5. Accept creates a local Change Set and writes only the explicitly supplied document after revision verification.
6. Undo succeeds only if the applied output is still the current disk content and revision.

Pending review state, handled Proposal identities, and the latest rollback-capable Change Set are stored in `narraiva.json`, so refresh cannot resurrect a rejected Proposal or silently discard the latest undo record.

## Deliberate exclusions

No project scan, RAG, Storybase, Stylebase, Narraiva Cloud, generic filesystem tools, shell, Full Access, or silent application. Controlled retrieval is Phase 4.
