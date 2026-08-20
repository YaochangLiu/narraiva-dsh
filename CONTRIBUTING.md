# Contributing to Narraiva DSH

Thank you for helping build a local-first writing environment on DeepSeek Harness. Start with an issue before substantial product or architecture work. Small documentation, test, localization, and accessibility fixes may go directly to a pull request.

## Development

Use Node.js 24+, pnpm 11, and a compatible `@deepseek-ai/dsh` developer-preview release. Run `pnpm install`, `pnpm test`, `pnpm run verify:profile`, and `npm pack --dry-run` before requesting review. Never commit a DeepSeek API key, manuscript, `.env`, DSH home, or generated user project.

Preserve the product boundary: DSH owns model configuration, sessions, transport, and the native agent loop; Narraiva owns writing-domain state, visible context selection, Proposal review, and safe local persistence. Ask must remain read-only. Write may propose changes but must not bypass Proposal/Change Set review. Full Access is not implemented.

Use focused commits and add tests at the nearest contract seam. A pull request should explain behavior, safety/data-boundary impact, validation performed, and screenshots for visible UI changes. By contributing, you agree that your contribution is licensed under the repository’s MIT license and that Narraiva trademarks remain governed by `TRADEMARKS.md`.
