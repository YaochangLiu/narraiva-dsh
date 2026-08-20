---
name: short-selection-rewrite
description: Precisely rewrite a short selected passage with compact, meaning-preserving language and minimal collateral change.
---

# Short selection rewrite

Use in a `NARRAIVA_WRITE_V1` request for a short valid selection. Retain the passage's semantic job and nearby cadence. Prefer one focused replacement over expanding the scene. Do not introduce new world facts merely to decorate the line.

只返回一个 `NARRAIVA_PROPOSAL_V1` envelope，不得附加解释。The change must remain inside the supplied selection and exactly match its `beforeText`; never apply it directly.
