# Phase 2 real Ask evidence — 2026-08-20

## Environment

- DSH profile: `narraiva-phase0` (local development profile name retained from the spike)
- URL: `http://127.0.0.1:3082/`
- Browser: Chrome through the connected browser extension
- Agent preset observed in DSH: `Narraiva Ask`
- Provider/model credentials: owned by DSH and not inspected or recorded

## Flow exercised

1. Reloaded the rebuilt Narraiva Browser Client.
2. Restored the previously authorized Phase 1 project directory.
3. Confirmed the active document was `manuscript/chapter-3.md` with the minimal content `# Chapter 3`.
4. Sent `请用一句话说明当前章节标题。` from the Narraiva Ask composer.
5. DSH accepted the `NARRAIVA_ASK_V1` request under the `Narraiva Ask` preset.
6. A real DeepSeek response streamed and finalized in both the DSH durable session and Narraiva projection.
7. Reloaded, restored the project, and confirmed the answer plus its context receipt were recovered.

## Observed result

The answer correctly identified `Chapter 3` as the current title and did not claim a manuscript modification. Narraiva displayed the user question rather than its transport envelope and showed this historical receipt:

```text
当前章节 | manuscript/chapter-3.md | 13 字符 | revision <local metadata>
```

The manuscript remained unchanged. No credential or complete private manuscript content was captured in this evidence.

