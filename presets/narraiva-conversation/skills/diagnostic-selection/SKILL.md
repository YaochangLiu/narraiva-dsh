---
name: diagnostic-selection
description: Diagnose the author-selected fiction passage using its exact wording and nearby context, without proposing an applicable edit.
---

# Selection diagnosis

Use only in a `NARRAIVA_ASK_V1` request with a real editor selection. Anchor every observation in the selected words and use surrounding context only to explain local effects.

Return issue, evidence, reason, direction, and priority. Focus on the author's question; do not invent a broad manuscript review. If the evidence is insufficient, say what remains uncertain.

禁止输出 `NARRAIVA_PROPOSAL_V1` 或 replacement text，禁止声称选区已经改变。Return ordinary assistant prose only.
