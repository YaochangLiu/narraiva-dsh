import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWritePrompt } from '../src/client/write-context.cjs'

test('builds a strict Write proposal request over the real document snapshot', () => {
  const prompt = buildWritePrompt({ input: '@选中文本 写得更有张力', document: { path: 'manuscript/a.md' }, content: 'Alpha beta', revision: '1:10', selection: 'beta', selectionStart: 6 })
  assert.match(prompt, /NARRAIVA_WRITE_V1/)
  assert.match(prompt, /NARRAIVA_PROPOSAL_V1/)
  assert.match(prompt, /Alpha beta/)
})

test('Write can reference selected project evidence without expanding its editable source', () => {
  const retrieval = { items: [{ id: 'notes/a.md:1-1', path: 'notes/a.md', heading: 'Fact', startLine: 1, endLine: 1, revision: '2:4', text: 'Fact' }], receipt: { characterCount: 4, items: [{ id: 'notes/a.md:1-1', path: 'notes/a.md', startLine: 1, endLine: 1, revision: '2:4', characterCount: 4 }] } }
  const prompt = buildWritePrompt({ input: '参考设定改写', document: { path: 'manuscript/a.md' }, content: 'Draft', revision: '1:5', selection: '', retrieval })
  const metadata = JSON.parse(decodeURIComponent(prompt.match(/\[NARRAIVA_META_V1\](.+)/u)[1]))
  assert.equal(metadata.source.path, 'manuscript/a.md')
  assert.equal(metadata.retrievalReceipt.items[0].path, 'notes/a.md')
  assert.match(prompt, /NARRAIVA_RETRIEVED_CONTEXT_V1/)
})
