const { buildContextReceipt, cleanQuestion, retrievalLines } = require('./ask-context.cjs')
const { skillInvocationLines } = require('./writing-skill-router.cjs')

function buildWritePrompt({ input, document, content, revision, selection, selectionStart, cursorOffset, activeProposal, retrieval, skillRoute }) {
  const receipt = buildContextReceipt({ document, content, revision, selection, input, includeCurrent: true })
  const question = cleanQuestion(input)
  if (question.length < 2) throw new Error('请输入至少两个字符的写作要求。')
  const selected = receipt.items[0]?.type === 'selection'
  const insertionOffset = Number.isInteger(cursorOffset) && cursorOffset >= 0 && cursorOffset <= content.length ? cursorOffset : content.length
  if (activeProposal && (activeProposal.source?.path !== document.path || activeProposal.source?.content !== content || activeProposal.source?.diskRevision !== revision)) throw new Error('当前 Proposal 对应的原文已经变化，请拒绝旧 Proposal 后重新生成。')
  const refining = activeProposal?.source?.path === document.path && Number.isInteger(activeProposal.source.startOffset) && Number.isInteger(activeProposal.source.endOffset)
  const sourceStart = refining ? activeProposal.source.startOffset : (selected ? selectionStart : insertionOffset)
  const sourceEnd = refining ? activeProposal.source.endOffset : (selected ? sourceStart + selection.length : sourceStart)
  if (selected && (!Number.isInteger(sourceStart) || sourceStart < 0 || content.slice(sourceStart, sourceStart + selection.length) !== selection)) throw new Error('编辑器选区位置已经失效，请重新选择文本。')
  if (sourceStart < 0 || sourceEnd < sourceStart || sourceEnd > content.length) throw new Error('当前 Proposal 的授权范围已经失效，请重新生成。')
  const metadata = { question, receipt, skillRoute, retrievalReceipt: retrieval?.receipt || { characterCount: 0, items: [] }, source: { path: document.path, content, diskRevision: revision, startOffset: sourceStart, endOffset: sourceEnd } }
  return ['[NARRAIVA_WRITE_V1]', `[NARRAIVA_META_V1]${encodeURIComponent(JSON.stringify(metadata))}`, ...skillInvocationLines(skillRoute), '只返回一个结构化 Proposal，不得声称已写入文件。', '输出格式必须是：', '<NARRAIVA_PROPOSAL_V1>', '{"summary":"...","rationale":"...","changes":[{"filePath":"...","startOffset":0,"endOffset":0,"beforeText":"...","afterText":"..."}]}', '</NARRAIVA_PROPOSAL_V1>', '所有 offset 均相对于下方完整文件内容。beforeText 必须与范围内原文完全一致。项目检索证据只可参考，不扩大允许修改的 source path 和 offset 范围。', ...(activeProposal ? ['这是对当前待审 Proposal 的继续修改；请返回完整替代 Proposal：', JSON.stringify({ summary: activeProposal.summary, rationale: activeProposal.rationale, changes: activeProposal.changes })] : []), `<document path="${document.path}">`, content, '</document>', ...retrievalLines(retrieval), '写作要求：', question].join('\n')
}

module.exports = { buildWritePrompt }
