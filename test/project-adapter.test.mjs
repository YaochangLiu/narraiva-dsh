import assert from 'node:assert/strict'
import test from 'node:test'

import { NarraivaProjectAdapter } from '../src/client/project-adapter.cjs'

class MemoryFileHandle {
  constructor(name, content = '') { this.kind = 'file'; this.name = name; this.content = content; this.version = 1; this.failWrite = false }
  async getFile() { return { text: async () => this.content, lastModified: this.version, size: this.content.length } }
  async createWritable() {
    if (this.failWrite) throw new Error('disk full')
    let next = ''
    return { write: async value => { next = String(value) }, close: async () => { this.content = next; this.version++ }, abort: async () => {} }
  }
}
class MemoryDirectoryHandle {
  constructor(name = 'project') { this.kind = 'directory'; this.name = name; this.entries = new Map() }
  async getDirectoryHandle(name, options = {}) { let value = this.entries.get(name); if (!value && options.create) { value = new MemoryDirectoryHandle(name); this.entries.set(name, value) } if (!value || value.kind !== 'directory') throw new DOMException('missing', 'NotFoundError'); return value }
  async getFileHandle(name, options = {}) { let value = this.entries.get(name); if (!value && options.create) { value = new MemoryFileHandle(name); this.entries.set(name, value) } if (!value || value.kind !== 'file') throw new DOMException('missing', 'NotFoundError'); return value }
  async removeEntry(name) { if (!this.entries.delete(name)) throw new DOMException('missing', 'NotFoundError') }
  async queryPermission() { return 'granted' }
}

test('creates, reopens and saves a local Narraiva project', async () => {
  const root = new MemoryDirectoryHandle('zero-crown')
  const created = await NarraivaProjectAdapter.create(root, 'The Zero Crown', { id: 'p1', now: '2026-08-20T00:00:00.000Z' })
  const first = created.manifest.documents[0]
  const loaded = await created.readDocument(first.path)
  assert.match(loaded.content, /Chapter 1/)
  const saved = await created.saveDocument(first.path, '# Chapter 1\n\nDraft.', loaded.revision)
  assert.notEqual(saved.revision, loaded.revision)
  const reopened = await NarraivaProjectAdapter.open(root)
  assert.equal(reopened.manifest.name, 'The Zero Crown')
  assert.equal((await reopened.readDocument(first.path)).content, '# Chapter 1\n\nDraft.')
})

test('refuses overwrite after external modification', async () => {
  const root = new MemoryDirectoryHandle()
  const adapter = await NarraivaProjectAdapter.create(root, 'Novel', { id: 'p', now: '2026-08-20T00:00:00.000Z' })
  const path = adapter.manifest.documents[0].path
  const loaded = await adapter.readDocument(path)
  const file = await (await root.getDirectoryHandle('manuscript')).getFileHandle('chapter_001.md')
  file.content = 'external'; file.version++
  await assert.rejects(() => adapter.saveDocument(path, 'local', loaded.revision), error => error.code === 'WRITE_CONFLICT')
  assert.equal(file.content, 'external')
})

test('surfaces write failures and never escapes the granted root', async () => {
  const root = new MemoryDirectoryHandle()
  const adapter = await NarraivaProjectAdapter.create(root, 'Novel', { id: 'p', now: '2026-08-20T00:00:00.000Z' })
  await assert.rejects(() => adapter.readDocument('../outside.md'), /project-relative Markdown path/)
  const path = adapter.manifest.documents[0].path
  const loaded = await adapter.readDocument(path)
  const file = await (await root.getDirectoryHandle('manuscript')).getFileHandle('chapter_001.md')
  file.failWrite = true
  await assert.rejects(() => adapter.saveDocument(path, 'lost?', loaded.revision), error => error.code === 'WRITE_FAILED')
  assert.equal(file.content, '# Chapter 1\n\n')
})

test('does not overwrite an existing project during create', async () => {
  const root = new MemoryDirectoryHandle()
  await NarraivaProjectAdapter.create(root, 'First', { id: 'p1', now: '2026-08-20T00:00:00.000Z' })
  await assert.rejects(() => NarraivaProjectAdapter.create(root, 'Second', { id: 'p2' }), error => error.code === 'PROJECT_EXISTS')
  assert.equal((await NarraivaProjectAdapter.open(root)).manifest.name, 'First')
})

