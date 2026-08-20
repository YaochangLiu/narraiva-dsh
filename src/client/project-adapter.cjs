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
  async applyChangeSet(proposal, nextContent) {
    if (!proposal?.changes?.length || proposal.changes.some(change => change.filePath !== proposal.source.path)) throw new NarraivaProjectError('INVALID_CHANGE_SET', 'Change Set 只能应用到明确授权的来源文件。')
    const before = await this.readDocument(proposal.source.path)
    if (before.revision !== proposal.source.diskRevision) throw new NarraivaProjectError('WRITE_CONFLICT', `${proposal.source.path} 已在 Proposal 生成后发生变化，未应用修改。`)
    const saved = await this.saveDocument(proposal.source.path, nextContent, before.revision)
    return { id: `changeset-${crypto.randomUUID()}`, proposalId: proposal.id, proposal: { ...proposal, status: 'accepted' }, status: 'applied', path: proposal.source.path, beforeContent: before.content, afterContent: nextContent, beforeRevision: before.revision, appliedRevision: saved.revision, appliedAt: Date.now() }
  }
  async undoChangeSet(changeSet) {
    if (changeSet?.status !== 'applied') throw new NarraivaProjectError('INVALID_CHANGE_SET', '该 Change Set 不能撤销。')
    const current = await this.readDocument(changeSet.path)
    if (current.revision !== changeSet.appliedRevision || current.content !== changeSet.afterContent) throw new NarraivaProjectError('WRITE_CONFLICT', `${changeSet.path} 在应用后又发生了变化，未执行撤销。`)
    const saved = await this.saveDocument(changeSet.path, changeSet.beforeContent, current.revision)
    return { ...changeSet, status: 'rolled_back', rolledBackAt: Date.now(), rolledBackRevision: saved.revision }
  }
  async applyChangeSetAndSaveManifest(proposal, nextContent, manifest, handledProposalIds = []) {
    const applied = await this.applyChangeSet(proposal, nextContent)
    const next = { ...manifest, review: { proposal: null, changeSet: applied, handledProposalIds: [...new Set([...handledProposalIds, proposal.id])] } }
    try { await this.saveManifest(next); return { changeSet: applied, manifest: next } }
    catch (cause) { try { await this.saveDocument(applied.path, applied.beforeContent, applied.appliedRevision) } catch (rollbackCause) { throw new NarraivaProjectError('CHANGE_SET_ROLLBACK_FAILED', `无法保存 Change Set 记录，且 ${applied.path} 的补偿回滚失败。稿件可能已经改变，请立即检查文件并从编辑器中的原稿副本恢复。`, rollbackCause) } throw new NarraivaProjectError('CHANGE_SET_RECORD_FAILED', '无法保存 Change Set 记录；稿件修改已回滚。', cause) }
  }
  async undoChangeSetAndSaveManifest(changeSet, manifest, handledProposalIds = []) {
    const undone = await this.undoChangeSet(changeSet)
    const next = { ...manifest, review: { proposal: null, changeSet: undone, handledProposalIds } }
    try { await this.saveManifest(next); return { changeSet: undone, manifest: next } }
    catch (cause) { try { await this.saveDocument(changeSet.path, changeSet.afterContent, undone.rolledBackRevision) } catch (rollbackCause) { throw new NarraivaProjectError('CHANGE_SET_ROLLBACK_FAILED', `无法保存撤销记录，且 ${changeSet.path} 的补偿恢复失败。文件可能仍处于撤销后的状态，请立即检查稿件。`, rollbackCause) } throw new NarraivaProjectError('CHANGE_SET_RECORD_FAILED', '无法保存撤销记录；稿件已恢复到撤销前状态。', cause) }
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
