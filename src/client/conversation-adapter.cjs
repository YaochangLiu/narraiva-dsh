function textContent(content = []) { return content.filter(block => block.type === 'text').map(block => block.text).join('\n') }
function assistantText(blocks = []) { return blocks.filter(block => block.kind === 'text').map(block => block.text).join('') }
function requestMetadata(prompt) { const match = /^\[NARRAIVA_META_V1\](.+)$/mu.exec(prompt); if (!match) return null; try { return JSON.parse(decodeURIComponent(match[1])) } catch { return null } }
function displayQuestion(prompt) { const metadata = requestMetadata(prompt); if (typeof metadata?.question === 'string') return metadata.question; const marker = '\n用户问题：\n'; const index = prompt.lastIndexOf(marker); return index < 0 ? prompt : prompt.slice(index + marker.length).trim() }
function contextSummary(prompt) { const metadata = requestMetadata(prompt); const item = metadata?.receipt?.items?.[0]; if (metadata) return item ? `${item.label} | ${item.path} | ${item.characterCount} 字符 | revision ${item.revision}` : '无上下文'; const match = /上下文清单：\n- ([^\n]+)/u.exec(prompt); return match?.[1] === '无（仅发送用户问题）' ? '无上下文' : match?.[1] }
function requestUsesProposalProtocol(prompt) { return /^\[NARRAIVA_WRITE_V1\](?:\r?\n|$)/u.test(prompt) }
function proposalEnvelope(raw) { return /<NARRAIVA_PROPOSAL_V1>[\s\S]*?<\/NARRAIVA_PROPOSAL_V1>/u.exec(raw)?.[0] }
function assistantMessage(node, proposalProtocol = true) { const raw = assistantText(node.blocks); if (!proposalProtocol) return { id: `dsh-${node.seq}`, kind: 'message', role: 'assistant', content: raw, status: node.interrupted ? 'cancelled' : 'done', createdAt: node.time, model: node.provenance?.model }; const envelope = proposalEnvelope(raw); const opening = raw.indexOf('<NARRAIVA_PROPOSAL_V1>'); const protocol = opening >= 0; const content = protocol ? raw.slice(0, opening).trim() : raw; return { id: `dsh-${node.seq}`, kind: !content && protocol ? 'proposal-protocol' : 'message', role: 'assistant', content, protocolContent: envelope || (protocol ? raw.slice(opening) : undefined), status: node.interrupted ? 'cancelled' : 'done', createdAt: node.time, model: node.provenance?.model } }

