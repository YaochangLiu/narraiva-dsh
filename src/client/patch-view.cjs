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
