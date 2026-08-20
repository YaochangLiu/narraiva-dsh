# Phase 1: Local project workbench

## Product boundary

Phase 1 turns the Phase 0 presentation shell into a real local manuscript workbench. It does not send prompts, call a model, store credentials, or connect to Narraiva services. Ask remains the default mode; Write remains visible but its DSH Agent transport is Phase 2.

## Local project format

```text
narraiva.json
manuscript/
  chapter_001.md
```

`narraiva.json` is versioned and owns project name, stable document IDs, display order, active document, and relative Markdown paths. Absolute paths, parent traversal, empty segments, and non-Markdown document paths are rejected before any file-system call.

## Browser file boundary

The Browser Client uses the File System Access API on localhost. The user explicitly grants one directory handle; the adapter can only traverse descendants of that handle. Chrome and Edge are the supported Phase 1 browsers.

The last directory handle is stored in IndexedDB. On restart Narraiva offers recovery and asks for read/write permission again when needed. File contents are never stored in IndexedDB.

## Save and conflict contract

- Content becomes dirty immediately and saves after 700 ms of inactivity.
- Reads record a metadata revision (`lastModified:size`); writes compare it again first.
- A changed revision raises `WRITE_CONFLICT` and preserves the disk file.
- `createWritable()` is the browser transactional write boundary; failure raises `WRITE_FAILED`.
- Creating a project refuses to replace an existing `narraiva.json`.

## Desktop reuse boundary

Phase 1 migrates the Desktop workbench composition, warm-light tokens, title bar language, project navigator hierarchy, manuscript status language, and assistant placement. Electron IPC, Zustand stores, Monaco patch views, runtime/cloud clients, Storybase, and Stylebase are intentionally not copied.

## Acceptance

- Create and reopen a real local project.
- Add, rename, reorder, select, and delete chapters.
- Edit Markdown with line numbers and dirty/saving/saved state.
- Recover the last project after refresh/restart.
- Reject corrupt manifests, traversal, existing-project overwrite, failed writes, and external-change overwrite.
- Build as a DSH Browser Client without credentials or remote endpoints.

