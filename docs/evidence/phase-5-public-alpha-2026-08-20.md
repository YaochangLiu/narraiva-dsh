# Phase 5 Public Alpha validation — 2026-08-20

## Implemented

- `@narraiva/dsh` versioned as `0.1.0-alpha.1`, publishable under MIT with a separate Narraiva trademark policy.
- Public `narraiva-dsh` doctor/install/start CLI with Node, DSH version, profile-name, and port validation.
- Portable DSH package dependency with optional `DSH_SOURCE` contributor override.
- Privacy, security, contribution, conduct, third-party, installation, architecture, data-boundary, and release-checklist documentation.
- Windows CI plus issue and pull-request templates.

## Automated and package evidence

- The full repository suite and profile composition are required before the release commit.
- `npm pack` created `narraiva-dsh-0.1.0-alpha.1.tgz`; the tarball manifest included runtime source, built Browser Client, presets, CLI, license, privacy, security, trademark, notices, and public installation/architecture documents.
- An isolated `.tmp/phase5-clean-install` project installed the tarball and `@deepseek-ai/dsh@0.1.0-rc.7` without relying on a DSH source checkout.
- Under Node `24.19.0`, the installed CLI doctor passed and created a fresh isolated `narraiva-clean` profile.
- `--dump-config` confirmed `@deepseek-ai/dsh-web-app`, `@narraiva/dsh`, and `default: narraiva-conversation` in that isolated profile.

## Evidence boundary

This record proves packaging, isolated dependency installation, CLI diagnosis, plugin installation, and assembled profile configuration. It does not prove an npm registry publication, a GitHub prerelease, a clean external Windows machine, browser interaction, or a real DeepSeek BYOK model turn. Those human/release steps remain explicit gates in `docs/PUBLIC-ALPHA-CHECKLIST.md`.
