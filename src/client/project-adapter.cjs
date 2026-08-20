const { PROJECT_FILE, NarraivaProjectError, createProjectManifest, parseProjectManifest, validateProjectPath } = require('./project-domain.cjs')

function revisionOf(file) { return `${file.lastModified}:${file.size}` }
async function fileHandleAt(root, relativePath, create = false) {
  const parts = relativePath.split('/'); const name = parts.pop(); let directory = root
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create })
  return directory.getFileHandle(name, { create })
}
async function readHandle(handle) { const file = await handle.getFile(); return { content: await file.text(), revision: revisionOf(file) } }
async function writeHandle(handle, content) {
  let writable
  try { writable = await handle.createWritable(); await writable.write(content); await writable.close() }
  catch (cause) { try { await writable?.abort?.() } catch {} throw new NarraivaProjectError('WRITE_FAILED', `Narraiva could not save ${handle.name}.`, cause) }
}

class NarraivaProjectAdapter {
  constructor(root, manifest) { this.root = root; this.manifest = manifest }
  static async create(root, name, options = {}) {
    try { await root.getFileHandle(PROJECT_FILE); throw new NarraivaProjectError('PROJECT_EXISTS', `The selected folder already contains ${PROJECT_FILE}. Open it instead.`) }
    catch (cause) { if (cause?.code === 'PROJECT_EXISTS') throw cause; if (cause?.name !== 'NotFoundError') throw cause }
    const manifest = createProjectManifest(name, options)
    const adapter = new NarraivaProjectAdapter(root, manifest)
    await adapter.writeNewDocument(manifest.documents[0].path, '# Chapter 1\n\n')
    await adapter.saveManifest(manifest)
    return adapter
  }
  static async open(root) {
    let handle
    try { handle = await root.getFileHandle(PROJECT_FILE) } catch (cause) { throw new NarraivaProjectError('PROJECT_NOT_FOUND', `The selected folder does not contain ${PROJECT_FILE}.`, cause) }
    const { content } = await readHandle(handle)
    return new NarraivaProjectAdapter(root, parseProjectManifest(content))
  }
  async readDocument(relativePath) { const path = validateProjectPath(relativePath); return readHandle(await fileHandleAt(this.root, path)) }
  async writeNewDocument(relativePath, content) { const path = validateProjectPath(relativePath); const handle = await fileHandleAt(this.root, path, true); await writeHandle(handle, content); return readHandle(handle) }
  async saveDocument(relativePath, content, expectedRevision) {
    const path = validateProjectPath(relativePath); const handle = await fileHandleAt(this.root, path); const before = await handle.getFile()
    if (expectedRevision && revisionOf(before) !== expectedRevision) throw new NarraivaProjectError('WRITE_CONFLICT', `${path} changed outside Narraiva. Your draft was not overwritten.`)
    await writeHandle(handle, content); return readHandle(handle)
  }
  async deleteDocument(relativePath) { const path = validateProjectPath(relativePath); const parts = path.split('/'); const name = parts.pop(); let directory = this.root; for (const part of parts) directory = await directory.getDirectoryHandle(part); await directory.removeEntry(name) }
  async addDocumentAndSaveManifest(document, content, manifest) {
    await this.writeNewDocument(document.path, content)
    try { await this.saveManifest(manifest) } catch (cause) { try { await this.deleteDocument(document.path) } catch {} throw cause }
  }
  async deleteDocumentAndSaveManifest(relativePath, manifest) {
    const snapshot = await this.readDocument(relativePath)
    await this.deleteDocument(relativePath)
    try { await this.saveManifest(manifest) } catch (cause) { try { await this.writeNewDocument(relativePath, snapshot.content) } catch {} throw cause }
  }
  async saveManifest(manifest) {
    const handle = await this.root.getFileHandle(PROJECT_FILE, { create: true })
    await writeHandle(handle, `${JSON.stringify(manifest, null, 2)}\n`); this.manifest = manifest
  }
}

module.exports = { NarraivaProjectAdapter, readHandle, revisionOf }
