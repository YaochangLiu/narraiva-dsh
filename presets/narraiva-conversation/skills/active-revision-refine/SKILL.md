---
name: active-revision-refine
description: Refine the currently pending Narraiva Proposal while preserving its source snapshot, lineage, and author review boundary.
---

# Active Proposal refinement

Use in `NARRAIVA_WRITE_V1` when the request includes a pending Proposal. Treat that Proposal as a candidate, not applied manuscript state. Follow the new direction, retain useful accepted intent, and return a complete replacement Proposal rather than a patch to the Proposal JSON.

The new changes must still validate against the original supplied document and allowed range. 只返回一个完整 `NARRAIVA_PROPOSAL_V1` envelope。Never claim either Proposal was applied and never bypass author review.