test('rolls a deleted document back when manifest persistence fails', async () => {
  const root = new MemoryDirectoryHandle()
  const adapter = await NarraivaProjectAdapter.create(root, 'Novel', { id: 'p', now: '2026-08-20T00:00:00.000Z' })
  const document = adapter.manifest.documents[0]
  ;(await root.getFileHandle('narraiva.json')).failWrite = true
  await assert.rejects(() => adapter.deleteDocumentAndSaveManifest(document.path, { ...adapter.manifest, documents: [], activeDocumentId: null }), error => error.code === 'WRITE_FAILED')
  assert.match((await adapter.readDocument(document.path)).content, /Chapter 1/)
})

test('applies and safely rolls back an author-approved change set', async () => {
  const root = new MemoryDirectoryHandle()
  const adapter = await NarraivaProjectAdapter.create(root, 'Book')
  const doc = adapter.manifest.documents[0]
  const before = await adapter.readDocument(doc.path)
  const proposal = { id: 'p1', source: { path: doc.path, diskRevision: before.revision }, changes: [{ filePath: doc.path }] }
  const applied = await adapter.applyChangeSet(proposal, '# Changed\n')
  assert.equal((await adapter.readDocument(doc.path)).content, '# Changed\n')
  const undone = await adapter.undoChangeSet(applied)
  assert.equal(undone.status, 'rolled_back')
  assert.equal((await adapter.readDocument(doc.path)).content, before.content)
})

test('refuses apply and undo after an external revision change', async () => {
  const root = new MemoryDirectoryHandle()
  const adapter = await NarraivaProjectAdapter.create(root, 'Book')
  const doc = adapter.manifest.documents[0]
  const before = await adapter.readDocument(doc.path)
  const proposal = { id: 'p1', source: { path: doc.path, diskRevision: before.revision }, changes: [{ filePath: doc.path }] }
  await adapter.saveDocument(doc.path, 'external', before.revision)
  await assert.rejects(() => adapter.applyChangeSet(proposal, 'changed'), error => error.code === 'WRITE_CONFLICT')
})

test('rolls manuscript changes back when Change Set manifest persistence fails', async () => {
  const root = new MemoryDirectoryHandle(); const adapter = await NarraivaProjectAdapter.create(root, 'Book'); const doc = adapter.manifest.documents[0]; const before = await adapter.readDocument(doc.path)
  const proposal = { id: 'p1', source: { path: doc.path, diskRevision: before.revision }, changes: [{ filePath: doc.path }] }
  const originalSave = adapter.saveManifest.bind(adapter); adapter.saveManifest = async () => { throw new Error('manifest full') }
  await assert.rejects(() => adapter.applyChangeSetAndSaveManifest(proposal, '# Changed\n', adapter.manifest), error => error.code === 'CHANGE_SET_RECORD_FAILED')
  assert.equal((await adapter.readDocument(doc.path)).content, before.content)
  adapter.saveManifest = originalSave
})

test('restores applied text when undo record persistence fails', async () => {
  const root = new MemoryDirectoryHandle(); const adapter = await NarraivaProjectAdapter.create(root, 'Book'); const doc = adapter.manifest.documents[0]; const before = await adapter.readDocument(doc.path)
  const proposal = { id: 'p1', source: { path: doc.path, diskRevision: before.revision }, changes: [{ filePath: doc.path }] }
  const applied = await adapter.applyChangeSet(proposal, '# Changed\n'); adapter.saveManifest = async () => { throw new Error('manifest full') }
  await assert.rejects(() => adapter.undoChangeSetAndSaveManifest(applied, adapter.manifest), error => error.code === 'CHANGE_SET_RECORD_FAILED')
  assert.equal((await adapter.readDocument(doc.path)).content, '# Changed\n')
})

test('never claims compensation succeeded when manifest and rollback both fail', async () => {
  const root = new MemoryDirectoryHandle(); const adapter = await NarraivaProjectAdapter.create(root, 'Book'); const doc = adapter.manifest.documents[0]; const before = await adapter.readDocument(doc.path)
  const proposal = { id: 'p1', source: { path: doc.path, diskRevision: before.revision }, changes: [{ filePath: doc.path }] }
  const realSaveDocument = adapter.saveDocument.bind(adapter); let writes = 0
  adapter.saveDocument = async (...args) => { if (++writes === 2) throw new Error('rollback disk failure'); return realSaveDocument(...args) }
  adapter.saveManifest = async () => { throw new Error('manifest full') }
  await assert.rejects(() => adapter.applyChangeSetAndSaveManifest(proposal, '# Changed\n', adapter.manifest), error => error.code === 'CHANGE_SET_ROLLBACK_FAILED' && /可能已经改变/.test(error.message))
})
