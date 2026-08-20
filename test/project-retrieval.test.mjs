import assert from 'node:assert/strict'
import test from 'node:test'

import { buildProjectIndex, searchProjectIndex, selectedRetrievalContext, retrievalQueryReady } from '../src/client/project-retrieval.cjs'

const files = [
  { path: 'manuscript/chapter_001.md', content: '# Arrival\n\nMara entered the glass city.\n\n## Crown\n\nThe Zero Crown could only take.', revision: '1:90' },
  { path: 'notes/characters.md', content: '# Mara\n\nMara fears that every gift demands a price.', revision: '2:55' },
  { path: 'notes/weather.md', content: '# Rain\n\nThe storm crossed the northern road.', revision: '3:44' },
]

test('chunks project text with stable source and line evidence', () => {
  const index = buildProjectIndex(files)
  assert.ok(index.chunks.length >= 4)
  assert.deepEqual({ ...index.chunks[0], termFrequencies: undefined }, { id: 'manuscript/chapter_001.md:1-3', path: 'manuscript/chapter_001.md', heading: 'Arrival', startLine: 1, endLine: 3, revision: '1:90', text: '# Arrival\n\nMara entered the glass city.', termFrequencies: undefined })
  assert.ok(index.chunks[0].termFrequencies instanceof Map)
})

test('ranks lexical evidence and enforces result and character budgets', () => {
  const result = searchProjectIndex(buildProjectIndex(files), 'Mara Crown price', { limit: 2, maxChars: 90 })
  assert.equal(result.items.length, 2)
  assert.ok(result.items.some(item => item.path === 'notes/characters.md'))
  assert.ok(result.characterCount <= 90)
  assert.ok(result.items.every(item => item.score > 0 && item.text.length > 0))
})

test('selected context contains only author-approved chunks and auditable receipts', () => {
  const result = searchProjectIndex(buildProjectIndex(files), 'Mara', { limit: 5, maxChars: 12_000 })
  const selected = selectedRetrievalContext(result.items, new Set([result.items[0].id]))
  assert.equal(selected.items.length, 1)
  assert.equal(selected.receipt.items[0].path, result.items[0].path)
  assert.match(selected.receipt.items[0].contentHash, /^fnv1a:/)
  assert.equal(selected.receipt.items[0].text, undefined)
  assert.equal(selected.receipt.characterCount, selected.items[0].text.length)
})

test('blocks send while the debounced evidence query is unresolved', () => {
  assert.equal(retrievalQueryReady('new question', 'old question', true), false)
  assert.equal(retrievalQueryReady('new question', 'new question', true), true)
  assert.equal(retrievalQueryReady('anything', '', false), true)
})

test('excludes the active chapter before applying the result limit', () => {
  const crowded = Array.from({ length: 6 }, (_, index) => ({ path: index < 5 ? `manuscript/current.md` : 'notes/external.md', content: `# Match ${index}\n\nMara Mara Mara ${index}`, revision: `${index}:20` }))
  const result = searchProjectIndex(buildProjectIndex(crowded), 'Mara', { limit: 5, excludePaths: ['manuscript/current.md'] })
  assert.deepEqual(result.items.map(item => item.path), ['notes/external.md'])
})

test('search reuses precomputed term frequencies for large indexes', () => {
  const many = Array.from({ length: 200 }, (_, index) => ({ path: `notes/${index}.md`, content: `# Note ${index}\n\n${'context '.repeat(1000)}needle`, revision: `${index}:8000` }))
  const index = buildProjectIndex(many)
  const started = performance.now()
  assert.ok(searchProjectIndex(index, 'needle').items.length > 0)
  assert.ok(performance.now() - started < 250)
})
