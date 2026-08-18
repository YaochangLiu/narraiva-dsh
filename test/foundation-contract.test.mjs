import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function read(relativePath) {
  return await readFile(path.join(repositoryRoot, relativePath), 'utf8')
}

test('Narraiva bundle declares an installable DSH patch layer', async () => {
  const manifest = JSON.parse(await read('package.json'))

  assert.equal(manifest.name, '@narraiva/dsh')
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(manifest.exports['.'].default, './src/index.js')
})

test('Narraiva profile selects the writer preset', async () => {
  const patch = await read('cordis.patch.yml')

  assert.match(patch, /id: agent-presets/)
  assert.match(patch, /default: narraiva-writer/)
  assert.match(patch, /@narraiva\/dsh/)
  assert.match(patch, /id: tool-pwsh\s+disabled: true/)
  assert.match(patch, /id: tool-fs\s+disabled: true/)
})

test('writer preset makes proposals and does not grant direct authoring tools', async () => {
  const preset = await read('presets/narraiva-writer/agent.cordis.yml')

  assert.match(preset, /Narraiva/)
  assert.match(preset, /Proposal/)
  assert.doesNotMatch(preset, /dsh-tool-fs|dsh-tool-bash|dsh-tool-pwsh|str-replace-editor/)
})

test('local launcher composes the official Web bundle before Narraiva', async () => {
  const launcher = await read('scripts/start-local-spike.mjs')

  assert.match(launcher, /@deepseek-ai\/dsh-web-app/)
  assert.match(launcher, /@narraiva\/dsh/)
  assert.doesNotMatch(launcher, /profileManifest\.dsh\.profile\.bundles\s*=/)
})

test('package exposes a profile-composition verification command', async () => {
  const manifest = JSON.parse(await read('package.json'))

  assert.equal(manifest.scripts['verify:profile'], 'node scripts/verify-profile-composition.mjs')
})
