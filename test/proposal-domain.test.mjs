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
  assert.throws(() => parseProposal(envelope([{ startOffset: 6, endOffset: 6, beforeText: '', afterText: 'one' }, { startOffset: 6, endOffset: 6, beforeText: '', afterText: 'two' }]), source), /同一位置/)
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

test('recovers a rejected Proposal lifecycle record without making it applicable', () => {
  const proposal = parseProposal(envelope([{ startOffset: 6, endOffset: 10, beforeText: 'beta', afterText: 'BETA' }]), source)
  const recovered = recoverReview({ changeSet: { proposalId: proposal.id, path: proposal.source.path, proposal: { ...proposal, status: 'rejected' }, status: 'rejected' } })
  assert.equal(recovered.proposal, null)
  assert.equal(recovered.changeSet.status, 'rejected')
})

test('fails closed when a persisted terminal lifecycle has a malformed Proposal', () => {
  assert.deepEqual(recoverReview({ changeSet: { proposalId: 'p1', status: 'rejected', proposal: { changes: {} } } }), { proposal: null, changeSet: null })
  assert.deepEqual(recoverReview({ changeSet: { proposalId: 'p1', status: 'rejected', path: source.path, proposal: { version: 1, source, changes: [{}] } } }), { proposal: null, changeSet: null })
})

test('recovers a conflicted Proposal as a non-applicable lifecycle record', () => {
  const proposal = parseProposal(envelope([{ startOffset: 6, endOffset: 10, beforeText: 'beta', afterText: 'BETA' }]), source)
  const recovered = recoverReview({ changeSet: { proposalId: proposal.id, path: proposal.source.path, proposal: { ...proposal, status: 'conflicted' }, status: 'conflicted' } })
  assert.equal(recovered.proposal, null)
  assert.equal(recovered.changeSet.status, 'conflicted')
})

test('preserves legacy applied Change Sets so Phase 3 projects can still undo', () => {
  const legacy = { proposalId: 'legacy', status: 'applied', path: source.path, beforeContent: source.content, afterContent: 'changed', appliedRevision: '2:7' }
  assert.deepEqual(recoverReview({ changeSet: legacy }).changeSet, legacy)
  const undoConflict = { ...legacy, status: 'conflicted', conflictOperation: 'undo' }
  assert.deepEqual(recoverReview({ changeSet: undoConflict }).changeSet, undoConflict)
})
