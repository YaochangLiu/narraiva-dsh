import assert from 'node:assert/strict'
import test from 'node:test'

import { availableWritingSkillOptions, routeWritingSkills, skillInvocationLines } from '../src/client/writing-skill-router.cjs'

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

test('ordinary Ask wording containing 问题 does not accidentally trigger diagnosis', () => {
  const route = routeWritingSkills({ mode: 'ask', input: '我有一个问题，主角现在应该离开吗？' })
  assert.deepEqual(route.skills, ['agent-respond'])
  assert.equal(route.intent, 'respond')
})

test('manual AI-flavor choice composes with the correct selection rewrite method', () => {
  const route = routeWritingSkills({ mode: 'write', input: '@选中文本 改自然一些', selection: 'A short line.', preferredSkill: 'ai-flavor-reduction' })
  assert.deepEqual(route.skills, ['short-selection-rewrite', 'ai-flavor-reduction'])
  assert.equal(route.selectionSource, 'manual')
  assert.equal(route.preferredSkill, 'ai-flavor-reduction')
})

test('manual choices are limited by mode and authorized context', () => {
  assert.deepEqual(availableWritingSkillOptions({ mode: 'ask', input: '聊聊人物', selection: 'hidden' }).map(item => item.id), ['agent-respond', 'diagnostic-chapter'])
  assert.deepEqual(availableWritingSkillOptions({ mode: 'write', input: '@选中文本 改写', selection: 'visible' }).map(item => item.id), ['short-selection-rewrite', 'selection-rewrite', 'ai-flavor-reduction'])
})

test('a stale manual override falls back to automatic routing without widening authority', () => {
  const route = routeWritingSkills({ mode: 'write', input: '继续写', preferredSkill: 'selection-rewrite' })
  assert.deepEqual(route.skills, ['continue-at-cursor'])
  assert.equal(route.selectionSource, 'automatic')
  assert.equal(route.overrideRejected, 'selection-rewrite')
  assert.equal(route.contextScope, 'cursor')
})

test('route receipt records the union of manuscript and review contexts actually sent', () => {
  const current = routeWritingSkills({ mode: 'ask', input: '为什么这样修改？', activeProposal: { id: 'p1' }, includeCurrent: true })
  assert.deepEqual(current.contextScopes, ['current_document', 'review_record'])

  const selected = routeWritingSkills({ mode: 'ask', input: '@选中文本 为什么这样修改？', selection: 'line', activeProposal: { id: 'p1' }, includeCurrent: false, retrievalIncluded: true })
  assert.deepEqual(selected.contextScopes, ['selection', 'review_record', 'project_retrieval'])
})

test('explicit current chapter mention is reflected when default context is off', () => {
  const input = { mode: 'ask', input: '@当前章节 讨论这一幕', includeCurrent: false }
  const route = routeWritingSkills(input)
  assert.deepEqual(route.contextScopes, ['current_document'])
  assert.ok(availableWritingSkillOptions(input).some(option => option.id === 'diagnostic-chapter'))
})
