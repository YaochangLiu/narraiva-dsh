import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWritePrompt } from '../src/client/write-context.cjs'

test('builds a strict Write proposal request over the real document snapshot', () => {
  const prompt = buildWritePrompt({ input: '@选中文本 写得更有张力', document: { path: 'manuscript/a.md' }, content: 'Alpha beta', revision: '1:10', selection: 'beta', selectionStart: 6 })
  assert.match(prompt, /NARRAIVA_WRITE_V1/)
  assert.match(prompt, /NARRAIVA_PROPOSAL_V1/)
  assert.match(prompt, /Alpha beta/)
})
