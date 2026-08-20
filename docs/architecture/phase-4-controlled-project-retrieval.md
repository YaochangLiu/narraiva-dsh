# Phase 4 — Controlled Project Retrieval

## Goal

Ask and Write can retrieve evidence from the author-granted Narraiva project. Retrieval is enabled by default after directory authorization, author-disableable, read-only, project-root bounded, visible before sending, and represented in the request Context Receipt.

## Boundary

- Index only `.md`, `.markdown`, and `.txt` files under the granted browser directory handle.
- Ignore hidden entries, `node_modules`, `.git`, generated metadata, files over 512 KiB, and projects over 200 text files.
- Chunk deterministically by Markdown headings and bounded paragraphs; no embeddings or cloud index.
- Rank locally with lexical term frequency and document-frequency weighting.
- Return at most five chunks and 12,000 characters. Exact text is sent once in an encoded evidence payload; the receipt carries project-relative path, heading, line range, revision, score, character count, and content hash so DSH history remains auditable without duplicating the payload.
- Retrieval indexes and matches locally by default after the author grants the project directory. The author can disable retrieval or remove any proposed chunk before sending.
- Ask and Write use the same selected evidence. Write remains Proposal-only and can modify only its explicit source document.
- No Narraiva Cloud request, API key access, shell, generic filesystem write, or project-external path.

## DSH native tool decision

DSH `tool-fs-search` remains the preferred future agent-loop search implementation, but it requires a Host workspace `cwd`. The current Narraiva project is a browser `FileSystemDirectoryHandle`, which intentionally exposes no absolute path. Phase 4 therefore performs deterministic retrieval inside the granted browser capability and sends the visible selected evidence through the normal DSH prompt. Enabling the native DSH search tool is blocked until a formal DSH workspace bridge can prove that the Host workspace and browser-granted root are the same canonical directory.

## Acceptance

- Default requests show any matched project evidence before sending; no preview action sends content by itself.
- Disabling retrieval restores current-document-only requests and survives project reopen.
- Removing a result excludes its text and receipt from the request.
- Indexing and search cannot escape the granted root or include disallowed entries.
- The request metadata and visible message receipt enumerate every retrieved chunk actually sent.
- Index/read failures are visible and do not silently broaden the request.
- Retrieval settings survive project reopen, but cached manuscript text does not persist outside the project files.
