# Public Alpha release checklist

## Automated gate

- `pnpm install --frozen-lockfile`
- `pnpm test`
- `pnpm run verify:profile` against the declared DSH compatibility floor
- `npm pack --dry-run` contains runtime, presets, license, privacy, trademark, and notices
- `narraiva-dsh doctor` passes on Node 24 and compatible DSH
- Source provenance audit covers every shipped code and asset family

## Clean Windows journey

- Install packages without a Katera workspace or DSH source checkout.
- Start the Narraiva profile and open the Web UI.
- Configure a redacted test DeepSeek credential in DSH.
- Create/open a project, edit, autosave, and reopen.
- Ask and Write in one conversation; inspect, reject, accept, and undo a Proposal.
- Confirm retrieval starts enabled, inspect/remove evidence, disable/re-enable it, send, and verify stale evidence blocks.
- Restart, confirm project/review/history recovery, and confirm no Narraiva Cloud traffic.

Automated success does not substitute for this human journey. Record the tested package tarball hash, DSH version, Node version, browser, Windows version, and any skipped model-provider evidence before creating a GitHub prerelease.
