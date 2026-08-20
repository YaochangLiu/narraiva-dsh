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
"./conversation-adapter.cjs": function(module, exports, require) {
function textContent(content = []) { return content.filter(block => block.type === 'text').map(block => block.text).join('\n') }
function assistantText(blocks = []) { return blocks.filter(block => block.kind === 'text').map(block => block.text).join('') }
function requestMetadata(prompt) { const match = /^\[NARRAIVA_META_V1\](.+)$/mu.exec(prompt); if (!match) return null; try { return JSON.parse(decodeURIComponent(match[1])) } catch { return null } }
function displayQuestion(prompt) { const metadata = requestMetadata(prompt); if (typeof metadata?.question === 'string') return metadata.question; const marker = '\n用户问题：\n'; const index = prompt.lastIndexOf(marker); return index < 0 ? prompt : prompt.slice(index + marker.length).trim() }
function contextSummary(prompt) { const metadata = requestMetadata(prompt); const item = metadata?.receipt?.items?.[0]; if (metadata) return item ? `${item.label} | ${item.path} | ${item.characterCount} 字符 | revision ${item.revision}` : '无上下文'; const match = /上下文清单：\n- ([^\n]+)/u.exec(prompt); return match?.[1] === '无（仅发送用户问题）' ? '无上下文' : match?.[1] }

function projectConversationSnapshot(snapshot) {
  const messages = []
  for (const node of snapshot.nodes || []) {
    if (node.kind === 'user' || node.kind === 'steering') { const prompt = textContent(node.content); messages.push({ id: `dsh-${node.seq}`, role: 'user', content: displayQuestion(prompt), contextSummary: contextSummary(prompt), status: 'done', createdAt: node.time }) }
    if (node.kind === 'assistant') messages.push({ id: `dsh-${node.seq}`, role: 'assistant', content: assistantText(node.blocks), status: node.interrupted ? 'cancelled' : 'done', createdAt: node.time, model: node.provenance?.model })
    if (node.kind === 'turn-error') messages.push({ id: `dsh-${node.seq}`, role: 'assistant', content: errorMessage(node.code, node.message), status: 'error', createdAt: node.time, errorCode: node.code })
  }
  if (snapshot.partial) messages.push({ id: `partial-${snapshot.partial.turn}-${snapshot.partial.step}`, role: 'assistant', content: assistantText(snapshot.partial.blocks), status: 'streaming', createdAt: Date.now() })
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
  async createProjectSession(manifest) { const sessionId = await this.sessions.create({}); return this.ensureProjectSession({ ...manifest, conversation: { ...(manifest.conversation || {}), activeId: sessionId } }) }
  openProjectSession(manifest, sessionId) { if (!(manifest.conversation?.ids || []).includes(sessionId)) throw new Error('该对话不属于当前项目。'); if (!this.sessions.binding(sessionId)) throw new Error('DSH 对话暂不可用。'); const row = this.sessions.list?.getSnapshot?.().byId?.[sessionId]; if (row?.agentPreset !== 'narraiva-ask') throw new Error('该对话不是 Narraiva Ask，已停止打开。'); this.sessions.open?.(sessionId); return { ...manifest, conversation: { ...manifest.conversation, activeId: sessionId } } }
  listProjectSessions(manifest) { const rows = this.sessions.list?.getSnapshot?.().byId || {}; return (manifest.conversation?.ids || []).filter(id => this.sessions.binding(id)).map(id => ({ id, title: rows[id]?.displayTitle || rows[id]?.title || `对话 ${id.slice(0, 8)}`, running: Boolean(rows[id]?.running) })) }
  face(sessionId) { const face = this.sessions.binding(sessionId)?.session; if (!face) throw new Error('DSH 会话不可用，请新建对话。'); return face }
  subscribe(sessionId, listener) { const face = this.face(sessionId); listener(projectConversationSnapshot(face.getSnapshot())); return face.subscribe(() => listener(projectConversationSnapshot(face.getSnapshot()))) }
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
  .nv-assistant { display:flex; flex-direction:column; border-left:1px solid var(--nv-border); padding:0; }.nv-mode-switch { display:grid; grid-template-columns:1fr 1fr; padding:0; border-bottom:1px solid var(--nv-border); border-radius:0; background:transparent; }.nv-mode { min-height:52px; border-bottom:3px solid transparent; border-radius:0; font-size:14px; }.nv-mode:hover { color:var(--nv-text); }.nv-mode.is-active { border-color:var(--nv-accent); color:var(--nv-accent); background:transparent; box-shadow:none; }.nv-connection { display:flex; align-items:center; gap:8px; margin:14px 18px; color:var(--nv-secondary); font-size:12px; }.nv-dot { width:7px; height:7px; border-radius:50%; background:var(--nv-muted); }.nv-dot.is-connected { background:var(--nv-success); box-shadow:0 0 0 3px rgba(90,165,111,.12); }.nv-dot.is-reconnecting { background:var(--nv-accent); box-shadow:0 0 0 3px rgba(199,117,56,.12); }.nv-assistant-empty { flex:1; min-height:164px; display:block; padding:22px; border:0; border-top:1px solid var(--nv-border); border-radius:0; color:#3f3a36; text-align:left; font-size:14px; line-height:1.8; }.nv-assistant-empty span { display:inline; margin:0; color:var(--nv-secondary); font-size:12px; }.nv-composer { margin:0 14px 14px; padding:12px; border:1px solid #ebe5dc; border-radius:13px; background:var(--nv-elevated); }.nv-composer textarea { width:100%; min-height:72px; resize:none; border:0; outline:0; color:var(--nv-muted); background:transparent; font:13px/1.55 inherit; }.nv-composer-foot { display:flex; align-items:center; justify-content:space-between; color:var(--nv-muted); font-size:11px; }.nv-send { width:auto; height:29px; padding:0 12px; border:0; border-radius:8px; color:white; background:#d9ad89; cursor:not-allowed; }
  .nv-statusbar { gap:24px; padding:0 18px; border-top:1px solid var(--nv-border); color:var(--nv-muted); font-size:11px; }.nv-statusbar span:last-child { margin-left:auto; }
  @media (max-width:900px) { .nv-workbench { grid-template-columns:208px minmax(0,1fr); }.nv-assistant { display:none; } } @media (max-width:620px) { .nv-workbench { grid-template-columns:1fr; }.nv-sidebar { display:none; }.nv-editor { padding:48px 25px; }.nv-statusbar { gap:12px; }.nv-statusbar span:nth-child(2) { display:none; } }
  .nv-welcome{grid-column:1/-1;display:grid;place-items:center;background:var(--nv-editor);padding:32px}.nv-welcome-card{width:min(560px,100%);padding:44px;border:1px solid var(--nv-border);border-radius:16px;background:var(--nv-elevated);box-shadow:0 18px 60px rgba(73,55,39,.08)}.nv-welcome-card h1{margin:0 0 10px;font:700 38px/1 Georgia,serif}.nv-welcome-card p{color:var(--nv-secondary);line-height:1.7}.nv-welcome-actions{display:flex;gap:10px;margin-top:28px}.nv-primary,.nv-secondary{min-height:38px;padding:0 16px;border:1px solid var(--nv-border);border-radius:9px;background:white;color:var(--nv-text);cursor:pointer}.nv-primary{border-color:var(--nv-accent);background:var(--nv-accent);color:white}.nv-error{margin-top:16px;padding:10px 12px;border-radius:8px;background:#fff0eb;color:#9d412e;font-size:12px}.nv-editor{display:flex;flex-direction:column;padding:0}.nv-editor-head{display:flex;align-items:center;justify-content:space-between;height:48px;padding:0 22px;border-bottom:1px solid var(--nv-border);color:var(--nv-secondary);font-size:12px}.nv-editor-surface{position:relative;flex:1;min-height:0;display:grid;grid-template-columns:52px minmax(0,1fr);overflow:auto;background:var(--nv-editor)}.nv-lines{padding:35px 10px;text-align:right;color:var(--nv-muted);font:13px/1.9 "SFMono-Regular",Consolas,monospace;white-space:pre;border-right:1px solid #f1ece5;user-select:none}.nv-manuscript{width:100%;min-height:100%;padding:34px 42px;border:0;outline:0;resize:none;background:transparent;color:#252321;font:16px/1.9 "SFMono-Regular",Consolas,monospace;tab-size:2}.nv-chapter-row{display:flex;align-items:center;margin:3px 8px;border-radius:7px}.nv-chapter-row.is-active{background:var(--nv-accent-soft);border-left:3px solid var(--nv-accent)}.nv-chapter-row .nv-chapter{flex:1;width:auto;margin:0}.nv-mini{border:0;background:transparent;color:var(--nv-muted);cursor:pointer;padding:5px}.nv-project::after{content:attr(data-project-name)}.nv-conflict{padding:8px 18px;background:#fff3e5;color:#914f1d;font-size:12px;border-bottom:1px solid #ebd0b6}.nv-save-error{color:#a13f32}.nv-busy{opacity:.65;pointer-events:none}
  .nv-assistant-head{display:flex;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--nv-border)}.nv-conversation-select{min-width:0;flex:1;height:34px;border:1px solid var(--nv-border);border-radius:8px;background:var(--nv-editor);padding:0 8px}.nv-chat{flex:1;min-height:0;overflow:auto;padding:14px}.nv-chat-empty{display:grid;height:100%;place-content:center;color:var(--nv-muted);text-align:center;line-height:1.7}.nv-message{max-width:92%;margin:0 0 12px;padding:10px 12px;border-radius:11px;white-space:pre-wrap;font-size:13px;line-height:1.65}.nv-message.user{margin-left:auto;background:var(--nv-accent-soft);color:#503524}.nv-message.assistant{background:var(--nv-elevated);border:1px solid var(--nv-border)}.nv-message.error{border-color:#e5b6a6;background:#fff3ef;color:#8d3d2b}.nv-message.streaming::after{content:'▋';color:var(--nv-accent);animation:nv-blink 1s infinite}.nv-context-row{display:flex;gap:6px;align-items:center;margin:0 14px 8px;color:var(--nv-muted);font-size:11px}.nv-context-chip{border:1px solid var(--nv-border);border-radius:999px;padding:4px 8px;background:var(--nv-editor);color:var(--nv-secondary)}.nv-context-chip.off{text-decoration:line-through;opacity:.55}.nv-composer textarea:disabled{opacity:.55}.nv-composer-error{margin:0 14px 8px;color:#9d412e;font-size:11px}.nv-stop{background:#8f6047}.nv-privacy{margin-top:6px;color:var(--nv-muted);font-size:10px;line-height:1.4}@keyframes nv-blink{50%{opacity:0}}
  .nv-receipt{display:block;margin-top:6px;color:var(--nv-muted);font-size:9px}.nv-markdown p{margin:0 0 8px}.nv-markdown p:last-child{margin-bottom:0}.nv-markdown pre{overflow:auto;padding:8px;border-radius:7px;background:#f2eee8;white-space:pre-wrap;font:11px/1.5 Consolas,monospace}.nv-markdown strong{font-weight:700}
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

function ManuscriptEditor({ document, content, onChange, onSelection, saveState, conflict, error }) {
  const lines = Math.max(1, content.split('\n').length)
  return h('article', { className: 'nv-editor', 'aria-label': '稿件编辑器' },
    h('div', { className: 'nv-editor-head' }, h('span', null, document?.path || '未选择正文'), h('span', { className: saveState === 'error' ? 'nv-save-error' : '' }, saveState === 'dirty' ? '未保存' : saveState === 'saving' ? '正在保存…' : saveState === 'error' ? '保存失败' : '已保存')),
    conflict && h('div', { className: 'nv-conflict' }, '磁盘中的文件已被其他程序修改。Narraiva 已停止自动保存，以免覆盖外部内容。请复制当前草稿后重新打开项目。'),
    error && !conflict && h('div', { className: 'nv-conflict' }, error),
    h('div', { className: 'nv-editor-surface' },
      h('div', { className: 'nv-lines', 'aria-hidden': true }, Array.from({ length: lines }, (_, i) => i + 1).join('\n')),
      h('textarea', { className: 'nv-manuscript', value: content, disabled: !document || conflict, spellCheck: true, onChange: event => onChange(event.target.value), onSelect: event => onSelection(event.target.value.slice(event.target.selectionStart, event.target.selectionEnd)) }),
    ))
}

function AssistantPanel({ connectionState, mode, onModeChange, runtime, manifest, onManifest, document, content, revision, selection }) {
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
  React.useEffect(() => { let dispose = () => {}; let live = true; (async () => { try { const opened = await runtime.conversation.ensureProjectSession(manifest); if (!live) return; setSessionId(opened.sessionId); if (opened.manifest !== manifest) await onManifest(opened.manifest); dispose = runtime.conversation.subscribe(opened.sessionId, state => { setMessages(state.messages); setRunning(state.running); setHasMore(state.hasMore); setLoadingOlder(state.loadingOlder); const lastUser = [...state.messages].reverse().find(item => item.role === 'user'); if (lastUser) lastInput.current = lastUser.content; const last = state.messages[state.messages.length - 1]; if (state.promptError) setError(state.promptError.message || 'DSH 请求失败。'); else if (last?.status === 'error') setError(last.content); else if (!state.running) setError('') }) } catch (cause) { if (live) setError(cause?.message || '无法打开 DSH 对话。') } })(); return () => { live = false; dispose() } }, [manifest.id, manifest.conversation?.activeId])
  async function send(value = input) { if (!sessionId || running || mode !== 'ask') return; setError(''); try { const receipt = buildContextReceipt({ document, content, revision, selection, input: value, includeCurrent }); const prompt = buildAskPrompt({ input: value, receipt, content, selection }); lastInput.current = value; setInput(''); await runtime.conversation.send(sessionId, prompt) } catch (cause) { setError(cause?.message || '发送失败。') } }
  async function createConversation() { try { const opened = await runtime.conversation.createProjectSession(manifest); await onManifest(opened.manifest); setSessionId(opened.sessionId) } catch (cause) { setError(cause?.message || '无法新建对话。') } }
  async function switchConversation(id) { try { const next = runtime.conversation.openProjectSession(manifest, id); await onManifest(next); setSessionId(id) } catch (cause) { setError(cause?.message || '无法切换对话。') } }
  async function stop() { try { await runtime.conversation.cancel(sessionId) } catch (cause) { setError(cause?.message || '停止失败。') } }
  async function loadOlder() { try { await runtime.conversation.loadOlder(sessionId) } catch (cause) { setError(cause?.message || '无法加载更早消息。') } }
  const conversations = runtime.conversation.listProjectSessions(manifest)
  return h('aside', { className: 'nv-assistant', 'aria-label': 'Narraiva 助手' },
    h('div', { className: 'nv-mode-switch', role: 'tablist', 'aria-label': '助手视图' },
      h('button', { className: `nv-mode${view === 'conversation' ? ' is-active' : ''}`, type: 'button', role: 'tab', 'aria-selected': view === 'conversation', onClick: () => setView('conversation') }, '对话'),
      h('button', { className: `nv-mode${view === 'history' ? ' is-active' : ''}`, type: 'button', role: 'tab', 'aria-selected': view === 'history', onClick: () => setView('history') }, '历史'),
    ),
    h('div', { className: 'nv-assistant-head' }, h('select', { className: 'nv-conversation-select', value: sessionId || '', onChange: event => switchConversation(event.target.value), 'aria-label': '当前对话' }, conversations.map((item, index) => h('option', { value: item.id, key: item.id }, item.title || `Conversation ${index + 1}`))), h('button', { className: 'nv-secondary', onClick: createConversation }, '新建')),
    h('div', { className: 'nv-connection', 'data-testid': 'narraiva-connection-state', 'data-state': connectionState },
      h('i', { className: `nv-dot is-${connectionState}` }),
      `${connectionCopy(connectionState)} · Ask 只读`,
    ),
    h('div', { className: 'nv-chat', 'aria-live': 'polite' },
      view === 'history' && hasMore && h('button', { className: 'nv-secondary', disabled: loadingOlder, onClick: loadOlder }, loadingOlder ? '正在加载…' : '加载更早消息'),
      messages.length === 0 ? h('div', { className: 'nv-chat-empty' }, view === 'history' ? '当前项目还没有历史消息。' : '询问当前正文，或先在编辑器中选择文本后使用 @选中文本。') : messages.map(message => h('div', { key: message.id, className: `nv-message ${message.role} ${message.status}` }, message.content ? renderMessage(message) : (message.status === 'streaming' ? '正在思考…' : '')))),
    error && h('div', { className: 'nv-composer-error' }, error, lastInput.current && h('button', { className: 'nv-mini', onClick: () => send(lastInput.current) }, '重试')),
    h('div', { className: 'nv-context-row' }, h('button', { className: `nv-context-chip${includeCurrent ? '' : ' off'}`, onClick: () => setIncludeCurrent(value => !value), title: '点击移除或恢复默认上下文' }, `${includeCurrent ? '✓' : '＋'} 当前章节 · ${document?.title || '未选择'}`), selection && h('span', { className: 'nv-context-chip' }, `选区 ${selection.length} 字`)),
    h('div', { className: 'nv-composer', 'aria-label': 'Ask 输入框' },
      h('textarea', { disabled: running || mode !== 'ask', value: input, placeholder: mode === 'write' ? 'Write 与 Change Set 将在 Phase 3 开放' : '询问当前正文，或输入 @选中文本…', onChange: event => setInput(event.target.value), onKeyDown: event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } } }),
      h('div', { className: 'nv-composer-foot' },
        h('span', null, 'DeepSeek BYOK'),
        MODES.map(candidate => h('button', {
          className: `nv-mode${candidate.id === mode ? ' is-active' : ''}`,
          type: 'button', key: candidate.id, onClick: () => onModeChange(candidate.id),
        }, candidate.label)),
        running ? h('button', { className: 'nv-send nv-stop', type: 'button', onClick: stop, 'aria-label': '停止生成' }, '停止') : h('button', { className: 'nv-send', type: 'button', disabled: !input.trim() || mode !== 'ask', onClick: () => send(), 'aria-label': '发送' }, '发送'),
      ),
      h('div', { className: 'nv-privacy' }, '本次内容直接通过本地 DSH 发送给你配置的 DeepSeek 服务，不会发送给 Narraiva。'),
    ),
  )
}

function NarraivaStatusBar({ connectionState }) {
  return h('footer', { className: 'nv-statusbar' },
    h('span', null, 'Phase 2 · Ask'),
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
  const [selection, setSelection] = React.useState('')
  const [saveState, setSaveState] = React.useState('saved')
  const [conflict, setConflict] = React.useState(false)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [restoreHandle, setRestoreHandle] = React.useState(null)
  const saveTimer = React.useRef(null)
  const saveQueue = React.useRef(Promise.resolve())
  const revisionRef = React.useRef(null)
  const contentRef = React.useRef('')
  const editGeneration = React.useRef(0)
  const savedGeneration = React.useRef(0)
  const connectionState = useConnectionState(runtime.connection)

  React.useEffect(() => { recalledHandle().then(setRestoreHandle) }, [])
  async function loadProject(next) { setAdapter(next); setManifest(next.manifest); setError(''); await rememberHandle(next.root); const id = next.manifest.activeDocumentId; if (id) await selectDocument(next, next.manifest, id) }
  async function saveDraft(targetAdapter, document, value, generation) { let succeeded = true; saveQueue.current = saveQueue.current.then(async () => { setSaveState('saving'); try { const saved = await targetAdapter.saveDocument(document.path, value, revisionRef.current); revisionRef.current = saved.revision; setRevision(saved.revision); savedGeneration.current = Math.max(savedGeneration.current, generation); if (editGeneration.current === generation) setSaveState('saved'); else setSaveState('dirty') } catch (cause) { succeeded = false; if (cause?.code === 'WRITE_CONFLICT') setConflict(true); setSaveState('error'); setError(cause?.message || '保存失败。') } }); await saveQueue.current; return succeeded }
  async function selectDocument(targetAdapter, targetManifest, id) { clearTimeout(saveTimer.current); if (adapter && manifest && editGeneration.current > savedGeneration.current) { const current = manifest.documents.find(item => item.id === manifest.activeDocumentId); if (current && !await saveDraft(adapter, current, contentRef.current, editGeneration.current)) return } await saveQueue.current; const doc = targetManifest.documents.find(item => item.id === id); if (!doc) return; const loaded = await targetAdapter.readDocument(doc.path); const next = { ...targetManifest, activeDocumentId: id }; if (next.activeDocumentId !== targetAdapter.manifest.activeDocumentId) await targetAdapter.saveManifest(next); setManifest(next); contentRef.current = loaded.content; setContent(loaded.content); setSelection(''); revisionRef.current = loaded.revision; setRevision(loaded.revision); editGeneration.current = 0; savedGeneration.current = 0; setSaveState('saved'); setConflict(false); setError('') }
  async function choose(create) { setBusy(true); setError(''); try { const handle = await showDirectoryPicker({ mode: 'readwrite' }); const next = create ? await NarraivaProjectAdapter.create(handle, prompt('项目名称', handle.name) || handle.name) : await NarraivaProjectAdapter.open(handle); await loadProject(next) } catch (cause) { if (cause?.name !== 'AbortError') setError(cause?.message || '无法打开本地项目。') } finally { setBusy(false) } }
  async function restore() { setBusy(true); setError(''); try { const permission = await restoreHandle.requestPermission?.({ mode: 'readwrite' }) || await restoreHandle.queryPermission?.({ mode: 'readwrite' }); if (permission !== 'granted') throw new Error('没有获得本地项目的读写权限。'); await loadProject(await NarraivaProjectAdapter.open(restoreHandle)) } catch (cause) { setError(cause?.message || '无法恢复本地项目。') } finally { setBusy(false) } }
  function changeContent(value) { contentRef.current = value; const generation = ++editGeneration.current; setContent(value); setSaveState('dirty'); setError(''); clearTimeout(saveTimer.current); saveTimer.current = setTimeout(async () => { const doc = manifest.documents.find(item => item.id === manifest.activeDocumentId); if (doc) await saveDraft(adapter, doc, value, generation) }, 700) }
  React.useEffect(() => () => clearTimeout(saveTimer.current), [])
  async function updateManifest(next) { setManifest(next); const current = next.documents.find(item => item.id === next.activeDocumentId); if (!current) { clearTimeout(saveTimer.current); contentRef.current = ''; setContent(''); revisionRef.current = null; setRevision(null); editGeneration.current = 0; savedGeneration.current = 0; setSaveState('saved'); return } if (current.id !== manifest.activeDocumentId) await selectDocument(adapter, next, current.id) }
  async function persistConversationManifest(next) { await adapter.saveManifest(next); setManifest(next) }
  return h('main', { className: 'narraiva-spike', 'data-testid': 'narraiva-root', 'data-mode': mode },
    h(NarraivaTitleBar, { projectName: manifest?.name }),
    h('section', { className: 'nv-workbench', 'aria-label': 'Narraiva 写作工作台技术预览' },
      !manifest ? h(Welcome, { onCreate: () => choose(true), onOpen: () => choose(false), onRestore: restore, canRestore: Boolean(restoreHandle), error, busy }) : [
            h(ProjectNavigator, { key: 'nav', manifest, adapter, onManifest: updateManifest, onSelect: id => selectDocument(adapter, manifest, id), onError: setError }),
        h(ManuscriptEditor, { key: 'editor', document: manifest.documents.find(item => item.id === manifest.activeDocumentId), content, onChange: changeContent, onSelection: setSelection, saveState, conflict, error }),
        h(AssistantPanel, { key: 'assistant', connectionState, mode, onModeChange: setMode, runtime, manifest, onManifest: persistConversationManifest, document: manifest.documents.find(item => item.id === manifest.activeDocumentId), content, revision, selection }),
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
