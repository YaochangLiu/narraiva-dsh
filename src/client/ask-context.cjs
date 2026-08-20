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
