# Phase 2: Narraiva Ask vertical slice

## Goal

Phase 2 provides one complete read-only Ask path: a user configures their own DeepSeek credential in DSH, chooses visible manuscript context in Narraiva, sends through the official DSH Session runtime, and receives a streamed answer in the Narraiva assistant UI. Narraiva never reads the credential and never connects to a Narraiva service.

## Confirmed product defaults

- Ask is the default mode.
- The active chapter is included by default and can be removed before sending.
- `@选中文本` is valid only when the editor reports a real current selection.
- Conversations belong to the project rather than one chapter; every user message retains a context receipt.
- Ask may show example prose in chat but cannot create an applicable Proposal or write files.
- Write remains a visible Phase 3 preview and cannot send in Phase 2.

## DSH boundary

`NarraivaConversationAdapter` consumes the official Browser Runtime faces:

- `sessions.create/open/binding` for project conversations;
- `SessionFace.prompt()` for admission;
- the `SessionFace` observable snapshot for durable history and streaming partials;
- `SessionFace.cancel()` and `loadOlder()` for control;
- `agentPresets.select` for binding a blank session to `narraiva-ask`.

No direct model HTTP request exists in the plugin. DSH owns provider credentials, provider selection, transport, durable logs, and history.

## Context contract

Phase 2 supports the active chapter, a real editor selection, or no manuscript context. Storybase, outline, Stylebase, full-project scan, and retrieval remain unavailable.

Every request contains a `NARRAIVA_ASK_V1` envelope with:

1. the read-only and honesty policy;
2. a visible context manifest (label, relative path, character count, exact content-snapshot revision, and source disk revision when available);
3. only the selected text block;
4. the cleaned user question.

The Narraiva transcript projects the durable DSH log back into user/assistant messages and hides this transport envelope. Historical user messages show a compact context receipt.

## UI and recovery

The assistant panel migrates the Desktop responsibility: conversation/history tabs, project conversation selector, new conversation, DSH connection state, streamed messages, context chips, composer, stop, retry, mode control, and the privacy statement. Conversation IDs are stored as lightweight references in `narraiva.json`; DSH remains the message-history authority.

## Acceptance evidence

- Pure tests cover context selection, prompt construction, unsupported mentions, snapshot projection, preset selection, admission, cancel, and error mapping.
- The full repository suite and profile-composition verification pass.
- Chrome restores a real Phase 1 project, creates/opens a `narraiva-ask` DSH session, sends the active chapter through DSH, and renders a real streamed DeepSeek answer.
- The test request uses only a minimal local chapter and records no credential.
- The manuscript remains unchanged.
