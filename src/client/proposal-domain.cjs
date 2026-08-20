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
