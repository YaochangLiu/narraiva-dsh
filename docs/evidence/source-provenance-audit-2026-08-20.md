# Source provenance audit — 2026-08-20

## Scope

This audit covers the files shipped in the `@narraiva/dsh` Public Alpha tarball. It is a release record, not legal advice.

## Narraiva implementation

The source and tests in this repository were authored for the Narraiva DSH project under the repository owner’s direction. Product behavior was mapped from `NovelOS-alpha/apps/novelos-desktop/src/renderer/src/components/sidebar/ProjectNavigator.tsx`, `components/editor/ManuscriptEditor.tsx`, `components/assistant/AIPanel.tsx`, and `components/layout/AppShell.tsx` into the independently authored `src/client/index.cjs` and its DSH/browser domain adapters. Repository search confirms the shipped `nv-*` UI selectors, DSH protocol markers, browser handle persistence, Proposal modules, and tests are not present in the Desktop source tree.

No Desktop React or Electron source file is copied into the Public Alpha tarball. No Electron bridge, Narraiva Cloud client, account implementation, proprietary Storybase/Stylebase engine, logo binary, font file, or manuscript fixture from the Desktop repository is included in the npm package.

The repository owner selected MIT for the Public Alpha source. Contributors are told in `CONTRIBUTING.md` that accepted contributions use the same license. Narraiva names and product identity remain outside the code license under `TRADEMARKS.md`.

## External implementation

The package declares `@deepseek-ai/dsh` as a peer dependency and composes its public plugin interfaces. DeepSeek Harness code is not copied into this repository or bundled into the Narraiva tarball. DSH and its dependency notices remain independently distributed; `THIRD_PARTY_NOTICES.md` records that relationship and disclaims endorsement.

The Browser Client receives React from the DSH runtime rather than bundling React. No other runtime dependency is included in the Narraiva tarball.

## Publication check

Before each registry release, review the `npm pack --dry-run` manifest for newly introduced binary assets, copied source, dependencies, or notices. Any future direct migration from another repository must record its source path, owner/license, material changes, and whether it may be redistributed before publication.