function projectConversationSnapshot(snapshot, options = {}) {
  let proposalProtocol = options.proposalProtocol
  const protocolByTurn = options.protocolByTurn || new Map()
  for (const node of snapshot.nodes || []) {
    if ((node.kind === 'user' || node.kind === 'steering') && Number.isInteger(node.turn)) protocolByTurn.set(node.turn, requestUsesProposalProtocol(textContent(node.content)))
  }
  const messages = []
  for (const node of snapshot.nodes || []) {
    if (node.kind === 'user' || node.kind === 'steering') { const prompt = textContent(node.content); proposalProtocol = requestUsesProposalProtocol(prompt); messages.push({ id: `dsh-${node.seq}`, role: 'user', content: displayQuestion(prompt), contextSummary: contextSummary(prompt), requestMetadata: requestMetadata(prompt), status: 'done', createdAt: node.time }) }
    if (node.kind === 'assistant') messages.push(assistantMessage(node, (protocolByTurn.get(node.turn) ?? proposalProtocol) !== false))
    if (node.kind === 'turn-error') messages.push({ id: `dsh-${node.seq}`, role: 'assistant', content: errorMessage(node.code, node.message), status: 'error', createdAt: node.time, errorCode: node.code })
  }
  if (snapshot.partial) { const raw = assistantText(snapshot.partial.blocks); const partialProtocol = protocolByTurn.get(snapshot.partial.turn) ?? proposalProtocol; const protocol = partialProtocol !== false && raw.includes('<NARRAIVA_PROPOSAL'); messages.push({ id: `partial-${snapshot.partial.turn}-${snapshot.partial.step}`, kind: protocol ? 'proposal-streaming' : 'message', role: 'assistant', content: protocol ? '正在整理可审阅的 Proposal…' : raw, status: 'streaming', createdAt: Date.now() }) }
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
    const preset = 'narraiva-conversation'
    const legacyIds = [...new Set([...(manifest.conversation?.ids || []), manifest.conversation?.activeId, manifest.conversation?.writeId].filter(Boolean))]
    let sessionId = manifest.conversation?.activeId
    if (!sessionId || !this.sessions.binding(sessionId)) sessionId = await this.sessions.create({})
    let row = this.sessions.list?.getSnapshot?.().byId?.[sessionId]
    if (row?.blank === false && row?.agentPreset !== preset) { sessionId = await this.sessions.create({}); row = this.sessions.list?.getSnapshot?.().byId?.[sessionId] }
    if (row?.agentPreset !== preset) {
      if (row?.blank === false) throw new Error('当前 DSH 对话不是 Narraiva 统一会话，且不能在已有历史后切换 preset。')
      if (!this.api.agentPresets?.select) throw new Error('DSH 未提供 Narraiva preset 绑定能力，已停止发送。')
      const response = await this.api.agentPresets.select({ sessionId, agentPreset: preset })
      if (!response.result?.ok) throw new Error(errorMessage(response.result?.error?.code, response.result?.error?.message))
      this.sessions.noteAgentPreset?.(sessionId, preset)
    }
    this.sessions.open?.(sessionId)
    const ids = [...new Set([...legacyIds, sessionId])]
    const { writeId: _legacyWriteId, ...conversation } = manifest.conversation || {}
    return { sessionId, manifest: { ...manifest, conversation: { ...conversation, ids, activeId: sessionId } } }
  }
  async ensureModeSession(manifest) { return this.ensureProjectSession(manifest) }
  async createProjectSession(manifest) { const sessionId = await this.sessions.create({}); return this.ensureProjectSession({ ...manifest, conversation: { ...(manifest.conversation || {}), activeId: sessionId } }) }
  async createModeSession(manifest) { return this.createProjectSession(manifest) }
  openProjectSession(manifest, sessionId) { if (!(manifest.conversation?.ids || []).includes(sessionId)) throw new Error('该对话不属于当前项目。'); if (!this.sessions.binding(sessionId)) throw new Error('DSH 对话暂不可用。'); const row = this.sessions.list?.getSnapshot?.().byId?.[sessionId]; if (row?.agentPreset !== 'narraiva-conversation') throw new Error('这是旧版分离会话，只保留历史引用；请使用新的 Narraiva 统一会话。'); this.sessions.open?.(sessionId); return { ...manifest, conversation: { ...manifest.conversation, activeId: sessionId } } }
  listProjectSessions(manifest) { const rows = this.sessions.list?.getSnapshot?.().byId || {}; return (manifest.conversation?.ids || []).filter(id => this.sessions.binding(id) && rows[id]?.agentPreset === 'narraiva-conversation').map(id => ({ id, title: rows[id]?.displayTitle || rows[id]?.title || `对话 ${id.slice(0, 8)}`, running: Boolean(rows[id]?.running) })) }
  face(sessionId) { const face = this.sessions.binding(sessionId)?.session; if (!face) throw new Error('DSH 会话不可用，请新建对话。'); return face }
  subscribe(sessionId, listener, options = {}) { const face = this.face(sessionId); const projection = { ...options, protocolByTurn: new Map() }; listener(projectConversationSnapshot(face.getSnapshot(), projection)); return face.subscribe(() => listener(projectConversationSnapshot(face.getSnapshot(), projection))) }
  async send(sessionId, prompt) { const result = await this.face(sessionId).prompt([{ type: 'text', text: prompt }], 'queue'); if (!result.ok) throw new Error(errorMessage(result.error.code, result.error.message)) }
  async cancel(sessionId) { const result = await this.face(sessionId).cancel(); if (!result.ok) throw new Error(errorMessage(result.error.code, result.error.message)) }
  async loadOlder(sessionId) { await this.face(sessionId).loadOlder() }
}

module.exports = { NarraivaConversationAdapter, contextSummary, displayQuestion, errorMessage, projectConversationSnapshot, requestMetadata, requestUsesProposalProtocol }
