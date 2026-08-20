const CONTEXT_LABELS = Object.freeze({
  selection: '选中文本',
  current_document: '当前章节',
  cursor: '当前章节 + 光标位置',
  active_proposal: '当前待审 Proposal',
  review_record: 'Proposal / Change Set 记录',
  project_retrieval: '已选项目检索证据',
  none: '不发送当前正文',
})

function routeReceiptView(route = {}) {
  const labels = Array.isArray(route.labels) && route.labels.length ? route.labels : (route.skills || [])
  const contexts = Array.isArray(route.contextScopes) && route.contextScopes.length ? route.contextScopes : [route.contextScope]
  return {
    methodLabel: labels.join(' + ') || '未选择',
    sourceLabel: route.selectionSource === 'manual' ? '手动选择' : '自动选择',
    reason: route.reason || '等待输入后选择方法。',
    contextLabel: contexts.map(context => CONTEXT_LABELS[context] || context || '未确定').join(' + '),
    outputLabel: route.outputContract === 'proposal' ? '可审阅 Proposal' : '只读回复',
    selectionAuthorized: contexts.includes('selection'),
  }
}

module.exports = { CONTEXT_LABELS, routeReceiptView }
