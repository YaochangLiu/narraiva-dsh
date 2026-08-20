import assert from 'node:assert/strict'
import test from 'node:test'

import { routeReceiptView } from '../src/client/skill-route-presentation.cjs'

test('route receipt presents author-facing method, source, context and output labels', () => {
  const view = routeReceiptView({ labels: ['短选区精修', '降低 AI 腔'], selectionSource: 'manual', reason: '作者选择。', contextScope: 'selection', outputContract: 'proposal' })
  assert.deepEqual(view, {
    methodLabel: '短选区精修 + 降低 AI 腔',
    sourceLabel: '手动选择',
    reason: '作者选择。',
    contextLabel: '选中文本',
    outputLabel: '可审阅 Proposal',
    selectionAuthorized: true,
  })
})

test('route receipt labels automatic no-context Ask without implying manuscript access', () => {
  const view = routeReceiptView({ skills: ['agent-respond'], selectionSource: 'automatic', reason: '普通讨论。', contextScope: 'none', outputContract: 'assistant_text' })
  assert.equal(view.methodLabel, 'agent-respond')
  assert.equal(view.sourceLabel, '自动选择')
  assert.equal(view.contextLabel, '不发送当前正文')
  assert.equal(view.outputLabel, '只读回复')
  assert.equal(view.selectionAuthorized, false)
})

test('route receipt displays every context actually sent for revision explanation', () => {
  const view = routeReceiptView({ labels: ['修改解释'], selectionSource: 'automatic', reason: '解释修改。', contextScope: 'review_record', contextScopes: ['selection', 'review_record', 'project_retrieval'], outputContract: 'assistant_text' })
  assert.equal(view.contextLabel, '选中文本 + Proposal / Change Set 记录 + 已选项目检索证据')
  assert.equal(view.selectionAuthorized, true)
})
