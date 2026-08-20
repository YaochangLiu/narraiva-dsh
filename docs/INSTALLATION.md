# Public Alpha installation

## Supported environment

- Windows 10 or 11
- Node.js 24 or newer
- `@deepseek-ai/dsh` versions `0.1.0-rc.7` through the `0.1.x` developer-preview line
- Chrome or Edge with File System Access API support

DeepSeek Harness is evolving quickly. Narraiva DSH has been verified against `0.1.0-rc.7`; later `0.1.x` versions are accepted as a declared compatibility line but should be revalidated after upgrades. Unknown major/minor lines fail closed.

## Install from npm

```powershell
npm install -g @deepseek-ai/dsh @narraiva/dsh
narraiva-dsh doctor
narraiva-dsh install
narraiva-dsh start
```

`install` creates or updates the local `narraiva` DSH profile. `start` installs the current package into that profile, composes the official DSH base and Web bundles before Narraiva, disables telemetry by default, and starts the local Web surface at `http://127.0.0.1:3081`.

Use another profile or port with `--profile my-profile` and `--port 3090`. The project and credential remain in the user’s local DSH environment.

## Configure DeepSeek

Open the DSH model settings and add your own DeepSeek API key. The key belongs to DSH and must never be placed in this repository, a Narraiva project, an issue, or a screenshot. Narraiva only receives DSH conversation services, not the credential.

## Contributor source mode

Clone this repository, run `pnpm install`, and set `DSH_SOURCE` to a built DeepSeek Harness checkout when testing unreleased DSH changes. Then run `pnpm run bootstrap`, `pnpm run verify:profile`, and `pnpm run start:spike`. This is a development fallback, not a requirement for ordinary users.

## Troubleshooting

- `doctor` reports Node failure: install Node.js 24+ and reopen the terminal.
- DSH missing: install both global packages in the same npm prefix.
- DSH compatibility failure: install a supported `0.1.x` preview or wait for a Narraiva compatibility update.
- Port occupied: pass another `--port`.
- Project picker unavailable: use current Chrome/Edge and serve over localhost.
- Model request rejected: verify the provider and API key in DSH settings; do not send the key to Narraiva maintainers.
