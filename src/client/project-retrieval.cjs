const MAX_CHUNK_CHARS = 2400

function tokens(value) {
  const normalized = String(value || '').toLocaleLowerCase()
  const words = normalized.match(/[\p{L}\p{N}_-]+/gu) || []
  const result = []
  for (const word of words) {
    result.push(word)
    if (/^[\p{Script=Han}]+$/u.test(word) && word.length > 1) for (let index = 0; index < word.length - 1; index++) result.push(word.slice(index, index + 2))
  }
  return result
}

function contentHash(text) {
  let hash = 2166136261
  for (const character of String(text || '')) { hash ^= character.codePointAt(0); hash = Math.imul(hash, 16777619) }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function retrievalQueryReady(input, resolvedQuery, enabled, busy = false) { return !enabled || (!busy && String(input || '') === String(resolvedQuery || '')) }

function sections(content) {
  const lines = String(content || '').replace(/\r\n?/gu, '\n').split('\n')
  const boundaries = [0]
  for (let index = 1; index < lines.length; index++) if (/^#{1,6}\s+/u.test(lines[index])) boundaries.push(index)
  boundaries.push(lines.length)
  return boundaries.slice(0, -1).map((start, index) => ({ start, end: boundaries[index + 1], lines: lines.slice(start, boundaries[index + 1]) }))
}

function splitSection(section) {
  const pieces = []
  let start = section.start
  let buffer = []
  let size = 0
  for (let index = 0; index < section.lines.length; index++) {
    const line = section.lines[index]
    const addition = line.length + (buffer.length ? 1 : 0)
    if (buffer.length && size + addition > MAX_CHUNK_CHARS) { pieces.push({ start, end: section.start + index, lines: buffer }); start = section.start + index; buffer = []; size = 0 }
    buffer.push(line); size += addition
  }
  if (buffer.length) pieces.push({ start, end: section.end, lines: buffer })
  return pieces
}

function buildProjectIndex(files) {
  const chunks = []
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    for (const section of sections(file.content).flatMap(splitSection)) {
      const lastContentIndex = section.lines.findLastIndex(line => line.trim().length > 0)
      const effectiveLines = section.lines.slice(0, lastContentIndex + 1)
      const text = effectiveLines.join('\n').trim()
      if (!text) continue
      const headingLine = section.lines.find(line => /^#{1,6}\s+/u.test(line))
      const heading = headingLine?.replace(/^#{1,6}\s+/u, '').trim() || file.path.split('/').at(-1)
      const startLine = section.start + 1
      const endLine = section.start + effectiveLines.length
      const termFrequencies = new Map()
      for (const token of tokens(`${heading} ${text}`)) termFrequencies.set(token, (termFrequencies.get(token) || 0) + 1)
      chunks.push({ id: `${file.path}:${startLine}-${endLine}`, path: file.path, heading, startLine, endLine, revision: file.revision, text, termFrequencies })
    }
  }
  const documentFrequency = new Map()
  for (const chunk of chunks) for (const token of new Set(tokens(chunk.text))) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1)
  return { chunks, documentFrequency }
}

function searchProjectIndex(index, query, options = {}) {
  const limit = Math.max(1, Math.min(10, options.limit || 5))
  const maxChars = Math.max(1, options.maxChars || 12_000)
  const excludePaths = new Set(options.excludePaths || [])
  const queryTokens = [...new Set(tokens(query))]
  if (!queryTokens.length) return { items: [], characterCount: 0 }
  const scored = index.chunks.filter(chunk => !excludePaths.has(chunk.path)).map(chunk => {
    const score = queryTokens.reduce((total, token) => {
      const frequency = chunk.termFrequencies.get(token) || 0
      if (!frequency) return total
      const idf = Math.log(1 + index.chunks.length / (1 + (index.documentFrequency.get(token) || 0)))
      return total + (1 + Math.log(frequency)) * idf
    }, 0)
    return { ...chunk, score: Number(score.toFixed(4)) }
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.startLine - b.startLine)
  const items = []
  let characterCount = 0
  for (const item of scored) {
    if (items.length >= limit) break
    if (characterCount + item.text.length > maxChars) continue
    items.push(item); characterCount += item.text.length
  }
  return { items, characterCount }
}

function selectedRetrievalContext(items, selectedIds) {
  const selected = items.filter(item => selectedIds.has(item.id))
  return {
    items: selected,
    receipt: {
      characterCount: selected.reduce((total, item) => total + item.text.length, 0),
      items: selected.map(({ id, path, heading, startLine, endLine, revision, text, score }) => ({ id, path, heading, startLine, endLine, revision, contentHash: contentHash(text), characterCount: text.length, score })),
    },
  }
}

module.exports = { buildProjectIndex, searchProjectIndex, selectedRetrievalContext, tokens, contentHash, retrievalQueryReady }
