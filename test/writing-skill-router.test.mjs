import assert from 'node:assert/strict'
import test from 'node:test'

import { routeWritingSkills, skillInvocationLines } from '../src/client/writing-skill-router.cjs'

test('Ask diagnoses the selected passage through a visible read-only route', () => {
  const route = routeWritingSkills({ mode: 'ask', input: '@选中文本 诊断这段文字的节奏', selection: 'A short passage.' })
  assert.deepEqual(route.skills, ['diagnostic-selection'])
  assert.equal(route.intent, 'diagnose_selection')
  assert.equal(route.outputContract, 'assistant_text')
  assert.equal(route.contextScope, 'selection')
})

test('Ask explains a pending Proposal without creating another Proposal', () => {
  const route = routeWritingSkills({ mode: 'ask', input: '为什么这样修改？', activeProposal: { id: 'p1' } })
  assert.deepEqual(route.skills, ['revision-explain'])
  assert.equal(route.intent, 'explain_revision')
  assert.equal(route.outputContract, 'assistant_text')
})

test('Ask explains a historical Change Set after the Proposal lifecycle completes', () => {
  const route = routeWritingSkills({ mode: 'ask', input: '解释一下上次改动', changeSet: { id: 'cs1', status: 'applied' } })
  assert.deepEqual(route.skills, ['revision-explain'])
  assert.equal(route.contextScope, 'review_record')
})

test('Write combines short-selection and AI-flavor methods deterministically', () => {
  const route = routeWritingSkills({ mode: 'write', input: '@选中文本 降低 AI 腔，写得更自然', selection: 'It was very meaningful.' })
  assert.deepEqual(route.skills, ['short-selection-rewrite', 'ai-flavor-reduction'])
  assert.equal(route.intent, 'rewrite_selection')
  assert.equal(route.outputContract, 'proposal')
})

test('Write refines an active Proposal before considering selection or continuation', () => {
  const route = routeWritingSkills({ mode: 'write', input: '@选中文本 把语气再克制一些', selection: 'Selected', activeProposal: { id: 'p1' } })
  assert.deepEqual(route.skills, ['active-revision-refine'])
  assert.equal(route.intent, 'refine_active_proposal')
})

test('Write can continue from a referenced second direction', () => {
  const route = routeWritingSkills({ mode: 'write', input: '沿用第二个方向继续写', referencedDirection: true })
  assert.deepEqual(route.skills, ['continue-at-cursor', 'second-direction-write'])
  assert.equal(route.intent, 'continue_at_cursor')
})

test('skill invocation lines use DSH explicit skill gestures', () => {
  assert.deepEqual(skillInvocationLines({ skills: ['selection-rewrite', 'ai-flavor-reduction'] }), [
    '/selection-rewrite',
    '/ai-flavor-reduction',
  ])
})

test('an editor selection is not routed or sent until the author mentions it', () => {
  const route = routeWritingSkills({ mode: 'write', input: '继续写下去', selection: 'not authorized' })
  assert.deepEqual(route.skills, ['continue-at-cursor'])
  assert.equal(route.contextScope, 'cursor')
})
