import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { listNarraivaModes, resolveNarraivaMode } = await import('../src/modes.js')

async function read(relativePath) {
  return await readFile(path.join(repositoryRoot, relativePath), 'utf8')
}

test('Narraiva bundle declares an installable DSH patch layer', async () => {
  const manifest = JSON.parse(await read('package.json'))
  const patch = await read('cordis.patch.yml')

  assert.equal(manifest.name, '@narraiva/dsh')
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(manifest.exports['.'].default, './src/index.js')
  assert.match(patch, /id: '@narraiva\/dsh'\s+name: '@narraiva\/dsh'/)
  assert.equal(manifest.exports['./package.json'], './package.json')
})

test('Narraiva profile defaults new sessions to the unified conversation and keeps the upstream shell service available', async () => {
  const patch = await read('cordis.patch.yml')

  assert.match(patch, /id: agent-presets/)
  assert.match(patch, /default: narraiva-conversation/)
  assert.match(patch, /@narraiva\/dsh/)
  assert.doesNotMatch(patch, /id: ui-layout[\s\S]{0,120}?disabled: true/)
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

test('Browser Client is a formally declared DSH web entry with a distributable bundle', async () => {
  const manifest = JSON.parse(await read('package.json'))
  const bundle = await read('lib/client.js')

  assert.equal(manifest.exports['./client'].default, './lib/client.js')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(manifest.dsh.client.immediately, true)
  assert.deepEqual(manifest.dsh.client.inject, [
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-connection',
    '@deepseek-ai/dsh-client-ui-layout',
    '@deepseek-ai/dsh-client-ui-conversation',
  ])
  assert.match(bundle, /__ModuleLoader__\.load/)
  assert.match(bundle, /@narraiva\/dsh/)
})

test('Browser source remains a local, credential-free presentation layer', async () => {
  const clientSource = await read('src/client/index.cjs')
  const hostSource = await read('src/index.js')

  assert.doesNotMatch(clientSource, /https?:\/\//i)
  assert.doesNotMatch(clientSource, /DEEPSEEK_API_KEY|api[_-]?key|cloud/i)
  assert.doesNotMatch(hostSource, /DEEPSEEK_API_KEY|api[_-]?key|cloud/i)
})

test('Browser Client bundle registers one DSH factory with the expected public client face', async () => {
  const bundle = await read('lib/client.js')
  let handoff
  const sandbox = {
    window: { __ModuleLoader__: { load: (value) => { handoff = value } } },
  }

  vm.runInNewContext(bundle, sandbox)

  assert.equal(handoff.id, '@narraiva/dsh')
  assert.equal(typeof handoff.factory, 'function')
  const client = handoff.factory((specifier) => {
    assert.equal(specifier, 'react')
    return { createElement: () => null, useState: () => ['ask', () => {}], useSyncExternalStore: () => 'unavailable' }
  })
  assert.deepEqual([...client.inject], ['slots', 'connection', 'sessions'])
  assert.equal(typeof client.apply, 'function')

  let injectedSlot
  let registration
  client.apply({
    get: (service) => service === 'connection' ? {} : undefined,
    slots: {
      inject: (slot, callback) => {
        injectedSlot = slot
        return callback()
      },
      register: (options, component) => {
        registration = { options, component }
        return () => {}
      },
    },
  })
  assert.equal(injectedSlot, 'shell.overlay')
  assert.equal(registration.options.name, 'shell.overlay')
  assert.equal(registration.options.id, 'narraiva-workbench')
  assert.equal(typeof registration.component, 'function')
})

test('Ask and Write have one stable mode interface and one shared DSH preset', () => {
  assert.deepEqual(listNarraivaModes(), [
    {
      id: 'ask',
      agentPreset: 'narraiva-conversation',
      label: 'Narraiva Ask',
      purpose: '讨论、分析与澄清',
    },
    {
      id: 'write',
      agentPreset: 'narraiva-conversation',
      label: 'Narraiva Write',
      purpose: '生成作者可审阅的写作 Proposal',
    },
  ])
  assert.equal(resolveNarraivaMode('ask').agentPreset, 'narraiva-conversation')
  assert.equal(resolveNarraivaMode('write').agentPreset, 'narraiva-conversation')
  assert.throws(() => resolveNarraivaMode('unknown'), /Unknown Narraiva mode/)
})

test('Ask and Write presets preserve their author-control distinction', async () => {
  const ask = await read('presets/narraiva-ask/agent.cordis.yml')
  const write = await read('presets/narraiva-writer/agent.cordis.yml')
  const bootstrap = await read('scripts/bootstrap-local-profile.mjs')

  assert.match(ask, /Narraiva Ask/)
  assert.match(ask, /Do not produce a manuscript replacement/)
  assert.match(write, /Narraiva Write/)
  assert.match(write, /Proposal/)
  assert.match(bootstrap, /narraiva-ask/)
})

test('unified conversation preset switches behavior by request protocol without file authority', async () => {
  const unified = await read('presets/narraiva-conversation/agent.cordis.yml')
  assert.match(unified, /NARRAIVA_ASK_V1/)
  assert.match(unified, /NARRAIVA_WRITE_V1/)
  assert.match(unified, /one continuous conversation/)
  assert.doesNotMatch(unified, /tool-fs|tool-bash|str-replace/)
})
