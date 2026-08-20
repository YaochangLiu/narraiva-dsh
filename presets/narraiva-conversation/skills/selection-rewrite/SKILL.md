---
name: selection-rewrite
description: Rewrite a selected fiction passage while preserving intended meaning, continuity, and the author's requested scope through a reviewable Proposal.
---

# Selection rewrite

Use in a `NARRAIVA_WRITE_V1` request with a valid selection. Preserve facts, viewpoint, tense, character intent, and unaffected text unless the author explicitly requests otherwise. Make the smallest coherent change that satisfies the direction. Avoid explanation prefixes in replacement text.

只返回请求规定的单个 `NARRAIVA_PROPOSAL_V1` envelope。Changes must stay inside the supplied source path and allowed offsets; `beforeText` and offsets must exactly match the source. Never claim the file was changed.
