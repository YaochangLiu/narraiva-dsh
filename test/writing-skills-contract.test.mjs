import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const presetRoot = path.resolve('presets/narraiva-conversation')
const expected = [
  'active-revision-refine', 'agent-respond', 'ai-flavor-reduction', 'continue-at-cursor',
  'diagnostic-chapter', 'diagnostic-selection', 'revision-explain', 'second-direction-write',
  'selection-rewrite', 'short-selection-rewrite',
]

test('unified preset bundles the complete Narraiva writing skill catalog', async () => {
  const skillRoot = path.join(presetRoot, 'skills')
  const names = (await readdir(skillRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
  assert.deepEqual(names, expected)

  for (const name of expected) {
    const body = await readFile(path.join(skillRoot, name, 'SKILL.md'), 'utf8')
    assert.match(body, new RegExp(`name: ${name}`))
    assert.match(body, /^description: .+/mu)
    assert.match(body, /NARRAIVA_(?:ASK|PROPOSAL)_V1/u)
    assert.match(body, /(不得|禁止|never|只读|只返回)/iu)
  }
})

test('unified preset mounts only the DSH native skill provider and loader', async () => {
  const config = await readFile(path.join(presetRoot, 'agent.cordis.yml'), 'utf8')
  assert.match(config, /name: '@deepseek-ai\/dsh-skill-filesystem'/u)
  assert.match(config, /new URL\('skills\/', baseUrl\)/u)
  assert.match(config, /name: '@deepseek-ai\/dsh-tool-skill'/u)
  assert.doesNotMatch(config, /dsh-tool-(?:bash|pwsh|fs|fs-search|str-replace-editor)/u)
})
