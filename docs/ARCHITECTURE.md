# Architecture

Narraiva DSH is a plugin bundle and Browser Client, not a fork of DeepSeek Harness.

```text
DSH Runtime
    ↓ sessions, model transport, streaming, native agent loop and skill loader
Narraiva Adapter
    ↓ stable conversation, deterministic task route and local-directory capabilities
Narraiva Domain
    ↓ project, Skill Receipt, context receipt, Proposal, Patch, Change Set
Narraiva UI
    ↓ author-visible editing and approval
Local project files
```

The Host bundle contributes author-control policy and a unified preset. The Browser Client takes the DSH overlay slot and renders the Narraiva workbench. Adapters translate DSH snapshots into product messages and browser directory handles into bounded project operations. Domain modules validate paths, revisions, Proposal offsets, review lifecycle, and retrieval receipts independently of React.

Ask and Write are request protocols within one DSH Conversation. Ask is read-only. Write returns a structured Proposal; Narraiva validates it against the exact source snapshot before showing a Patch. Only an explicit author action creates a Change Set and writes the manuscript.

The unified preset bundles ten method-only fiction skills and mounts DeepSeek Harness's native `skill-filesystem` and `tool-skill` components. The Browser Client deterministically selects a route from the current mode, request, selection, and pending Proposal, shows that receipt before send, and emits DSH's whitespace-bounded `/skill-name` user gesture. DSH `0.1.0-rc.7` resolves that gesture during `agent/pre-step` and injects the selected Skill instructions before model generation. Skills do not grant filesystem authority. Shell, filesystem, search, and direct-edit tools remain disabled; every Write skill is subordinate to the existing Proposal protocol.

Controlled retrieval currently runs inside the browser-granted directory because a browser handle does not reveal a canonical Host path. DSH native filesystem search remains the preferred future implementation once a workspace bridge can prove that the Browser root and Host `cwd` identify the same directory.
