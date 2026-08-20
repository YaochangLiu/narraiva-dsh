const PROJECT_FILE = 'narraiva.json'
const PROJECT_VERSION = 1

class NarraivaProjectError extends Error {
  constructor(code, message, cause) { super(message, { cause }); this.name = 'NarraivaProjectError'; this.code = code }
}

function validateProjectPath(value) {
  if (typeof value !== 'string') throw new NarraivaProjectError('INVALID_PATH', 'Expected a project-relative Markdown path.')
  const normalized = value.replace(/\\/g, '/')
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/i.test(normalized) || normalized.split('/').some(part => part === '..' || part === '') || !normalized.endsWith('.md')) {
    throw new NarraivaProjectError('INVALID_PATH', `Expected a project-relative Markdown path: ${value}`)
  }
  return normalized
}

function slugify(value) {
  const slug = String(value).normalize('NFKD').toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-|-$/g, '')
  return slug || 'chapter'
}

function stamp(manifest, now) { return { ...manifest, updatedAt: now || new Date().toISOString() } }
function uniquePath(manifest, title) {
  const used = new Set(manifest.documents.map(item => item.path))
  const base = `manuscript/${slugify(title)}`
  let candidate = `${base}.md`; let index = 2
  while (used.has(candidate)) candidate = `${base}-${index++}.md`
  return candidate
}

function createProjectManifest(name, options = {}) {
  const title = String(name || '').trim()
  if (!title) throw new NarraivaProjectError('INVALID_MANIFEST', 'Project name is required.')
  const now = options.now || new Date().toISOString()
  const id = options.id || crypto.randomUUID()
  const documentId = options.documentId || `${id}-chapter-1`
  return { version: PROJECT_VERSION, id, name: title, documents: [{ id: documentId, title: 'Chapter 1', path: 'manuscript/chapter_001.md', order: 0 }], activeDocumentId: documentId, retrieval: { enabled: false }, createdAt: now, updatedAt: now }
}

function validateManifest(value) {
  if (!value || value.version !== PROJECT_VERSION) throw new NarraivaProjectError('UNSUPPORTED_VERSION', 'Narraiva uses an unsupported project version.')
  if (typeof value.id !== 'string' || typeof value.name !== 'string' || !Array.isArray(value.documents)) throw new NarraivaProjectError('INVALID_MANIFEST', 'Narraiva project manifest is incomplete.')
  const ids = new Set()
  value.documents.forEach((item, index) => {
    if (!item || typeof item.id !== 'string' || ids.has(item.id) || typeof item.title !== 'string') throw new NarraivaProjectError('INVALID_MANIFEST', 'Narraiva project documents are invalid.')
    ids.add(item.id); validateProjectPath(item.path); item.order = index
  })
  if (value.activeDocumentId != null && !ids.has(value.activeDocumentId)) throw new NarraivaProjectError('INVALID_MANIFEST', 'Active document is missing.')
  if (value.retrieval != null && typeof value.retrieval.enabled !== 'boolean') throw new NarraivaProjectError('INVALID_MANIFEST', 'Project retrieval settings are invalid.')
  value.retrieval ||= { enabled: false }
  return value
}

function parseProjectManifest(source) {
  let value
  try { value = JSON.parse(source) } catch (error) { throw new NarraivaProjectError('INVALID_JSON', 'Narraiva project manifest contains invalid JSON.', error) }
  return validateManifest(value)
}

function addDocument(manifest, title, options = {}) {
  const clean = String(title || '').trim() || `Chapter ${manifest.documents.length + 1}`
  const item = { id: options.id || crypto.randomUUID(), title: clean, path: uniquePath(manifest, clean), order: manifest.documents.length }
  return stamp({ ...manifest, documents: [...manifest.documents, item], activeDocumentId: item.id }, options.now)
}
function renameDocument(manifest, id, title, now) { return stamp({ ...manifest, documents: manifest.documents.map(item => item.id === id ? { ...item, title: String(title).trim() || item.title } : item) }, now) }
function reorderDocument(manifest, id, delta, now) {
  const documents = [...manifest.documents]; const from = documents.findIndex(item => item.id === id); const to = Math.max(0, Math.min(documents.length - 1, from + delta))
  if (from < 0 || from === to) return manifest
  const [item] = documents.splice(from, 1); documents.splice(to, 0, item)
  return stamp({ ...manifest, documents: documents.map((doc, order) => ({ ...doc, order })) }, now)
}
function removeDocument(manifest, id, now) {
  const documents = manifest.documents.filter(item => item.id !== id).map((item, order) => ({ ...item, order }))
  return stamp({ ...manifest, documents, activeDocumentId: manifest.activeDocumentId === id ? documents[0]?.id || null : manifest.activeDocumentId }, now)
}

module.exports = { PROJECT_FILE, PROJECT_VERSION, NarraivaProjectError, addDocument, createProjectManifest, parseProjectManifest, removeDocument, renameDocument, reorderDocument, validateManifest, validateProjectPath }
