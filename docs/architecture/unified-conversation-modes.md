# Unified Conversation Modes

## Product decision

Ask and Write are interaction modes inside one Narraiva conversation. They are not separate conversation histories. A project conversation owns one DSH session ID; mode selection changes the request protocol and response projection only.

## DSH boundary

- New sessions bind fail-closed to `narraiva-conversation`.
- `[NARRAIVA_ASK_V1]` requests produce discussion and analysis without Proposals.
- `[NARRAIVA_WRITE_V1]` requests produce a review-only `NARRAIVA_PROPOSAL_V1` envelope.
- The unified preset has no filesystem or shell tools. Accepting a Proposal remains an explicit local Narraiva action.
- Protocol projection is inferred per turn from the user request marker, so historical Ask prose and Write envelopes render correctly after later mode switches.

## Legacy migration

Projects created before this change may contain `conversation.activeId` for Ask and `conversation.writeId` for Write. On open, both IDs are retained in the project conversation references, `writeId` is removed, and a fresh unified session is created because DSH cannot safely replace a preset after a session has history. Legacy sessions remain DSH-owned historical data but are not offered as writable unified conversations.

## Acceptance

- Switching Ask and Write does not change the active DSH session ID.
- Creating or selecting a conversation works in both modes.
- Ask and Write messages appear in one ordered history.
- Write protocol envelopes never render as chat prose; Ask examples remain ordinary prose.
- Existing split-session projects migrate without deleting either legacy session reference.
