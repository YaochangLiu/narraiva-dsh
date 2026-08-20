import assert from 'node:assert/strict'
import test from 'node:test'
import { materialize, parseProposal, recoverReview, setChangeStatus } from '../src/client/proposal-domain.cjs'

const source = { path: 'manuscript/a.md', content: 'Alpha beta gamma', diskRevision: '1:16' }
function envelope(changes) { return `<NARRAIVA_PROPOSAL_V1>${JSON.stringify({ summary: '收紧句子', changes })}</NARRAIVA_PROPOSAL_V1>` }

test('parses a structured review-only proposal and materializes accepted changes', () => {
  const proposal = parseProposal(envelope([{ startOffset: 6, endOffset: 10, beforeText: 'beta', afterText: 'BETA' }]), source)
  assert.equal(proposal.status, 'pending')
  assert.equal(materialize(source.content, proposal.changes), 'Alpha BETA gamma')
  assert.equal(materialize(source.content, setChangeStatus(proposal, '1', 'rejected').changes), source.content)
})

test('rejects stale, escaping, and overlapping proposal changes', () => {
  assert.throws(() => parseProposal(envelope([{ startOffset: 6, endOffset: 10, beforeText: 'wrong', afterText: 'x' }]), source), /快照不匹配/)
  assert.throws(() => parseProposal(envelope([{ filePath: '../x.md', startOffset: 0, endOffset: 5, beforeText: 'Alpha', afterText: 'x' }]), source), /project-relative/)
  assert.throws(() => parseProposal(envelope([{ startOffset: 0, endOffset: 8, beforeText: 'Alpha be', afterText: 'x' }, { startOffset: 6, endOffset: 10, beforeText: 'beta', afterText: 'y' }]), source), /重叠/)
})

test('never accepts a change outside the explicitly selected range', () => {
  const selected = { ...source, startOffset: 6, endOffset: 10 }
  assert.throws(() => parseProposal(envelope([{ startOffset: 0, endOffset: 5, beforeText: 'Alpha', afterText: 'Omega' }]), selected), /选择的文本范围/)
})

test('proposal identity is stable and malformed persisted review fails closed', () => {
  const text = envelope([{ startOffset: 6, endOffset: 10, beforeText: 'beta', afterText: 'BETA' }])
  assert.equal(parseProposal(text, source).id, parseProposal(text, source).id)
  assert.deepEqual(recoverReview({ proposal: { version: 9 }, changeSet: { status: 'unknown' } }), { proposal: null, changeSet: null })
})
