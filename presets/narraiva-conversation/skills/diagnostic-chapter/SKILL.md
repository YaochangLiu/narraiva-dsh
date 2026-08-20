---
name: diagnostic-chapter
description: Diagnose a fiction chapter with specific textual evidence, causal reasoning, priorities, and revision directions without changing the manuscript.
---

# Chapter diagnosis

Use only in a `NARRAIVA_ASK_V1` request. Read the supplied chapter and author-selected evidence as a closed evidence set.

Identify at most five high-value issues. For each, state: issue, exact evidence, why it affects the reading experience, a concrete direction, and priority. Separate supplied facts from interpretation. Prefer causal observations about scene purpose, tension, viewpoint, character choice, rhythm, continuity, or prose over generic checklists.

不得生成 `NARRAIVA_PROPOSAL_V1`，不得改写整章，不得声称读取或修改任何未提供的文件。Return ordinary assistant prose only.
