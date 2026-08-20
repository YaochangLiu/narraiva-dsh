import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dshSource = process.env.DSH_SOURCE ?? path.resolve(repositoryRoot, '..', '_tools', 'deepseek-harness')
const dshBin = path.join(dshSource, 'apps', 'cli', 'lib', 'bin.js')
const dshNode = process.env.DSH_NODE ?? process.execPath
const profileName = process.env.DSH_PROFILE ?? 'narraiva-web'

if (!existsSync(dshBin) || !existsSync(dshNode)) {
  throw new Error('Set DSH_SOURCE and, if needed, DSH_NODE to a Node 24+ DeepSeek Harness runtime.')
}

const result = spawnSync(
  dshNode,
  [dshBin, '--profile', profileName, '--dump-config'],
  { cwd: repositoryRoot, encoding: 'utf8', env: process.env },
)

if (result.error) throw result.error
assert.equal(result.status, 0, result.stderr)
assert.match(result.stdout, /@deepseek-ai\/dsh-web-app/)
assert.match(result.stdout, /@narraiva\/dsh/)
assert.match(result.stdout, /default: narraiva-ask/)
assert.match(result.stdout, /- id: ui-layout\s+name: '@deepseek-ai\/dsh-client-ui-layout'/)
assert.match(result.stdout, /- id: tool-pwsh[\s\S]{0,200}?disabled: true/)
assert.match(result.stdout, /- id: tool-fs[\s\S]{0,300}?disabled: true/)
assert.match(result.stdout, /- id: tool-str-replace-editor[\s\S]{0,300}?disabled: true/)

console.log('Verified Narraiva profile composition against the local DeepSeek Harness CLI.')
