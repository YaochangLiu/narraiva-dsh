window.__ModuleLoader__.load({ id: "@narraiva/dsh", factory: (require) => { var module = { exports: {} }; var exports = module.exports;

var __modules = {"./project-domain.cjs": function(module, exports, require) {
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
  return { version: PROJECT_VERSION, id, name: title, documents: [{ id: documentId, title: 'Chapter 1', path: 'manuscript/chapter_001.md', order: 0 }], activeDocumentId: documentId, createdAt: now, updatedAt: now }
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

},
"./project-adapter.cjs": function(module, exports, require) {
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

},
"./ask-context.cjs": function(module, exports, require) {
const SUPPORTED = Object.freeze({ '@当前章节': 'current_document', '@选中文本': 'selection' })
const UNSUPPORTED = /@(故事记忆|设定与大纲|风格指南|全文)/u
const MENTION = /@(当前章节|选中文本)/gu

function parseContextMentions(input = '') {
  const unsupported = String(input).match(UNSUPPORTED)
  if (unsupported) throw new Error(`${unsupported[0]} 在 Phase 2 暂不支持。`)
  const found = []; const seen = new Set()
  for (const match of String(input).matchAll(MENTION)) { const type = SUPPORTED[match[0]]; if (!seen.has(type)) { seen.add(type); found.push(type) } }
  return found
}

function cleanQuestion(input) { return String(input || '').replace(MENTION, '').replace(/\s+/gu, ' ').trim() }

function snapshotRevision(text) {
  let hash = 2166136261
  for (const character of String(text || '')) { hash ^= character.codePointAt(0); hash = Math.imul(hash, 16777619) }
  return `snapshot:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function buildContextReceipt({ document, content, revision, selection, input = '', includeCurrent = true }) {
  if (!document) throw new Error('请先打开一个章节。')
  const requested = parseContextMentions(input)
  const wantsSelection = requested.includes('selection')
  const wantsCurrent = requested.includes('current_document')
  if (wantsSelection && !selection) throw new Error('请先在编辑器中选择文本，再引用 @选中文本。')
  if (!wantsSelection && !includeCurrent && !wantsCurrent) return { version: 1, createdAt: Date.now(), items: [] }
  const type = wantsSelection ? 'selection' : 'current_document'
  const text = wantsSelection ? selection : content
  return { version: 1, createdAt: Date.now(), items: [{ type, label: wantsSelection ? '选中文本' : '当前章节', path: document.path, characterCount: text.length, revision: snapshotRevision(text), diskRevision: revision }] }
}

function buildAskPrompt({ input, receipt, content, selection }) {
  const question = cleanQuestion(input)
  if (question.length < 2) throw new Error('请输入至少两个字符的问题。')
  const item = receipt.items[0]
  const context = item?.type === 'selection' ? selection : content
  return [
    '[NARRAIVA_ASK_V1]',
    `[NARRAIVA_META_V1]${encodeURIComponent(JSON.stringify({ question, receipt }))}`,
    '你处于 Narraiva Ask 只读分析模式。只能讨论、分析、解释、澄清或给出聊天中的示例。',
    '不得声称读取了未提供的文件，不得声称已经修改稿件，不得生成可直接应用的 Proposal，也不得调用写入工具。',
    '',
    '上下文清单：',
    item ? `- ${item.label} | ${item.path} | ${item.characterCount} 字符 | revision ${item.revision}` : '- 无（仅发送用户问题）',
    ...(item ? ['', `<context type="${item.type}" path="${item.path}">`, context, '</context>'] : []),
    '', '用户问题：', question,
  ].join('\n')
}

module.exports = { buildAskPrompt, buildContextReceipt, cleanQuestion, parseContextMentions, snapshotRevision }

},
"./write-context.cjs": function(module, exports, require) {
const { buildContextReceipt, cleanQuestion } = require('./ask-context.cjs')

function buildWritePrompt({ input, document, content, revision, selection, selectionStart, activeProposal }) {
  const receipt = buildContextReceipt({ document, content, revision, selection, input, includeCurrent: true })
  const question = cleanQuestion(input)
  if (question.length < 2) throw new Error('请输入至少两个字符的写作要求。')
  const selected = receipt.items[0]?.type === 'selection'
  const sourceText = selected ? selection : content
  const sourceStart = selected ? selectionStart : 0
  if (selected && (!Number.isInteger(sourceStart) || sourceStart < 0 || content.slice(sourceStart, sourceStart + selection.length) !== selection)) throw new Error('编辑器选区位置已经失效，请重新选择文本。')
  const metadata = { question, receipt, source: { path: document.path, content, diskRevision: revision, startOffset: sourceStart, endOffset: sourceStart + sourceText.length } }
  return ['[NARRAIVA_WRITE_V1]', `[NARRAIVA_META_V1]${encodeURIComponent(JSON.stringify(metadata))}`, '只返回一个结构化 Proposal，不得声称已写入文件。', '输出格式必须是：', '<NARRAIVA_PROPOSAL_V1>', '{"summary":"...","rationale":"...","changes":[{"filePath":"...","startOffset":0,"endOffset":0,"beforeText":"...","afterText":"..."}]}', '</NARRAIVA_PROPOSAL_V1>', '所有 offset 均相对于下方完整文件内容。beforeText 必须与范围内原文完全一致。', ...(activeProposal ? ['这是对当前待审 Proposal 的继续修改；请返回完整替代 Proposal：', JSON.stringify({ summary: activeProposal.summary, rationale: activeProposal.rationale, changes: activeProposal.changes })] : []), `<document path="${document.path}">`, content, '</document>', '写作要求：', question].join('\n')
}

module.exports = { buildWritePrompt }

},
"./proposal-domain.cjs": function(module, exports, require) {
const { NarraivaProjectError, validateProjectPath } = require('./project-domain.cjs')

function proposalId(source, text) { let hash = 2166136261; for (const character of `${source.path}\0${source.diskRevision}\0${text}`) { hash ^= character.codePointAt(0); hash = Math.imul(hash, 16777619) } return `proposal-${(hash >>> 0).toString(16).padStart(8, '0')}` }
function parseProposal(text, source) {
  const match = /<NARRAIVA_PROPOSAL_V1>\s*([\s\S]*?)\s*<\/NARRAIVA_PROPOSAL_V1>/u.exec(String(text || ''))
  if (!match) return null
  let value
  try { value = JSON.parse(match[1]) } catch (cause) { throw new NarraivaProjectError('INVALID_PROPOSAL', 'DeepSeek 返回的 Proposal 不是有效 JSON。', cause) }
  const changes = Array.isArray(value.changes) ? value.changes : []
  if (!changes.length) throw new NarraivaProjectError('INVALID_PROPOSAL', 'Proposal 没有可审阅的修改。')
  const normalized = changes.map((change, index) => {
    const filePath = validateProjectPath(change.filePath || source.path)
    if (filePath !== source.path) throw new NarraivaProjectError('UNAUTHORIZED_PROPOSAL_PATH', 'Phase 3 只允许修改本次明确发送的文档。')
    const beforeText = String(change.beforeText ?? '')
    const afterText = String(change.afterText ?? '')
    const startOffset = Number(change.startOffset)
    const endOffset = Number(change.endOffset)
    if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || startOffset < 0 || endOffset < startOffset || endOffset > source.content.length || source.content.slice(startOffset, endOffset) !== beforeText) throw new NarraivaProjectError('INVALID_PROPOSAL_RANGE', `Proposal 修改 ${index + 1} 与发送给 DeepSeek 的文本快照不匹配。`)
    if (Number.isInteger(source.startOffset) && (startOffset < source.startOffset || endOffset > source.endOffset)) throw new NarraivaProjectError('OUTSIDE_AUTHORIZED_RANGE', `Proposal 修改 ${index + 1} 超出了作者明确选择的文本范围。`)
    return { id: `${index + 1}`, filePath, beforeText, afterText, startOffset, endOffset, expectedRevision: source.diskRevision, status: 'pending' }
  })
  const ordered = [...normalized].sort((a, b) => a.startOffset - b.startOffset)
  if (ordered.some((item, index) => index && item.startOffset < ordered[index - 1].endOffset)) throw new NarraivaProjectError('OVERLAPPING_CHANGES', 'Proposal 包含相互重叠的修改。')
  if (ordered.some((item, index) => index && item.startOffset === item.endOffset && item.startOffset === ordered[index - 1].startOffset && ordered[index - 1].startOffset === ordered[index - 1].endOffset)) throw new NarraivaProjectError('AMBIGUOUS_INSERTIONS', 'Proposal 不能在同一位置包含多项插入。')
  return { id: proposalId(source, match[1]), version: 1, status: 'pending', summary: String(value.summary || '写作建议'), rationale: String(value.rationale || ''), changes: normalized, source, createdAt: Date.now() }
}

function materialize(content, changes) {
  return [...changes].filter(change => change.status !== 'rejected').sort((a, b) => b.startOffset - a.startOffset).reduce((next, change) => `${next.slice(0, change.startOffset)}${change.afterText}${next.slice(change.endOffset)}`, content)
}
function setChangeStatus(proposal, id, status) { return { ...proposal, changes: proposal.changes.map(change => change.id === id ? { ...change, status } : change) } }
function recoverStoredProposal(stored) {
  if (stored?.version !== 1 || !Array.isArray(stored.changes)) return null
  try {
    const raw = JSON.stringify({ summary: stored.summary, rationale: stored.rationale, changes: stored.changes })
    const checked = parseProposal(`<NARRAIVA_PROPOSAL_V1>${raw}</NARRAIVA_PROPOSAL_V1>`, stored.source)
    return { ...checked, id: stored.id, createdAt: stored.createdAt, status: stored.status, changes: checked.changes.map((change, index) => ({ ...change, status: stored.changes[index].status === 'rejected' ? 'rejected' : 'pending' })) }
  } catch { return null }
}
function recoverReview(value) {
  if (!value || typeof value !== 'object') return { proposal: null, changeSet: null }
  const proposal = recoverStoredProposal(value.proposal)
  const terminal = value.changeSet
  const safeProposal = recoverStoredProposal(terminal?.proposal)
  const legacyUndoStatus = ['applied', 'rolled_back'].includes(terminal?.status) || (terminal?.status === 'conflicted' && terminal?.conflictOperation === 'undo')
  const legacyUndo = legacyUndoStatus && typeof terminal?.beforeContent === 'string' && typeof terminal?.afterContent === 'string' && typeof terminal?.appliedRevision === 'string'
  const terminalShape = terminal?.proposalId && ['applied', 'rolled_back', 'rejected', 'conflicted'].includes(terminal.status) && typeof terminal.path === 'string'
  const changeSet = terminalShape && (safeProposal || legacyUndo) ? { ...terminal, ...(safeProposal ? { proposal: safeProposal } : {}) } : null
  return { proposal, changeSet }
}

module.exports = { materialize, parseProposal, recoverReview, setChangeStatus }

},
"./patch-view.cjs": function(module, exports, require) {
function lineAt(content, offset) { let line = 1; for (let index = 0; index < offset; index++) if (content.charCodeAt(index) === 10) line++; return line }

function buildPatchView(content, changes) {
  const active = changes.filter(change => change.status !== 'rejected').toSorted((a, b) => a.startOffset - b.startOffset)
  const segments = []; let cursor = 0
  for (const change of active) {
    if (change.startOffset > cursor) segments.push({ type: 'equal', text: content.slice(cursor, change.startOffset), startOffset: cursor, endOffset: change.startOffset })
    segments.push({ type: 'change', change: { ...change, startLine: lineAt(content, change.startOffset), endLine: lineAt(content, change.endOffset) } })
    cursor = change.endOffset
  }
  if (cursor < content.length) segments.push({ type: 'equal', text: content.slice(cursor), startOffset: cursor, endOffset: content.length })
  return { segments, changeCount: active.length }
}

function changeSummary(change) { const inserted = change.afterText.length; const deleted = change.beforeText.length; return `${change.startOffset === change.endOffset ? '插入' : '替换'} · +${inserted} −${deleted} 字符` }

module.exports = { buildPatchView, changeSummary, lineAt }

},
"./proposal-review.cjs": function(module, exports, require) {
const React = require('react')
const { buildPatchView, changeSummary } = require('./patch-view.cjs')
const { setChangeStatus } = require('./proposal-domain.cjs')

function h(type, props, ...children) { return React.createElement(type, props, ...children) }

function PatchReviewSurface({ proposal, activeChangeId, onActiveChange, onApply, onReject }) {
  const view = buildPatchView(proposal.source.content, proposal.changes)
  React.useEffect(() => { if (!activeChangeId) return; document.querySelector(`[data-patch-id="${activeChangeId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [activeChangeId])
  return h('div', { className: 'nv-review', 'aria-label': '正文内 Patch 审阅' },
    h('div', { className: 'nv-review-doc' }, view.segments.map((segment, index) => segment.type === 'equal'
      ? h('span', { className: 'nv-review-equal', key: `equal-${index}` }, segment.text)
      : h('span', { className: `nv-inline-patch${segment.change.id === activeChangeId ? ' is-active' : ''}`, key: segment.change.id, 'data-patch-id': segment.change.id, onClick: () => onActiveChange(segment.change.id) },
        h('span', { className: 'nv-inline-patch-meta' }, h('strong', null, `Change ${segment.change.id}`), h('span', null, `第 ${segment.change.startLine} 行 · ${changeSummary(segment.change)}`)),
        segment.change.beforeText && h('del', null, segment.change.beforeText), segment.change.afterText && h('ins', null, segment.change.afterText)))),
    h('div', { className: 'nv-review-toolbar' }, h('button', { className: 'nv-primary', disabled: view.changeCount === 0, onClick: onApply }, `接受 ${view.changeCount} 项修改`), h('button', { className: 'nv-secondary', onClick: onReject }, '拒绝 Proposal')))
}

function ProposalCard({ proposal, changeSet, onProposal, onApply, onReject, onUndo, activeChangeId, onActiveChange }) {
  const displayProposal = proposal || changeSet?.proposal
  const status = proposal ? '待审阅' : changeSet?.status === 'applied' ? '已接受' : changeSet?.status === 'rolled_back' ? '已撤销' : changeSet?.status === 'rejected' ? '已拒绝' : changeSet?.status === 'conflicted' ? '存在冲突' : '已处理'
  const fallback = changeSet?.status === 'applied' ? '修改已经由作者确认并写入本地稿件。' : changeSet?.status === 'rejected' ? '作者拒绝了这份 Proposal，稿件没有变化。' : changeSet?.status === 'conflicted' ? (changeSet.conflictOperation === 'undo' ? '稿件在应用后又发生了变化，撤销没有执行；请先检查外部修改。' : '稿件在 Proposal 生成后发生了变化，Proposal 修改没有应用。') : '稿件已经恢复到应用前状态。'
  const description = changeSet?.status === 'conflicted' ? fallback : displayProposal?.rationale || fallback
  React.useEffect(() => { if (!activeChangeId) return; document.querySelector(`[data-proposal-change-id="${activeChangeId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [activeChangeId])
  return h('section', { className: 'nv-proposal', 'aria-label': 'Proposal 审阅卡片' },
    h('div', { className: 'nv-proposal-head' }, h('div', null, h('h3', null, displayProposal?.summary || '写作 Proposal'), h('p', null, description)), h('span', { className: 'nv-proposal-badge' }, status)),
    (Array.isArray(displayProposal?.changes) ? displayProposal.changes : []).map(change => h('div', { className: `nv-change${change.status === 'rejected' ? ' is-rejected' : ''}${change.id === activeChangeId ? ' is-active' : ''}`, key: change.id, 'data-proposal-change-id': change.id, onClick: () => proposal && onActiveChange(change.id) },
      h('div', { className: 'nv-change-meta' }, h('strong', null, `Change ${change.id}`), h('span', null, changeSummary(change))), change.beforeText && h('del', null, `− ${change.beforeText}`), change.afterText && h('ins', null, `＋ ${change.afterText}`),
      proposal && h('button', { className: 'nv-mini', onClick: event => { event.stopPropagation(); onProposal(setChangeStatus(proposal, change.id, change.status === 'rejected' ? 'pending' : 'rejected')) } }, change.status === 'rejected' ? '恢复此项' : '拒绝此项'))),
    proposal && h('div', { className: 'nv-proposal-actions' }, h('button', { className: 'nv-primary', disabled: !proposal.changes.some(change => change.status !== 'rejected'), onClick: onApply }, '接受剩余修改'), h('button', { className: 'nv-secondary', onClick: onReject }, '拒绝 Proposal')),
    changeSet?.status === 'applied' && h('div', { className: 'nv-proposal-actions' }, h('button', { className: 'nv-secondary', onClick: onUndo }, '撤销此次修改')))
}

module.exports = { PatchReviewSurface, ProposalCard }

},
"./conversation-adapter.cjs": function(module, exports, require) {
function textContent(content = []) { return content.filter(block => block.type === 'text').map(block => block.text).join('\n') }
function assistantText(blocks = []) { return blocks.filter(block => block.kind === 'text').map(block => block.text).join('') }
function requestMetadata(prompt) { const match = /^\[NARRAIVA_META_V1\](.+)$/mu.exec(prompt); if (!match) return null; try { return JSON.parse(decodeURIComponent(match[1])) } catch { return null } }
function displayQuestion(prompt) { const metadata = requestMetadata(prompt); if (typeof metadata?.question === 'string') return metadata.question; const marker = '\n用户问题：\n'; const index = prompt.lastIndexOf(marker); return index < 0 ? prompt : prompt.slice(index + marker.length).trim() }
function contextSummary(prompt) { const metadata = requestMetadata(prompt); const item = metadata?.receipt?.items?.[0]; if (metadata) return item ? `${item.label} | ${item.path} | ${item.characterCount} 字符 | revision ${item.revision}` : '无上下文'; const match = /上下文清单：\n- ([^\n]+)/u.exec(prompt); return match?.[1] === '无（仅发送用户问题）' ? '无上下文' : match?.[1] }
function proposalEnvelope(raw) { return /<NARRAIVA_PROPOSAL_V1>[\s\S]*?<\/NARRAIVA_PROPOSAL_V1>/u.exec(raw)?.[0] }
function assistantMessage(node, proposalProtocol = true) { const raw = assistantText(node.blocks); if (!proposalProtocol) return { id: `dsh-${node.seq}`, kind: 'message', role: 'assistant', content: raw, status: node.interrupted ? 'cancelled' : 'done', createdAt: node.time, model: node.provenance?.model }; const envelope = proposalEnvelope(raw); const opening = raw.indexOf('<NARRAIVA_PROPOSAL_V1>'); const protocol = opening >= 0; const content = protocol ? raw.slice(0, opening).trim() : raw; return { id: `dsh-${node.seq}`, kind: !content && protocol ? 'proposal-protocol' : 'message', role: 'assistant', content, protocolContent: envelope || (protocol ? raw.slice(opening) : undefined), status: node.interrupted ? 'cancelled' : 'done', createdAt: node.time, model: node.provenance?.model } }

function projectConversationSnapshot(snapshot, options = {}) {
  const proposalProtocol = options.proposalProtocol !== false
  const messages = []
  for (const node of snapshot.nodes || []) {
    if (node.kind === 'user' || node.kind === 'steering') { const prompt = textContent(node.content); messages.push({ id: `dsh-${node.seq}`, role: 'user', content: displayQuestion(prompt), contextSummary: contextSummary(prompt), requestMetadata: requestMetadata(prompt), status: 'done', createdAt: node.time }) }
    if (node.kind === 'assistant') messages.push(assistantMessage(node, proposalProtocol))
    if (node.kind === 'turn-error') messages.push({ id: `dsh-${node.seq}`, role: 'assistant', content: errorMessage(node.code, node.message), status: 'error', createdAt: node.time, errorCode: node.code })
  }
  if (snapshot.partial) { const raw = assistantText(snapshot.partial.blocks); const protocol = proposalProtocol && raw.includes('<NARRAIVA_PROPOSAL'); messages.push({ id: `partial-${snapshot.partial.turn}-${snapshot.partial.step}`, kind: protocol ? 'proposal-streaming' : 'message', role: 'assistant', content: protocol ? '正在整理可审阅的 Proposal…' : raw, status: 'streaming', createdAt: Date.now() }) }
  const promptError = snapshot.promptError ? { op: snapshot.promptError.op, message: errorMessage(snapshot.promptError.error?.code, snapshot.promptError.error?.message) } : null
  return { messages, running: Boolean(snapshot.running), promptError, openState: snapshot.openState, hasMore: Boolean(snapshot.hasMore), loadingOlder: Boolean(snapshot.loadingOlder) }
}

function errorMessage(code, fallback) {
  if (/unauthorized|credential|provider|api.?key/i.test(`${code} ${fallback}`)) return '请先在 DSH 中配置 DeepSeek 凭据，然后重试。'
  if (/rate|quota|credit/i.test(`${code} ${fallback}`)) return 'DeepSeek 暂时限制了请求或额度不足，请稍后重试。'
  if (/context|token/i.test(`${code} ${fallback}`)) return '当前上下文超过模型容量，请减少引用内容。'
  return fallback || 'DSH 请求失败，请重试。'
}

class NarraivaConversationAdapter {
  constructor({ sessions, api }) { this.sessions = sessions; this.api = api }
  async ensureProjectSession(manifest) {
    let sessionId = manifest.conversation?.activeId
    if (!sessionId || !this.sessions.binding(sessionId)) sessionId = await this.sessions.create({})
    let row = this.sessions.list?.getSnapshot?.().byId?.[sessionId]
    if (row?.blank === false && row?.agentPreset !== 'narraiva-ask') { sessionId = await this.sessions.create({}); row = this.sessions.list?.getSnapshot?.().byId?.[sessionId] }
    if (row?.agentPreset !== 'narraiva-ask') {
      if (row?.blank === false) throw new Error('当前 DSH 对话不是 Narraiva Ask，且不能在已有历史后切换 preset。')
      if (!this.api.agentPresets?.select) throw new Error('DSH 未提供 Ask preset 绑定能力，已停止发送。')
      const response = await this.api.agentPresets.select({ sessionId, agentPreset: 'narraiva-ask' })
      if (!response.result?.ok) throw new Error(errorMessage(response.result?.error?.code, response.result?.error?.message))
      this.sessions.noteAgentPreset?.(sessionId, 'narraiva-ask')
    }
    this.sessions.open?.(sessionId)
    const ids = [...new Set([...(manifest.conversation?.ids || []), sessionId])]
    return { sessionId, manifest: { ...manifest, conversation: { ...(manifest.conversation || {}), ids, activeId: sessionId } } }
  }
  async ensureModeSession(manifest, mode = 'ask') {
    if (mode === 'ask') return this.ensureProjectSession(manifest)
    const preset = 'narraiva-writer'
    let sessionId = manifest.conversation?.writeId
    if (!sessionId || !this.sessions.binding(sessionId)) sessionId = await this.sessions.create({})
    const row = this.sessions.list?.getSnapshot?.().byId?.[sessionId]
    if (row?.blank === false && row?.agentPreset !== preset) throw new Error('当前 DSH 对话不是 Narraiva Write，已停止发送。')
    if (row?.agentPreset !== preset) {
      if (!this.api.agentPresets?.select) throw new Error('DSH 未提供 Write preset 绑定能力，已停止发送。')
      const response = await this.api.agentPresets.select({ sessionId, agentPreset: preset })
      if (!response.result?.ok) throw new Error(errorMessage(response.result?.error?.code, response.result?.error?.message))
      this.sessions.noteAgentPreset?.(sessionId, preset)
    }
    this.sessions.open?.(sessionId)
    return { sessionId, manifest: { ...manifest, conversation: { ...(manifest.conversation || {}), writeId: sessionId } } }
  }
  async createProjectSession(manifest) { const sessionId = await this.sessions.create({}); return this.ensureProjectSession({ ...manifest, conversation: { ...(manifest.conversation || {}), activeId: sessionId } }) }
  async createModeSession(manifest, mode) { if (mode === 'ask') return this.createProjectSession(manifest); const sessionId = await this.sessions.create({}); return this.ensureModeSession({ ...manifest, conversation: { ...(manifest.conversation || {}), writeId: sessionId } }, 'write') }
  openProjectSession(manifest, sessionId) { if (!(manifest.conversation?.ids || []).includes(sessionId)) throw new Error('该对话不属于当前项目。'); if (!this.sessions.binding(sessionId)) throw new Error('DSH 对话暂不可用。'); const row = this.sessions.list?.getSnapshot?.().byId?.[sessionId]; if (row?.agentPreset !== 'narraiva-ask') throw new Error('该对话不是 Narraiva Ask，已停止打开。'); this.sessions.open?.(sessionId); return { ...manifest, conversation: { ...manifest.conversation, activeId: sessionId } } }
  listProjectSessions(manifest) { const rows = this.sessions.list?.getSnapshot?.().byId || {}; return (manifest.conversation?.ids || []).filter(id => this.sessions.binding(id)).map(id => ({ id, title: rows[id]?.displayTitle || rows[id]?.title || `对话 ${id.slice(0, 8)}`, running: Boolean(rows[id]?.running) })) }
  face(sessionId) { const face = this.sessions.binding(sessionId)?.session; if (!face) throw new Error('DSH 会话不可用，请新建对话。'); return face }
  subscribe(sessionId, listener, options) { const face = this.face(sessionId); listener(projectConversationSnapshot(face.getSnapshot(), options)); return face.subscribe(() => listener(projectConversationSnapshot(face.getSnapshot(), options))) }
  async send(sessionId, prompt) { const result = await this.face(sessionId).prompt([{ type: 'text', text: prompt }], 'queue'); if (!result.ok) throw new Error(errorMessage(result.error.code, result.error.message)) }
  async cancel(sessionId) { const result = await this.face(sessionId).cancel(); if (!result.ok) throw new Error(errorMessage(result.error.code, result.error.message)) }
  async loadOlder(sessionId) { await this.face(sessionId).loadOlder() }
}

module.exports = { NarraivaConversationAdapter, contextSummary, displayQuestion, errorMessage, projectConversationSnapshot, requestMetadata }

},
"./index.cjs": function(module, exports, require) {
const React = require('react')
const { NarraivaProjectAdapter } = require('./project-adapter.cjs')
const { addDocument, removeDocument, renameDocument, reorderDocument } = require('./project-domain.cjs')
const { buildAskPrompt, buildContextReceipt } = require('./ask-context.cjs')
const { buildWritePrompt } = require('./write-context.cjs')
const { materialize, parseProposal, recoverReview } = require('./proposal-domain.cjs')
const { PatchReviewSurface, ProposalCard } = require('./proposal-review.cjs')
const { NarraivaConversationAdapter } = require('./conversation-adapter.cjs')

const PLUGIN_ID = '@narraiva/dsh'
const MODES = Object.freeze([
  { id: 'ask', label: '思考', description: '讨论、分析与澄清' },
  { id: 'write', label: '写作', description: '生成作者可审阅的 Proposal' },
])

const narraivaStyles = `
  :root { color-scheme: light; }
  .narraiva-spike { --nv-bg:#f7f4ee; --nv-panel:#f8f5f0; --nv-editor:#fffdfa; --nv-elevated:#fbfaf7; --nv-border:#e6dfd5; --nv-text:#292827; --nv-secondary:#756f68; --nv-muted:#a19a91; --nv-accent:#c77538; --nv-accent-soft:#f0e4d8; --nv-success:#5aa56f; position:fixed; inset:0; z-index:1000; min-height:100dvh; display:grid; grid-template-rows:46px minmax(0,1fr) 30px; overflow:hidden; background:var(--nv-bg); color:var(--nv-text); font-family:Inter,"Segoe UI","Microsoft YaHei",system-ui,sans-serif; }
  .narraiva-spike *,.narraiva-spike *::before,.narraiva-spike *::after { box-sizing:border-box; }
  .nv-topbar,.nv-statusbar { display:flex; align-items:center; border-color:var(--nv-border); background:var(--nv-panel); }
  .nv-topbar { gap:24px; padding:0 18px; border-bottom:1px solid var(--nv-border); }.nv-topbar::before { color:var(--nv-secondary); content:"←　文件　 编辑　 视图　 帮助"; font-size:13px; white-space:pre; }.nv-brand { color:var(--nv-text); font:700 16px/1 Inter,"Segoe UI",sans-serif; letter-spacing:.01em; }.nv-spike-label { margin-right:auto; color:var(--nv-secondary); font-size:13px; }.nv-spike-label::before { content:"— the-zero-crown　"; }.nv-workbench { min-height:0; display:grid; grid-template-columns:292px minmax(0,1fr) 350px; }.nv-sidebar,.nv-assistant { min-height:0; background:var(--nv-panel); }.nv-sidebar { display:flex; flex-direction:column; border-right:1px solid var(--nv-border); }.nv-project { display:flex; justify-content:space-between; align-items:flex-start; min-height:157px; padding:30px 20px; border-bottom:1px solid var(--nv-border); }.nv-project strong { color:var(--nv-text); font:700 31px/1 Georgia,"Times New Roman",serif; }.nv-project::after { position:absolute; margin-top:44px; color:var(--nv-secondary); content:"the-zero-crown"; font-size:13px; }.nv-icon-button,.nv-mode { border:0; color:var(--nv-secondary); background:transparent; font:inherit; cursor:pointer; }.nv-icon-button { width:28px; height:28px; border-radius:6px; font-size:20px; line-height:1; }.nv-icon-button:hover,.nv-icon-button:focus-visible { background:#f1ebe3; color:var(--nv-text); outline:none; }.nv-sidebar-label { padding:20px 18px 8px; color:#413d39; font-size:15px; font-weight:700; }
  .nv-add-chapter { width:auto; min-height:34px; margin:12px 18px 16px; padding:0 14px; border:0; border-radius:999px; color:var(--nv-accent); background:#faf1e8; font:600 13px/1 Inter,"Segoe UI",sans-serif; cursor:pointer; }.nv-add-chapter:hover { background:var(--nv-accent-soft); }.nv-chapter { position:relative; width:calc(100% - 18px); margin:4px 9px; padding:11px 14px 11px 31px; border:0; border-radius:7px; color:#6d6760; background:transparent; text-align:left; font-size:14px; cursor:pointer; }.nv-chapter::before { position:absolute; left:17px; top:50%; width:5px; height:5px; border-radius:50%; background:#c9c2ba; content:""; transform:translateY(-50%); }.nv-chapter:hover { color:var(--nv-text); background:#f5eee7; }.nv-chapter.is-active { border-left:3px solid var(--nv-accent); padding-left:28px; color:var(--nv-accent); background:var(--nv-accent-soft); }.nv-chapter.is-active::before { background:var(--nv-accent); box-shadow:0 0 0 5px rgba(199,117,56,.09); }.nv-sidebar-foot { margin-top:auto; padding:16px 18px; color:var(--nv-secondary); border-top:1px solid var(--nv-border); font-size:12px; }.nv-editor { min-width:0; overflow:auto; padding:48px 58px; background:var(--nv-editor); }.nv-editor-inner { max-width:840px; margin:0 auto; }.nv-kicker { color:var(--nv-accent); font:500 16px/1.7 "SFMono-Regular",Consolas,monospace; }.nv-editor h1 { margin:12px 0 32px; color:var(--nv-accent); font:500 25px/1.4 "SFMono-Regular",Consolas,monospace; }.nv-copy { max-width:820px; color:#252321; font:400 17px/1.9 "SFMono-Regular",Consolas,monospace; }.nv-copy p { margin:0 0 24px; }.nv-spike-note { margin-top:50px; padding-top:22px; border-top:1px solid var(--nv-border); color:var(--nv-secondary); font-size:13px; line-height:1.7; }.nv-spike-note strong { display:block; margin-bottom:4px; color:var(--nv-text); font-weight:600; }
  button:disabled{opacity:.48;cursor:not-allowed}
  .nv-assistant { display:flex; flex-direction:column; border-left:1px solid var(--nv-border); padding:0; }.nv-mode-switch { display:grid; grid-template-columns:1fr 1fr; padding:0; border-bottom:1px solid var(--nv-border); border-radius:0; background:transparent; }.nv-mode { min-height:52px; border-bottom:3px solid transparent; border-radius:0; font-size:14px; }.nv-mode:hover { color:var(--nv-text); }.nv-mode.is-active { border-color:var(--nv-accent); color:var(--nv-accent); background:transparent; box-shadow:none; }.nv-connection { display:flex; align-items:center; gap:8px; margin:14px 18px; color:var(--nv-secondary); font-size:12px; }.nv-dot { width:7px; height:7px; border-radius:50%; background:var(--nv-muted); }.nv-dot.is-connected { background:var(--nv-success); box-shadow:0 0 0 3px rgba(90,165,111,.12); }.nv-dot.is-reconnecting { background:var(--nv-accent); box-shadow:0 0 0 3px rgba(199,117,56,.12); }.nv-assistant-empty { flex:1; min-height:164px; display:block; padding:22px; border:0; border-top:1px solid var(--nv-border); border-radius:0; color:#3f3a36; text-align:left; font-size:14px; line-height:1.8; }.nv-assistant-empty span { display:inline; margin:0; color:var(--nv-secondary); font-size:12px; }.nv-composer { margin:0 14px 14px; padding:12px; border:1px solid #ebe5dc; border-radius:13px; background:var(--nv-elevated); }.nv-composer textarea { width:100%; min-height:72px; resize:none; border:0; outline:0; color:var(--nv-muted); background:transparent; font:13px/1.55 inherit; }.nv-composer-foot { display:flex; align-items:center; justify-content:space-between; color:var(--nv-muted); font-size:11px; }.nv-send { width:auto; height:29px; padding:0 12px; border:0; border-radius:8px; color:white; background:#d9ad89; cursor:not-allowed; }
  .nv-statusbar { gap:24px; padding:0 18px; border-top:1px solid var(--nv-border); color:var(--nv-muted); font-size:11px; }.nv-statusbar span:last-child { margin-left:auto; }
  @media (max-width:1100px) { .nv-workbench { grid-template-columns:220px minmax(0,1fr) 340px; } } @media (max-width:820px) { .nv-workbench { grid-template-columns:minmax(0,1fr) 340px; }.nv-sidebar { display:none; } } @media (max-width:620px) { .nv-workbench { grid-template-columns:1fr; }.nv-editor { display:none; }.nv-assistant{display:flex}.nv-statusbar { gap:12px; }.nv-statusbar span:nth-child(2) { display:none; } }
  .nv-welcome{grid-column:1/-1;display:grid;place-items:center;background:var(--nv-editor);padding:32px}.nv-welcome-card{width:min(560px,100%);padding:44px;border:1px solid var(--nv-border);border-radius:16px;background:var(--nv-elevated);box-shadow:0 18px 60px rgba(73,55,39,.08)}.nv-welcome-card h1{margin:0 0 10px;font:700 38px/1 Georgia,serif}.nv-welcome-card p{color:var(--nv-secondary);line-height:1.7}.nv-welcome-actions{display:flex;gap:10px;margin-top:28px}.nv-primary,.nv-secondary{min-height:38px;padding:0 16px;border:1px solid var(--nv-border);border-radius:9px;background:white;color:var(--nv-text);cursor:pointer}.nv-primary{border-color:var(--nv-accent);background:var(--nv-accent);color:white}.nv-error{margin-top:16px;padding:10px 12px;border-radius:8px;background:#fff0eb;color:#9d412e;font-size:12px}.nv-editor{display:flex;flex-direction:column;padding:0}.nv-editor-head{display:flex;align-items:center;justify-content:space-between;height:48px;padding:0 22px;border-bottom:1px solid var(--nv-border);color:var(--nv-secondary);font-size:12px}.nv-editor-surface{position:relative;flex:1;min-height:0;display:grid;grid-template-columns:52px minmax(0,1fr);overflow:auto;background:var(--nv-editor)}.nv-lines{padding:35px 10px;text-align:right;color:var(--nv-muted);font:13px/1.9 "SFMono-Regular",Consolas,monospace;white-space:pre;border-right:1px solid #f1ece5;user-select:none}.nv-manuscript{width:100%;min-height:100%;padding:34px 42px;border:0;outline:0;resize:none;background:transparent;color:#252321;font:16px/1.9 "SFMono-Regular",Consolas,monospace;tab-size:2}.nv-chapter-row{display:flex;align-items:center;margin:3px 8px;border-radius:7px}.nv-chapter-row.is-active{background:var(--nv-accent-soft);border-left:3px solid var(--nv-accent)}.nv-chapter-row .nv-chapter{flex:1;width:auto;margin:0}.nv-mini{border:0;background:transparent;color:var(--nv-muted);cursor:pointer;padding:5px}.nv-project::after{content:attr(data-project-name)}.nv-conflict{padding:8px 18px;background:#fff3e5;color:#914f1d;font-size:12px;border-bottom:1px solid #ebd0b6}.nv-save-error{color:#a13f32}.nv-busy{opacity:.65;pointer-events:none}
  .nv-assistant-head{display:flex;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--nv-border)}.nv-conversation-select{min-width:0;flex:1;height:34px;border:1px solid var(--nv-border);border-radius:8px;background:var(--nv-editor);padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nv-chat{flex:1;min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;padding:14px}.nv-chat>*{min-width:0;max-width:100%}.nv-chat-empty{display:grid;height:100%;place-content:center;color:var(--nv-muted);text-align:center;line-height:1.7}.nv-message{width:fit-content;max-width:92%;margin:0 0 12px;padding:10px 12px;border-radius:11px;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap;font-size:13px;line-height:1.65}.nv-message.user{margin-left:auto;background:var(--nv-accent-soft);color:#503524}.nv-message.assistant{background:var(--nv-elevated);border:1px solid var(--nv-border)}.nv-message.error{border-color:#e5b6a6;background:#fff3ef;color:#8d3d2b}.nv-message.streaming::after{content:'▋';color:var(--nv-accent);animation:nv-blink 1s infinite}.nv-context-row{display:flex;gap:6px;align-items:center;margin:0 14px 8px;color:var(--nv-muted);font-size:11px;overflow:hidden}.nv-context-chip{min-width:0;border:1px solid var(--nv-border);border-radius:999px;padding:4px 8px;background:var(--nv-editor);color:var(--nv-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nv-context-chip.off{text-decoration:line-through;opacity:.55}.nv-composer textarea:disabled{opacity:.55}.nv-composer-error{margin:8px 0;color:#9d412e;font-size:11px}.nv-stop{background:#8f6047}.nv-privacy{margin-top:6px;color:var(--nv-muted);font-size:10px;line-height:1.4}@keyframes nv-blink{50%{opacity:0}}
  .nv-receipt{display:block;margin-top:6px;color:var(--nv-muted);font-size:9px}.nv-markdown p{margin:0 0 8px}.nv-markdown p:last-child{margin-bottom:0}.nv-markdown pre{overflow:auto;padding:8px;border-radius:7px;background:#f2eee8;white-space:pre-wrap;font:11px/1.5 Consolas,monospace}.nv-markdown strong{font-weight:700}
  .nv-proposal{margin:12px 0;padding:14px;border:1px solid #d9b18f;border-radius:12px;background:#fffaf4;overflow:hidden}.nv-proposal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.nv-proposal h3{margin:0 0 4px;font-size:14px}.nv-proposal p{margin:0 0 8px;color:var(--nv-secondary);font-size:11px;overflow-wrap:anywhere}.nv-proposal-badge{flex:none;border-radius:999px;padding:3px 7px;background:#f4e4d6;color:var(--nv-accent);font-size:10px}.nv-change{margin:8px 0;padding:9px;border:1px solid var(--nv-border);border-radius:8px;background:white;font:11px/1.5 Consolas,monospace;cursor:pointer}.nv-change.is-rejected{opacity:.55}.nv-change-meta{display:flex;justify-content:space-between;gap:6px;margin-bottom:5px;color:var(--nv-muted);font:10px/1.4 sans-serif}.nv-change del,.nv-change ins{display:block;max-height:90px;overflow:auto;padding:4px;white-space:pre-wrap;overflow-wrap:anywhere}.nv-change del{color:#984737;background:#fff0ed}.nv-change ins{color:#376b47;background:#edf8f0;text-decoration:none}.nv-proposal-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.nv-review{flex:1;min-height:0;overflow:auto;background:var(--nv-editor);scroll-behavior:smooth}.nv-review-doc{max-width:860px;margin:0 auto;padding:34px 42px 100px;white-space:pre-wrap;overflow-wrap:anywhere;color:#252321;font:16px/1.9 "SFMono-Regular",Consolas,monospace}.nv-review-equal{white-space:pre-wrap}.nv-inline-patch{display:block;margin:8px -12px;padding:10px 12px;border-left:3px solid var(--nv-accent);border-radius:6px;background:#fff9f2;scroll-margin:80px 0}.nv-inline-patch.is-active{box-shadow:0 0 0 2px rgba(199,117,56,.25)}.nv-inline-patch-meta{display:flex;justify-content:space-between;margin-bottom:5px;color:var(--nv-secondary);font:11px/1.4 sans-serif}.nv-inline-patch del,.nv-inline-patch ins{display:block;padding:4px 7px;white-space:pre-wrap}.nv-inline-patch del{color:#984737;background:#fff0ed}.nv-inline-patch ins{color:#376b47;background:#edf8f0;text-decoration:none}.nv-review-toolbar{position:sticky;bottom:16px;display:flex;justify-content:center;gap:8px;width:max-content;max-width:calc(100% - 32px);margin:-72px auto 16px;padding:8px;border:1px solid var(--nv-border);border-radius:12px;background:rgba(255,253,250,.94);box-shadow:0 8px 30px rgba(73,55,39,.12);backdrop-filter:blur(10px)}
`

function h(type, props, ...children) { return React.createElement(type, props, ...children) }
function renderMessage(message) { if (message.role !== 'assistant') return [message.content, message.contextSummary && h('small', { className: 'nv-receipt', key: 'receipt' }, `已发送：${message.contextSummary}`)]; const parts = String(message.content || '').split(/(```[\s\S]*?```)/g); return h('div', { className: 'nv-markdown' }, parts.filter(Boolean).map((part, index) => part.startsWith('```') ? h('pre', { key: index }, part.replace(/^```[^\n]*\n?|```$/g, '')) : h('p', { key: index }, part.replace(/\*\*/g, '')))) }

function installStyles() {
  if (typeof document === 'undefined') return
  const selector = `style[data-plugin-css="${PLUGIN_ID}/spike-shell"]`
  if (document.querySelector(selector)) return
  const tag = document.createElement('style')
  tag.dataset.plugin = PLUGIN_ID
  tag.dataset.pluginCss = `${PLUGIN_ID}/spike-shell`
  tag.textContent = narraivaStyles
  document.head.appendChild(tag)
}

installStyles()

function sourceFor(connection) {
  const hostDescription = connection?.hostDescription
  if (!hostDescription || typeof hostDescription.getSnapshot !== 'function') return { getSnapshot: () => 'unavailable', subscribe: () => () => {} }
  return { getSnapshot: () => hostDescription.getSnapshot() ? 'connected' : 'reconnecting', subscribe: listener => hostDescription.subscribe(listener) }
}

function useConnectionState(source) { return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot) }
function connectionCopy(state) { return state === 'connected' ? 'DSH 本地连接已就绪' : state === 'reconnecting' ? '正在连接本地 DSH' : '本地 DSH 状态不可用' }

function rememberHandle(handle) {
  if (!globalThis.indexedDB) return Promise.resolve()
  return new Promise((resolve, reject) => { const open = indexedDB.open('narraiva-dsh', 1); open.onupgradeneeded = () => open.result.createObjectStore('workspace'); open.onerror = () => reject(open.error); open.onsuccess = () => { const tx = open.result.transaction('workspace', 'readwrite'); tx.objectStore('workspace').put(handle, 'last'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) } })
}
function recalledHandle() {
  if (!globalThis.indexedDB) return Promise.resolve(null)
  return new Promise((resolve) => { const open = indexedDB.open('narraiva-dsh', 1); open.onupgradeneeded = () => open.result.createObjectStore('workspace'); open.onerror = () => resolve(null); open.onsuccess = () => { const tx = open.result.transaction('workspace'); const request = tx.objectStore('workspace').get('last'); request.onsuccess = () => resolve(request.result || null); request.onerror = () => resolve(null) } })
}

function NarraivaTitleBar({ projectName }) {
  return h('header', { className: 'nv-topbar' },
    h('span', { className: 'nv-brand' }, 'Narraiva'),
    h('span', { className: 'nv-spike-label' }, projectName || '本地写作工作台'),
  )
}

function ProjectNavigator({ manifest, onManifest, onSelect, onError, adapter }) {
  const activeId = manifest.activeDocumentId
  async function mutate(action) { try { await action() } catch (cause) { onError(cause?.message || '项目操作失败。') } }
  async function add() { const title = prompt('章节名称', `Chapter ${manifest.documents.length + 1}`); if (!title) return; await mutate(async () => { const next = addDocument(manifest, title); const doc = next.documents.find(item => !manifest.documents.some(old => old.id === item.id)); await adapter.addDocumentAndSaveManifest(doc, `# ${doc.title}\n\n`, next); onManifest(next) }) }
  async function rename(doc) { const title = prompt('重命名章节', doc.title); if (!title) return; await mutate(async () => { const next = renameDocument(manifest, doc.id, title); await adapter.saveManifest(next); onManifest(next) }) }
  async function move(doc, delta) { await mutate(async () => { const next = reorderDocument(manifest, doc.id, delta); if (next === manifest) return; await adapter.saveManifest(next); onManifest(next) }) }
  async function remove(doc) { if (!confirm(`删除“${doc.title}”？此操作会删除本地文件。`)) return; await mutate(async () => { const next = removeDocument(manifest, doc.id); await adapter.deleteDocumentAndSaveManifest(doc.path, next); onManifest(next); if (next.activeDocumentId) onSelect(next.activeDocumentId) }) }
  return h('nav', { className: 'nv-sidebar', 'aria-label': '项目导航' },
    h('div', { className: 'nv-project', 'data-project-name': manifest.name },
      h('strong', null, 'Narraiva'),
      h('button', { className: 'nv-icon-button', type: 'button', 'aria-label': '刷新项目' }, '↻'),
    ),
    h('div', { className: 'nv-sidebar-label' }, `▤　正文　　${manifest.documents.length}　⌃`),
    h('button', { className: 'nv-add-chapter', type: 'button', 'aria-label': '新建章节', onClick: add }, '＋ 章节'),
    manifest.documents.map((doc, index) => h('div', { className: `nv-chapter-row${doc.id === activeId ? ' is-active' : ''}`, key: doc.id },
      h('button', { className: 'nv-chapter', type: 'button', onClick: () => onSelect(doc.id) }, doc.title),
      h('button', { className: 'nv-mini', title: '上移', disabled: index === 0, onClick: () => move(doc, -1) }, '↑'),
      h('button', { className: 'nv-mini', title: '下移', disabled: index === manifest.documents.length - 1, onClick: () => move(doc, 1) }, '↓'),
      h('button', { className: 'nv-mini', title: '重命名', onClick: () => rename(doc) }, '✎'),
      h('button', { className: 'nv-mini', title: '删除', onClick: () => remove(doc) }, '×'),
    )),
    h('div', { className: 'nv-sidebar-label' }, '⌘　设定与大纲　　9　⌄'),
    h('div', { className: 'nv-sidebar-label' }, '♧　故事记忆　　已就绪　●　⌃'),
    h('div', { className: 'nv-sidebar-foot' }, '•　概览　　•　人物　　•　事件　　•　关系　　•　时间线'),
  )
}

function ManuscriptEditor({ document, content, onChange, onSelection, saveState, conflict, error, proposal, activeChangeId, onActiveChange, onApply, onReject }) {
  const lines = Math.max(1, content.split('\n').length)
  return h('article', { className: 'nv-editor', 'aria-label': '稿件编辑器' },
    h('div', { className: 'nv-editor-head' }, h('span', null, document?.path || '未选择正文'), h('span', { className: saveState === 'error' ? 'nv-save-error' : '' }, saveState === 'dirty' ? '未保存' : saveState === 'saving' ? '正在保存…' : saveState === 'error' ? '保存失败' : '已保存')),
    conflict && h('div', { className: 'nv-conflict' }, '磁盘中的文件已被其他程序修改。Narraiva 已停止自动保存，以免覆盖外部内容。请复制当前草稿后重新打开项目。'),
    error && !conflict && h('div', { className: 'nv-conflict' }, error),
    proposal ? h(PatchReviewSurface, { proposal, activeChangeId, onActiveChange, onApply, onReject }) : h('div', { className: 'nv-editor-surface' },
      h('div', { className: 'nv-lines', 'aria-hidden': true }, Array.from({ length: lines }, (_, i) => i + 1).join('\n')),
      h('textarea', { className: 'nv-manuscript', value: content, disabled: !document || conflict, spellCheck: true, onChange: event => onChange(event.target.value), onSelect: event => onSelection({ text: event.target.value.slice(event.target.selectionStart, event.target.selectionEnd), start: event.target.selectionStart, end: event.target.selectionEnd }) }),
    ))
}

function AssistantPanel({ connectionState, mode, onModeChange, runtime, manifest, onManifest, document, content, revision, selection, proposal, onProposal, onApply, onReject, onUndo, changeSet, saveState, activeChangeId, onActiveChange }) {
  const [messages, setMessages] = React.useState([])
  const [input, setInput] = React.useState('')
  const [sessionId, setSessionId] = React.useState(manifest.conversation?.activeId || null)
  const [running, setRunning] = React.useState(false)
  const [error, setError] = React.useState('')
  const [includeCurrent, setIncludeCurrent] = React.useState(true)
  const [view, setView] = React.useState('conversation')
  const [hasMore, setHasMore] = React.useState(false)
  const [loadingOlder, setLoadingOlder] = React.useState(false)
  const lastInput = React.useRef('')
  const selectionText = selection?.text || ''
  const writeSource = React.useRef(null)
  React.useEffect(() => { let dispose = () => {}; let live = true; (async () => { try { const opened = await runtime.conversation.ensureModeSession(manifest, mode); if (!live) return; setSessionId(opened.sessionId); if (opened.manifest !== manifest) await onManifest(opened.manifest); dispose = runtime.conversation.subscribe(opened.sessionId, state => { setMessages(state.messages); setRunning(state.running); setHasMore(state.hasMore); setLoadingOlder(state.loadingOlder); const lastUser = [...state.messages].reverse().find(item => item.role === 'user'); if (lastUser) { lastInput.current = lastUser.content; if (lastUser.requestMetadata?.source?.content != null) writeSource.current = lastUser.requestMetadata.source } const last = state.messages[state.messages.length - 1]; if (mode === 'write' && last?.protocolContent && last.status === 'done' && writeSource.current) { try { const parsed = parseProposal(last.protocolContent, writeSource.current); if (!parsed) throw new Error('DeepSeek 返回了不完整的 Proposal，稿件未发生变化。'); setError(''); if (!manifest.review?.handledProposalIds?.includes(parsed.id) && parsed.id !== proposal?.id) onProposal(parsed) } catch (cause) { setError(cause.message) } } if (state.promptError) setError(state.promptError.message || 'DSH 请求失败。'); else if (last?.status === 'error') setError(last.content); else if (!state.running && !last?.protocolContent) setError('') }, { proposalProtocol: mode === 'write' }) } catch (cause) { if (live) setError(cause?.message || '无法打开 DSH 对话。') } })(); return () => { live = false; dispose() } }, [manifest.id, manifest.conversation?.activeId, manifest.conversation?.writeId, mode])
  async function send(value = input) { if (!sessionId || running) return; setError(''); try { let prompt; if (mode === 'write') { if (saveState !== 'saved') throw new Error('请等待当前稿件保存完成后再生成 Proposal。'); writeSource.current = { path: document.path, content, diskRevision: revision, startOffset: selectionText ? selection.start : 0, endOffset: selectionText ? selection.end : content.length }; prompt = buildWritePrompt({ input: value, document, content, revision, selection: selectionText, selectionStart: selection?.start, activeProposal: proposal }) } else { const receipt = buildContextReceipt({ document, content, revision, selection: selectionText, input: value, includeCurrent }); prompt = buildAskPrompt({ input: value, receipt, content, selection: selectionText }) } lastInput.current = value; setInput(''); await runtime.conversation.send(sessionId, prompt) } catch (cause) { setError(cause?.message || '发送失败。') } }
  async function createConversation() { try { const opened = await runtime.conversation.createModeSession(manifest, mode); await onManifest(opened.manifest); setSessionId(opened.sessionId) } catch (cause) { setError(cause?.message || '无法新建对话。') } }
  async function switchConversation(id) { try { const next = runtime.conversation.openProjectSession(manifest, id); await onManifest(next); setSessionId(id) } catch (cause) { setError(cause?.message || '无法切换对话。') } }
  async function stop() { try { await runtime.conversation.cancel(sessionId) } catch (cause) { setError(cause?.message || '停止失败。') } }
  async function loadOlder() { try { await runtime.conversation.loadOlder(sessionId) } catch (cause) { setError(cause?.message || '无法加载更早消息。') } }
  const conversations = runtime.conversation.listProjectSessions(manifest)
  const visibleMessages = messages.filter(message => message.kind !== 'proposal-protocol')
  return h('aside', { className: 'nv-assistant', 'aria-label': 'Narraiva 助手' },
    h('div', { className: 'nv-mode-switch', role: 'tablist', 'aria-label': '助手视图' },
      h('button', { className: `nv-mode${view === 'conversation' ? ' is-active' : ''}`, type: 'button', role: 'tab', 'aria-selected': view === 'conversation', onClick: () => setView('conversation') }, '对话'),
      h('button', { className: `nv-mode${view === 'history' ? ' is-active' : ''}`, type: 'button', role: 'tab', 'aria-selected': view === 'history', onClick: () => setView('history') }, '历史'),
    ),
    h('div', { className: 'nv-assistant-head' }, mode === 'ask' ? h('select', { className: 'nv-conversation-select', value: sessionId || '', onChange: event => switchConversation(event.target.value), 'aria-label': '当前对话' }, conversations.map((item, index) => h('option', { value: item.id, key: item.id }, item.title || `Conversation ${index + 1}`))) : h('span', { className: 'nv-conversation-select' }, 'Write Proposal 会话'), h('button', { className: 'nv-secondary', onClick: createConversation }, '新建')),
    h('div', { className: 'nv-connection', 'data-testid': 'narraiva-connection-state', 'data-state': connectionState },
      h('i', { className: `nv-dot is-${connectionState}` }),
      `${connectionCopy(connectionState)} · ${mode === 'ask' ? 'Ask 只读' : 'Write 仅提案'}`,
    ),
    h('div', { className: 'nv-chat', 'aria-live': 'polite' },
      view === 'history' && hasMore && h('button', { className: 'nv-secondary', disabled: loadingOlder, onClick: loadOlder }, loadingOlder ? '正在加载…' : '加载更早消息'),
      visibleMessages.length === 0 && !proposal && !changeSet ? h('div', { className: 'nv-chat-empty' }, view === 'history' ? '当前项目还没有历史消息。' : '询问当前正文，或先在编辑器中选择文本后使用 @选中文本。') : visibleMessages.map(message => h('div', { key: message.id, className: `nv-message ${message.role} ${message.status}` }, message.content ? renderMessage(message) : (message.status === 'streaming' ? '正在思考…' : ''))),
      error && h('div', { className: 'nv-composer-error' }, error, lastInput.current && h('button', { className: 'nv-mini', onClick: () => send(lastInput.current) }, '重试')),
      (proposal || changeSet) && h(ProposalCard, { proposal, changeSet, onProposal, onApply, onReject, onUndo, activeChangeId, onActiveChange }),
    ),
    h('div', { className: 'nv-context-row' }, h('button', { className: `nv-context-chip${includeCurrent ? '' : ' off'}`, onClick: () => setIncludeCurrent(value => !value), title: '点击移除或恢复默认上下文' }, `${includeCurrent ? '✓' : '＋'} 当前章节 · ${document?.title || '未选择'}`), selectionText && h('span', { className: 'nv-context-chip' }, `选区 ${selectionText.length} 字`)),
    h('div', { className: 'nv-composer', 'aria-label': `${mode === 'ask' ? 'Ask' : 'Write'} 输入框` },
      h('textarea', { disabled: running, value: input, placeholder: mode === 'write' ? '描述希望如何重写，或使用 @选中文本…' : '询问当前正文，或输入 @选中文本…', onChange: event => setInput(event.target.value), onKeyDown: event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } } }),
      h('div', { className: 'nv-composer-foot' },
        h('span', null, 'DeepSeek BYOK'),
        MODES.map(candidate => h('button', {
          className: `nv-mode${candidate.id === mode ? ' is-active' : ''}`,
          type: 'button', key: candidate.id, onClick: () => onModeChange(candidate.id),
        }, candidate.label)),
        running ? h('button', { className: 'nv-send nv-stop', type: 'button', onClick: stop, 'aria-label': '停止生成' }, '停止') : h('button', { className: 'nv-send', type: 'button', disabled: !input.trim() || (mode === 'write' && saveState !== 'saved'), onClick: () => send(), 'aria-label': '发送' }, '发送'),
      ),
      h('div', { className: 'nv-privacy' }, '本次内容直接通过本地 DSH 发送给你配置的 DeepSeek 服务，不会发送给 Narraiva。'),
    ),
  )
}

function NarraivaStatusBar({ connectionState }) {
  return h('footer', { className: 'nv-statusbar' },
    h('span', null, 'Phase 3.1 · Proposal Review'),
    h('span', null, '默认模式：Ask'),
    h('span', null, connectionCopy(connectionState)),
  )
}

function Welcome({ onOpen, onCreate, onRestore, error, busy, canRestore }) {
  return h('section', { className: 'nv-welcome' }, h('div', { className: `nv-welcome-card${busy ? ' nv-busy' : ''}` },
    h('h1', null, 'Narraiva'), h('p', null, '选择一个本地文件夹作为写作项目。正文和项目清单只保存在你授权的目录中，不会上传到远程服务。'),
    h('div', { className: 'nv-welcome-actions' }, h('button', { className: 'nv-primary', onClick: onCreate }, '创建项目'), h('button', { className: 'nv-secondary', onClick: onOpen }, '打开项目'), canRestore && h('button', { className: 'nv-secondary', onClick: onRestore }, '恢复上次项目')),
    !globalThis.showDirectoryPicker && h('div', { className: 'nv-error' }, '当前浏览器不支持本地目录访问。请使用最新版 Chrome 或 Edge 打开 localhost。'), error && h('div', { className: 'nv-error' }, error),
  ))
}

function NarraivaRoot({ runtime }) {
  const [mode, setMode] = React.useState('ask')
  const [adapter, setAdapter] = React.useState(null)
  const [manifest, setManifest] = React.useState(null)
  const [content, setContent] = React.useState('')
  const [revision, setRevision] = React.useState(null)
  const [selection, setSelection] = React.useState(null)
  const [saveState, setSaveState] = React.useState('saved')
  const [conflict, setConflict] = React.useState(false)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [restoreHandle, setRestoreHandle] = React.useState(null)
  const [proposal, setProposal] = React.useState(null)
  const [changeSet, setChangeSet] = React.useState(null)
  const [activeChangeId, setActiveChangeId] = React.useState(null)
  const saveTimer = React.useRef(null)
  const saveQueue = React.useRef(Promise.resolve())
  const revisionRef = React.useRef(null)
  const contentRef = React.useRef('')
  const editGeneration = React.useRef(0)
  const savedGeneration = React.useRef(0)
  const connectionState = useConnectionState(runtime.connection)

  React.useEffect(() => { recalledHandle().then(setRestoreHandle) }, [])
  async function loadProject(next) { const review = recoverReview(next.manifest.review); setProposal(review.proposal); setChangeSet(review.changeSet); setAdapter(next); setManifest(next.manifest); setError(''); await rememberHandle(next.root); const id = next.manifest.activeDocumentId; if (id) await selectDocument(next, next.manifest, id) }
  async function saveDraft(targetAdapter, document, value, generation) { let succeeded = true; saveQueue.current = saveQueue.current.then(async () => { setSaveState('saving'); try { const saved = await targetAdapter.saveDocument(document.path, value, revisionRef.current); revisionRef.current = saved.revision; setRevision(saved.revision); savedGeneration.current = Math.max(savedGeneration.current, generation); if (editGeneration.current === generation) setSaveState('saved'); else setSaveState('dirty') } catch (cause) { succeeded = false; if (cause?.code === 'WRITE_CONFLICT') setConflict(true); setSaveState('error'); setError(cause?.message || '保存失败。') } }); await saveQueue.current; return succeeded }
  async function selectDocument(targetAdapter, targetManifest, id) { clearTimeout(saveTimer.current); if (adapter && manifest && editGeneration.current > savedGeneration.current) { const current = manifest.documents.find(item => item.id === manifest.activeDocumentId); if (current && !await saveDraft(adapter, current, contentRef.current, editGeneration.current)) return } await saveQueue.current; const doc = targetManifest.documents.find(item => item.id === id); if (!doc) return; const loaded = await targetAdapter.readDocument(doc.path); const next = { ...targetManifest, activeDocumentId: id }; if (next.activeDocumentId !== targetAdapter.manifest.activeDocumentId) await targetAdapter.saveManifest(next); if (proposal?.source?.path !== doc.path) setProposal(null); if (changeSet?.path !== doc.path) setChangeSet(null); setManifest(next); contentRef.current = loaded.content; setContent(loaded.content); setSelection(null); revisionRef.current = loaded.revision; setRevision(loaded.revision); editGeneration.current = 0; savedGeneration.current = 0; setSaveState('saved'); setConflict(false); setError('') }
  async function choose(create) { setBusy(true); setError(''); try { const handle = await showDirectoryPicker({ mode: 'readwrite' }); const next = create ? await NarraivaProjectAdapter.create(handle, prompt('项目名称', handle.name) || handle.name) : await NarraivaProjectAdapter.open(handle); await loadProject(next) } catch (cause) { if (cause?.name !== 'AbortError') setError(cause?.message || '无法打开本地项目。') } finally { setBusy(false) } }
  async function restore() { setBusy(true); setError(''); try { const permission = await restoreHandle.requestPermission?.({ mode: 'readwrite' }) || await restoreHandle.queryPermission?.({ mode: 'readwrite' }); if (permission !== 'granted') throw new Error('没有获得本地项目的读写权限。'); await loadProject(await NarraivaProjectAdapter.open(restoreHandle)) } catch (cause) { setError(cause?.message || '无法恢复本地项目。') } finally { setBusy(false) } }
  function changeContent(value) { contentRef.current = value; const generation = ++editGeneration.current; setContent(value); setSaveState('dirty'); setError(''); clearTimeout(saveTimer.current); saveTimer.current = setTimeout(async () => { const doc = manifest.documents.find(item => item.id === manifest.activeDocumentId); if (doc) await saveDraft(adapter, doc, value, generation) }, 700) }
  React.useEffect(() => () => clearTimeout(saveTimer.current), [])
  async function updateManifest(next) { setManifest(next); const current = next.documents.find(item => item.id === next.activeDocumentId); if (!current) { clearTimeout(saveTimer.current); contentRef.current = ''; setContent(''); revisionRef.current = null; setRevision(null); editGeneration.current = 0; savedGeneration.current = 0; setSaveState('saved'); return } if (current.id !== manifest.activeDocumentId) await selectDocument(adapter, next, current.id) }
  async function persistConversationManifest(next) { await adapter.saveManifest(next); setManifest(next) }
  async function persistReview(nextProposal, nextChangeSet) { const handledProposalIds = [...new Set([...(manifest.review?.handledProposalIds || []), ...(proposal && !nextProposal ? [proposal.id] : [])])]; const next = { ...manifest, review: { proposal: nextProposal, changeSet: nextChangeSet, handledProposalIds } }; await adapter.saveManifest(next); setManifest(next); setProposal(nextProposal); setChangeSet(nextChangeSet) }
  async function updateProposal(nextProposal) { setActiveChangeId(nextProposal?.changes.find(change => change.status !== 'rejected')?.id || null); await persistReview(nextProposal, changeSet) }
  async function applyProposal() { const attempted = proposal; try { const active = manifest.documents.find(item => item.id === manifest.activeDocumentId); if (!active || active.path !== attempted?.source?.path) throw new Error('Proposal 不属于当前章节，已停止应用。'); clearTimeout(saveTimer.current); if (editGeneration.current > savedGeneration.current && !await saveDraft(adapter, active, contentRef.current, editGeneration.current)) return; await saveQueue.current; const nextContent = materialize(attempted.source.content, attempted.changes); const result = await adapter.applyChangeSetAndSaveManifest(attempted, nextContent, manifest, manifest.review?.handledProposalIds); contentRef.current = nextContent; setContent(nextContent); revisionRef.current = result.changeSet.appliedRevision; setRevision(result.changeSet.appliedRevision); editGeneration.current = 0; savedGeneration.current = 0; setSaveState('saved'); setManifest(result.manifest); setProposal(null); setChangeSet(result.changeSet) } catch (cause) { setError(cause?.message || '无法应用 Change Set。'); if (cause?.code === 'WRITE_CONFLICT') { setConflict(true); if (attempted) { const conflicted = { id: `conflicted-${attempted.id}`, proposalId: attempted.id, path: attempted.source.path, proposal: { ...attempted, status: 'conflicted' }, status: 'conflicted', conflictedAt: Date.now() }; try { await persistReview(null, conflicted) } catch { setProposal(null); setChangeSet(conflicted) } } } } }
  async function rejectProposal() { const rejected = proposal ? { id: `rejected-${proposal.id}`, proposalId: proposal.id, path: proposal.source.path, proposal: { ...proposal, status: 'rejected' }, status: 'rejected', rejectedAt: Date.now() } : changeSet; await persistReview(null, rejected) }
  async function undoChangeSet() { const attempted = changeSet; try { const active = manifest.documents.find(item => item.id === manifest.activeDocumentId); if (!active || active.path !== attempted?.path) throw new Error('Change Set 不属于当前章节，已停止撤销。'); clearTimeout(saveTimer.current); await saveQueue.current; const result = await adapter.undoChangeSetAndSaveManifest(attempted, manifest, manifest.review?.handledProposalIds); contentRef.current = attempted.beforeContent; setContent(attempted.beforeContent); revisionRef.current = result.changeSet.rolledBackRevision; setRevision(result.changeSet.rolledBackRevision); editGeneration.current = 0; savedGeneration.current = 0; setSaveState('saved'); setManifest(result.manifest); setChangeSet(result.changeSet) } catch (cause) { setError(cause?.message || '无法撤销 Change Set。'); if (cause?.code === 'WRITE_CONFLICT') { setConflict(true); if (attempted) { const conflicted = { ...attempted, status: 'conflicted', conflictOperation: 'undo', conflictedAt: Date.now() }; try { await persistReview(null, conflicted) } catch { setChangeSet(conflicted) } } } } }
  return h('main', { className: 'narraiva-spike', 'data-testid': 'narraiva-root', 'data-mode': mode },
    h(NarraivaTitleBar, { projectName: manifest?.name }),
    h('section', { className: 'nv-workbench', 'aria-label': 'Narraiva 写作工作台技术预览' },
      !manifest ? h(Welcome, { onCreate: () => choose(true), onOpen: () => choose(false), onRestore: restore, canRestore: Boolean(restoreHandle), error, busy }) : [
            h(ProjectNavigator, { key: 'nav', manifest, adapter, onManifest: updateManifest, onSelect: id => selectDocument(adapter, manifest, id), onError: setError }),
        h(ManuscriptEditor, { key: 'editor', document: manifest.documents.find(item => item.id === manifest.activeDocumentId), content, onChange: changeContent, onSelection: setSelection, saveState, conflict, error, proposal: mode === 'write' ? proposal : null, activeChangeId, onActiveChange: setActiveChangeId, onApply: applyProposal, onReject: rejectProposal }),
        h(AssistantPanel, { key: 'assistant', connectionState, mode, onModeChange: setMode, runtime, manifest, onManifest: persistConversationManifest, document: manifest.documents.find(item => item.id === manifest.activeDocumentId), content, revision, selection, proposal: mode === 'write' ? proposal : null, onProposal: updateProposal, onApply: applyProposal, onReject: rejectProposal, changeSet: mode === 'write' ? changeSet : null, onUndo: undoChangeSet, saveState, activeChangeId, onActiveChange: setActiveChangeId }),
      ],
    ),
    h(NarraivaStatusBar, { connectionState }),
  )
}

const inject = ['slots', 'connection', 'sessions']
function apply(ctx) {
  const connection = typeof ctx.get === 'function' ? ctx.get('connection') : undefined
  const sessions = typeof ctx.get === 'function' ? ctx.get('sessions') : undefined
  const runtime = Object.freeze({ connection: sourceFor(connection), conversation: new NarraivaConversationAdapter({ sessions, api: connection?.api }), modes: MODES, defaultMode: 'ask' })
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'narraiva-workbench',
    inject: () => ({ runtime }),
  }, NarraivaRoot))
}

module.exports = { apply, inject }

}};
var __cache = {};
function __require(id) {
  if (!__modules[id]) return require(id);
  if (__cache[id]) return __cache[id].exports;
  var local = __cache[id] = { exports: {} };
  __modules[id](local, local.exports, __require);
  return local.exports;
}
return __require("./index.cjs");
} });
