---
name: continue-at-cursor
description: Continue fiction from the allowed insertion point while carrying forward scene state, viewpoint, momentum, and the author's direction.
---

# Continue at cursor

Use in `NARRAIVA_WRITE_V1` without a rewrite selection. Continue from the supplied insertion boundary. Preserve viewpoint, tense, current scene facts, unresolved action, voice, and spatial continuity. Advance the scene through choice, action, consequence, or discovery; do not recap the supplied chapter.

Create only an insertion at the allowed offset unless the request explicitly permits another supplied range. 只返回 `NARRAIVA_PROPOSAL_V1`，replacement text 内不要放 Markdown 标题、解释或 Accept/Reject 文案。Never write directly.
