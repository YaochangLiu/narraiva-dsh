# Narraiva DSH

Narraiva DSH is an open-source, local-first long-form fiction workspace built on the official plugin interfaces of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It is an independent community project and is not endorsed by DeepSeek AI. Authors bring their own DeepSeek API key. Narraiva does not connect to Narraiva Cloud.

> Public Alpha: the writing safety model is implemented and tested, while DeepSeek Harness itself remains in developer preview and may introduce compatibility changes.

## What works

- A Narraiva-owned three-column writing UI inside the DSH Web surface.
- Local project and chapter creation, editing, autosave, conflict detection, and restart recovery.
- One continuous DSH conversation with **Ask** and **Write** behavior modes.
- Ask with explicit current-document or selection context.
- Write as a reviewable Proposal with inline Patch, accept/reject, Change Set, and undo.
- Optional controlled project retrieval over author-granted `.md`, `.markdown`, and `.txt` files.
- Ten fiction-writing methods selected transparently, adjustable for the next request from a context-safe list, and loaded through DSH's native Skill mechanism.
- DeepSeek BYOK through DSH; no Narraiva account or cloud API.

Skills never receive filesystem authority, and Write still passes through Proposal, Patch, and explicit author acceptance. Full Access, Storybase, and Stylebase are intentionally not part of this alpha.

## Install

Requirements: Windows 10/11, Node.js 24+, Chrome or Edge, and a DeepSeek API key configured in DSH.

```powershell
npm install -g @deepseek-ai/dsh @narraiva/dsh
narraiva-dsh doctor
narraiva-dsh start
```

Open `http://127.0.0.1:3081`. See [installation and troubleshooting](docs/INSTALLATION.md) for profiles, ports, source-checkout development, and compatibility.

## Product boundary

DSH owns model/provider configuration, the API key, sessions, transport, streaming, cancellation, and the native agent loop. Narraiva owns the writing UI, local project model, visible context receipts, and author-reviewed changes. Ask cannot write. Write cannot apply anything without author approval.

Read [architecture](docs/ARCHITECTURE.md), [data boundary](docs/DATA-BOUNDARY.md), and the [roadmap](docs/ROADMAP.md).

## Contributing

Issues and pull requests are welcome for reproducible bugs, documentation, tests, accessibility, localization, DSH compatibility, and scoped product improvements. Read [CONTRIBUTING.md](CONTRIBUTING.md) before substantial work. Never attach private manuscripts or API keys.

## License and marks

Code is available under the [MIT License](LICENSE). The Narraiva name and brand are governed separately by the [trademark policy](TRADEMARKS.md). See [privacy](PRIVACY.md), [security](SECURITY.md), and [third-party notices](THIRD_PARTY_NOTICES.md).
