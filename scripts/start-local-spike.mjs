import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dshSource = process.env.DSH_SOURCE ?? path.resolve(repositoryRoot, '..', '_tools', 'deepseek-harness')
const dshBin = path.join(dshSource, 'apps', 'cli', 'lib', 'bin.js')
const dshNode = process.env.DSH_NODE ?? process.execPath
const profileName = process.env.DSH_PROFILE ?? 'narraiva-web'
const port = process.env.DSH_PORT ?? '3081'

if (!existsSync(dshBin) || !existsSync(dshNode)) {
  throw new Error('Set DSH_SOURCE and, if needed, DSH_NODE to a Node 24+ DeepSeek Harness runtime.')
}

function run(argumentsList) {
  const result = spawnSync(dshNode, [dshBin, ...argumentsList], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const clientBuild = spawnSync(process.execPath, [path.join(repositoryRoot, 'scripts', 'build-client.mjs')], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: 'inherit',
})
if (clientBuild.error) throw clientBuild.error
if (clientBuild.status !== 0) process.exit(clientBuild.status ?? 1)

run(['plugin', '--profile', profileName, 'add', repositoryRoot])

const dshHome = process.env.DSH_HOME ?? path.join(homedir(), '.dsh')
const profileManifestPath = path.join(dshHome, 'profiles', profileName, 'package.json')
const profileManifest = JSON.parse(await readFile(profileManifestPath, 'utf8'))
profileManifest.dsh ??= {}
profileManifest.dsh.profile ??= {}
const profile = profileManifest.dsh.profile
const bundles = Array.isArray(profile.bundles) ? [...profile.bundles] : []

function insertBundle(bundle, index) {
  if (!bundles.includes(bundle)) bundles.splice(index, 0, bundle)
}

insertBundle('@deepseek-ai/dsh-base', 0)
insertBundle('@deepseek-ai/dsh-web-app', bundles.indexOf('@deepseek-ai/dsh-base') + 1)
if (!bundles.includes('@narraiva/dsh')) bundles.push('@narraiva/dsh')
profile.bundles = bundles
await writeFile(profileManifestPath, `${JSON.stringify(profileManifest, null, 2)}\n`)

process.env.DSH_TELEMETRY_DISABLED ??= '1'
run(['--profile', profileName, '--port', port])
