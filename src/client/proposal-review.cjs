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
