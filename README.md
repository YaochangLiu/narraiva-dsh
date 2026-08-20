# Narraiva DSH

Narraiva DSH is an open-source, local-first long-form fiction writing profile for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It uses the author's own DeepSeek API key and does not connect to Narraiva Cloud APIs.

## Phase 0 Browser Client Spike

The current Spike proves a small but intentional boundary:

- a separate Narraiva DSH profile/bundle;
- local `Narraiva Ask` and `Narraiva Write` agent presets;
- an author-control prompt policy;
- no shell, generic filesystem, or direct manuscript-write tool in the writer preset.
- a DSH Browser Client that visibly replaces the product workbench with Narraiva's light three-column writing shell.

The workbench is a safe UI and runtime Spike: it does **not** yet include real project persistence, manuscript reading/writing, Monaco, a model conversation surface, Diff review, Storybase, Stylebase, or a production installer. The model can temporarily support long-form creative work through DSH after the user configures a key, but Write output remains prose-only until the Proposal/Diff slice exists.

### Modes

Create a fresh DSH conversation and select its agent preset:

- `Narraiva Ask` — questions, analysis, story diagnosis, and clarification. It does not generate ready-to-apply manuscript prose.
- `Narraiva Write` — creates one reviewable Proposal with intent, scope, rationale, and proposed text. It never applies or saves that text.

The selected DSH preset is attached to the session. The Phase 0 workbench's `思考` / `写作` controls are visual interaction previews only; session-preset binding lands with the real conversation adapter.

## Local development

Prerequisites:

- Node.js 24 or later;
- a built DeepSeek Harness source checkout. In this workspace it is `../_tools/deepseek-harness`;
- a user-configured `DEEPSEEK_API_KEY` in DeepSeek Harness. Never put a key in this repository.

```powershell
cd D:\entertiment\katera\narraiva-dsh
pnpm test
pnpm run bootstrap
pnpm run verify:profile
pnpm run start:spike
```

The first run adds this local package to the Harness profile `narraiva-web` and opens the Web surface at `http://127.0.0.1:3081`.

To use a different Harness checkout, set `DSH_SOURCE` before starting. To use a different Harness home, set `DSH_HOME` before bootstrapping. If the shell that runs pnpm does not select Node 24+, set `DSH_NODE` to its Node 24+ executable.
The bootstrap command adds missing presets and preserves locally edited ones; use `pnpm run bootstrap -- --force` only when deliberately replacing them. The starter disables DSH telemetry by default for this local Spike.

## Data boundary

Projects, sessions, and the DeepSeek credential are local to the user's Harness environment. Narraiva does not receive the API key, manuscript, Storybase, conversation, or telemetry. Text sent to a model is sent directly to the user's configured DeepSeek service.

## Planned slices

1. Local project workbench: direct portable Desktop component migration, project picker, chapter tree, editor, and local persistence.
2. Ask conversation adapter: DSH session/preset binding, BYOK model conversation, explicit context manifest.
3. Proposal/Diff: Write review, accept/reject, local revision history.
4. Storybase Lite: candidate-first facts, evidence, canonical confirmation, bounded retrieval.
5. Optional local retrieval and Stylebase experiments.

## License

The repository is intended to be public and open source. The final code license and Narraiva trademark policy must be chosen before the first public release.
