import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dshSource = process.env.DSH_SOURCE ?? path.resolve(repositoryRoot, '..', '_tools', 'deepseek-harness')
const dshBin = path.join(dshSource, 'apps', 'cli', 'lib', 'bin.js')

if (!existsSync(dshBin)) {
  throw new Error('Set DSH_SOURCE to a built DeepSeek Harness checkout with apps/cli/lib/bin.js.')
}

function run(argumentsList) {
  const result = spawnSync(process.execPath, [dshBin, ...argumentsList], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run(['plugin', '--profile', 'narraiva-web', 'add', repositoryRoot])

const dshHome = process.env.DSH_HOME ?? path.join(homedir(), '.dsh')
const profileManifestPath = path.join(dshHome, 'profiles', 'narraiva-web', 'package.json')
const profileManifest = JSON.parse(await readFile(profileManifestPath, 'utf8'))
profileManifest.dsh ??= {}
profileManifest.dsh.profile ??= {}
profileManifest.dsh.profile.bundles = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@narraiva/dsh',
]
await writeFile(profileManifestPath, `${JSON.stringify(profileManifest, null, 2)}\n`)

run(['--profile', 'narraiva-web', '--port', '3081'])
