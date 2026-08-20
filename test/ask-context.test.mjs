import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAskPrompt, buildContextReceipt, parseContextMentions } from '../src/client/ask-context.cjs'

const document = { id: 'd1', title: 'Chapter 1', path: 'manuscript/chapter_001.md' }

test('current chapter is the default explicit Ask context', () => {
  const receipt = buildContextReceipt({ document, content: '# Chapter 1\nDraft', revision: '10:20', selection: '' })
  assert.equal(receipt.items[0].diskRevision, '10:20')
  assert.match(receipt.items[0].revision, /^snapshot:[0-9a-f]{8}$/)
})

test('selection mention requires a real editor selection', () => {
  assert.throws(() => buildContextReceipt({ document, content: 'text', revision: '1:4', selection: '', input: '@选中文本 为什么？' }), /先在编辑器中选择文本/)
  const receipt = buildContextReceipt({ document, content: 'abcdef', revision: '1:6', selection: 'bcd', input: '@选中文本 为什么？' })
  assert.equal(receipt.items[0].type, 'selection')
  assert.equal(receipt.items[0].characterCount, 3)
})

test('mentions are stripped from the user question and never imply unsupported context', () => {
  assert.deepEqual(parseContextMentions('@当前章节 @选中文本 检查节奏'), ['current_document', 'selection'])
  assert.throws(() => parseContextMentions('@故事记忆 检查设定'), /Phase 2 暂不支持/)
})

test('Ask prompt carries an auditable manifest and read-only policy', () => {
  const receipt = buildContextReceipt({ document, content: 'Draft', revision: '1:5', selection: '' })
  const prompt = buildAskPrompt({ input: '@当前章节 分析节奏', receipt, content: 'Draft', selection: '' })
  assert.match(prompt, /NARRAIVA_ASK_V1/)
  assert.match(prompt, /NARRAIVA_META_V1/)
  assert.match(prompt, /只读分析模式/)
  assert.match(prompt, /manuscript\/chapter_001\.md/)
  assert.match(prompt, /Draft/)
  assert.match(prompt, /用户问题：\n分析节奏/)
  assert.doesNotMatch(prompt, /@当前章节/)
})

test('author can remove the default chapter context', () => {
  const receipt = buildContextReceipt({ document, content: 'Draft', revision: '1:5', selection: '', includeCurrent: false })
  assert.deepEqual(receipt.items, [])
  assert.match(buildAskPrompt({ input: '讨论一个通用问题', receipt, content: 'Draft', selection: '' }), /无（仅发送用户问题）/)
  assert.equal(buildContextReceipt({ document, content: 'Draft', revision: '1:5', selection: '', includeCurrent: false, input: '@当前章节 分析' }).items.length, 1)
})
