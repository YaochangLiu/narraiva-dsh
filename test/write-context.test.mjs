import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWritePrompt } from '../src/client/write-context.cjs'
import { routeWritingSkills } from '../src/client/writing-skill-router.cjs'

test('builds a strict Write proposal request over the real document snapshot', () => {
  const skillRoute = routeWritingSkills({ mode: 'write', input: '@选中文本 写得更有张力', selection: 'beta' })
  const prompt = buildWritePrompt({ input: '@选中文本 写得更有张力', document: { path: 'manuscript/a.md' }, content: 'Alpha beta', revision: '1:10', selection: 'beta', selectionStart: 6, skillRoute })
  assert.match(prompt, /NARRAIVA_WRITE_V1/)
  assert.match(prompt, /NARRAIVA_PROPOSAL_V1/)
  assert.match(prompt, /Alpha beta/)
  assert.match(prompt, /\/short-selection-rewrite/)
  const metadata = JSON.parse(decodeURIComponent(prompt.match(/\[NARRAIVA_META_V1\](.+)/u)[1]))
  assert.deepEqual(metadata.skillRoute.skills, ['short-selection-rewrite'])
})

test('persists the author-selected method in the request receipt', () => {
  const skillRoute = routeWritingSkills({ mode: 'write', input: '@选中文本 重写', selection: 'beta', preferredSkill: 'selection-rewrite' })
  const prompt = buildWritePrompt({ input: '@选中文本 重写', document: { path: 'manuscript/a.md' }, content: 'Alpha beta', revision: '1:10', selection: 'beta', selectionStart: 6, skillRoute })
  const metadata = JSON.parse(decodeURIComponent(prompt.match(/\[NARRAIVA_META_V1\](.+)/u)[1]))
  assert.equal(metadata.skillRoute.selectionSource, 'manual')
  assert.equal(metadata.skillRoute.preferredSkill, 'selection-rewrite')
  assert.deepEqual(metadata.skillRoute.skills, ['selection-rewrite'])
})

test('Write can reference selected project evidence without expanding its editable source', () => {
  const retrieval = { items: [{ id: 'notes/a.md:1-1', path: 'notes/a.md', heading: 'Fact', startLine: 1, endLine: 1, revision: '2:4', text: 'Fact' }], receipt: { characterCount: 4, items: [{ id: 'notes/a.md:1-1', path: 'notes/a.md', startLine: 1, endLine: 1, revision: '2:4', characterCount: 4 }] } }
  const prompt = buildWritePrompt({ input: '参考设定改写', document: { path: 'manuscript/a.md' }, content: 'Draft', revision: '1:5', selection: '', retrieval })
  const metadata = JSON.parse(decodeURIComponent(prompt.match(/\[NARRAIVA_META_V1\](.+)/u)[1]))
  assert.equal(metadata.source.path, 'manuscript/a.md')
  assert.equal(metadata.retrievalReceipt.items[0].path, 'notes/a.md')
  assert.match(prompt, /NARRAIVA_RETRIEVED_CONTEXT_V1/)
})

test('Write without an authorized selection creates an insertion boundary at the cursor', () => {
  const skillRoute = routeWritingSkills({ mode: 'write', input: '继续写下去' })
  const prompt = buildWritePrompt({ input: '继续写下去', document: { path: 'manuscript/a.md' }, content: 'Alpha beta', revision: '1:10', selection: '', cursorOffset: 5, skillRoute })
  const metadata = JSON.parse(decodeURIComponent(prompt.match(/\[NARRAIVA_META_V1\](.+)/u)[1]))
  assert.equal(metadata.source.startOffset, 5)
  assert.equal(metadata.source.endOffset, 5)
})

test('active Proposal refinement preserves the original authorized range', () => {
  const activeProposal = { source: { path: 'manuscript/a.md', content: 'Alpha beta', diskRevision: '1:10', startOffset: 6, endOffset: 10 }, summary: 'Rewrite beta', rationale: 'Clarity', changes: [] }
  const skillRoute = routeWritingSkills({ mode: 'write', input: '再克制一些', activeProposal })
  const prompt = buildWritePrompt({ input: '再克制一些', document: { path: 'manuscript/a.md' }, content: 'Alpha beta', revision: '1:10', selection: '', cursorOffset: 2, activeProposal, skillRoute })
  const metadata = JSON.parse(decodeURIComponent(prompt.match(/\[NARRAIVA_META_V1\](.+)/u)[1]))
  assert.equal(metadata.source.startOffset, 6)
  assert.equal(metadata.source.endOffset, 10)
})

test('active Proposal refinement fails closed after the source snapshot changes', () => {
  const activeProposal = { source: { path: 'manuscript/a.md', content: 'Old draft', diskRevision: '1:9', startOffset: 0, endOffset: 3 }, summary: 'Rewrite', rationale: 'Clarity', changes: [] }
  const skillRoute = routeWritingSkills({ mode: 'write', input: '再改一次', activeProposal })
  assert.throws(() => buildWritePrompt({ input: '再改一次', document: { path: 'manuscript/a.md' }, content: 'New draft', revision: '2:9', activeProposal, skillRoute }), /原文已经变化/)
})
