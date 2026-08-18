# Narraiva DSH

Narraiva DSH is an open-source, local-first long-form fiction writing profile for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It uses the author's own DeepSeek API key and does not connect to Narraiva Cloud APIs.

## Foundation Spike

The current Spike proves a small but intentional boundary:

- a separate Narraiva DSH profile/bundle;
- a local `Narraiva 创作模式` agent preset;
- an author-control prompt policy;
- no shell, generic filesystem, or direct manuscript-write tool in the writer preset.

It does **not** yet include the Narraiva writing workbench, project persistence, Diff review, Storybase, Stylebase, or a production installer. The model can temporarily support long-form creative work in the DSH chat surface, but Draft output remains prose-only until the Proposal/Diff slice exists.

## Local development

Prerequisites:

- Node.js 24 or later;
- a built DeepSeek Harness source checkout. In this workspace it is `../_tools/deepseek-harness`;
- a user-configured `DEEPSEEK_API_KEY` in DeepSeek Harness. Never put a key in this repository.

```powershell
cd D:\entertiment\katera\narraiva-dsh
npm test
npm run bootstrap
npm run start:spike
```

The first run adds this local package to the Harness profile `narraiva-web` and opens the Web surface at `http://127.0.0.1:3081`.

To use a different Harness checkout, set `DSH_SOURCE` before starting. To use a different Harness home, set `DSH_HOME` before bootstrapping.

## Data boundary

Projects, sessions, and the DeepSeek credential are local to the user's Harness environment. Narraiva does not receive the API key, manuscript, Storybase, conversation, or telemetry. Text sent to a model is sent directly to the user's configured DeepSeek service.

## Planned slices

1. Narraiva root UI: project picker, chapter tree, editor, assistant dock.
2. Proposal/Diff: Think/Draft, review, accept/reject, local revision history.
3. Storybase Lite: candidate-first facts, evidence, canonical confirmation, bounded retrieval.
4. Optional local retrieval and Stylebase experiments.

## License

The repository is intended to be public and open source. The final code license and Narraiva trademark policy must be chosen before the first public release.
