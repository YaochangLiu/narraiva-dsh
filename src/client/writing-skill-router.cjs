const SKILLS = Object.freeze({
  'diagnostic-chapter': { label: '章节诊断', mode: 'ask' },
  'diagnostic-selection': { label: '选区诊断', mode: 'ask' },
  'selection-rewrite': { label: '选区改写', mode: 'write' },
  'short-selection-rewrite': { label: '短选区精修', mode: 'write' },
  'ai-flavor-reduction': { label: '降低 AI 腔', mode: 'write' },
  'active-revision-refine': { label: '继续修改 Proposal', mode: 'write' },
  'continue-at-cursor': { label: '从光标处续写', mode: 'write' },
  'second-direction-write': { label: '沿第二方向续写', mode: 'write' },
  'agent-respond': { label: '写作讨论', mode: 'ask' },
  'revision-explain': { label: '修改解释', mode: 'ask' },
})

const DIAGNOSTIC = /(诊断|分析|检查|评估|点评|审视|看看.*(?:节奏|结构|视角|人物弧|张力|逻辑|连贯)|(?:节奏|结构|视角|人物弧|张力|逻辑|连贯).*(?:如何|怎么样|是否|有无))/iu
const EXPLAIN_REVISION = /(为什么.*(?:改|修改)|解释.*(?:改|修改|proposal|提案)|修改理由|改动理由|revision)/iu
const AI_FLAVOR = /(ai\s*腔|像\s*ai|ai\s*flavou?r|formulaic|模板感|机械感)/iu
const SECOND_DIRECTION = /(第二(?:个)?方向|另一(?:个)?方向|备选方向|上个方向)/iu

function routeState({ mode, input = '', selection = '', activeProposal = null, changeSet = null, referencedDirection = false, includeCurrent = true, retrievalIncluded = false } = {}) {
  if (mode !== 'ask' && mode !== 'write') throw new Error(`不支持的 Narraiva 模式：${mode}`)
  const message = String(input)
  const selected = String(selection || '')
  const selectionAuthorized = Boolean(selected) && /@选中文本/u.test(message)
  const currentAuthorized = includeCurrent || /@当前章节/u.test(message)
  return { mode, message, selected, selectionAuthorized, currentAuthorized, activeProposal, changeSet, referencedDirection, includeCurrent, retrievalIncluded }
}

function availableWritingSkillOptions(input = {}) {
  const state = routeState(input)
  let names
  if (state.mode === 'ask') {
    names = ['agent-respond']
    if (state.selectionAuthorized) names.push('diagnostic-selection')
    else if (state.currentAuthorized) names.push('diagnostic-chapter')
    if (state.activeProposal || state.changeSet) names.push('revision-explain')
  } else if (state.activeProposal) names = ['active-revision-refine']
  else if (state.selectionAuthorized) names = ['short-selection-rewrite', 'selection-rewrite', 'ai-flavor-reduction']
  else names = ['continue-at-cursor', 'second-direction-write']
  return Object.freeze(names.map(id => Object.freeze({ id, label: SKILLS[id].label, mode: SKILLS[id].mode })))
}

function manualRoute(state, preferredSkill) {
  const contextScope = state.selectionAuthorized ? 'selection' : state.activeProposal ? 'active_proposal' : state.mode === 'write' ? 'cursor' : (state.includeCurrent ? 'current_document' : 'none')
  const routes = {
    'agent-respond': ['respond', ['agent-respond'], '作者为本轮选择了写作讨论。', contextScope],
    'diagnostic-chapter': ['diagnose_chapter', ['diagnostic-chapter'], '作者为本轮选择了章节诊断。', 'current_document'],
    'diagnostic-selection': ['diagnose_selection', ['diagnostic-selection'], '作者为本轮选择了选区诊断。', 'selection'],
    'revision-explain': ['explain_revision', ['revision-explain'], '作者为本轮选择了解释 Proposal / Change Set。', 'review_record'],
    'short-selection-rewrite': ['rewrite_selection', ['short-selection-rewrite'], '作者为本轮选择了短选区精修。', 'selection'],
    'selection-rewrite': ['rewrite_selection', ['selection-rewrite'], '作者为本轮选择了完整选区改写。', 'selection'],
    'ai-flavor-reduction': ['rewrite_selection', [Array.from(state.selected).length <= 80 ? 'short-selection-rewrite' : 'selection-rewrite', 'ai-flavor-reduction'], '作者为本轮选择了降低 AI 腔，并组合相应选区改写方法。', 'selection'],
    'active-revision-refine': ['refine_active_proposal', ['active-revision-refine'], '作者为本轮选择了继续修改当前 Proposal。', 'active_proposal'],
    'continue-at-cursor': ['continue_at_cursor', ['continue-at-cursor'], '作者为本轮选择了从当前光标处续写。', 'cursor'],
    'second-direction-write': ['continue_at_cursor', ['continue-at-cursor', 'second-direction-write'], '作者为本轮选择了沿第二写作方向续写。', 'cursor'],
  }
  return routes[preferredSkill]
}

function routeWritingSkills(input = {}) {
  const state = routeState(input)
  const { mode, message, selected, selectionAuthorized, currentAuthorized, activeProposal, changeSet, referencedDirection, includeCurrent, retrievalIncluded } = state
  const preferredSkill = String(input.preferredSkill || '') || null
  const available = availableWritingSkillOptions(input)
  const acceptedOverride = preferredSkill && available.some(option => option.id === preferredSkill)
  let intent; let skills; let reason; let contextScope

  if (acceptedOverride) {
    [intent, skills, reason, contextScope] = manualRoute(state, preferredSkill)
  } else if (mode === 'ask') {
    if ((activeProposal || changeSet) && EXPLAIN_REVISION.test(message)) {
      intent = 'explain_revision'; skills = ['revision-explain']; reason = activeProposal ? '问题指向当前待审 Proposal 的修改理由。' : '问题指向最近的 Proposal / Change Set 修改记录。'; contextScope = 'review_record'
    } else if (DIAGNOSTIC.test(message)) {
      intent = selectionAuthorized ? 'diagnose_selection' : 'diagnose_chapter'
      skills = [selectionAuthorized ? 'diagnostic-selection' : 'diagnostic-chapter']
      reason = selectionAuthorized ? '诊断请求明确引用了有效选区。' : '诊断请求使用当前章节作为证据。'
      contextScope = selectionAuthorized ? 'selection' : (currentAuthorized ? 'current_document' : 'none')
    } else {
      intent = 'respond'; skills = ['agent-respond']; reason = '普通写作讨论，不创建稿件修改。'; contextScope = selectionAuthorized ? 'selection' : (currentAuthorized ? 'current_document' : 'none')
    }
  } else if (activeProposal) {
    intent = 'refine_active_proposal'; skills = ['active-revision-refine']; reason = '当前存在待审 Proposal，本轮生成完整替代 Proposal。'; contextScope = 'active_proposal'
  } else if (selectionAuthorized) {
    intent = 'rewrite_selection'
    skills = [Array.from(selected).length <= 80 ? 'short-selection-rewrite' : 'selection-rewrite']
    if (AI_FLAVOR.test(message)) skills.push('ai-flavor-reduction')
    reason = Array.from(selected).length <= 80 ? '有效选区不超过 80 字，采用短选区精修。' : '有效选区超过 80 字，采用完整选区改写。'
    contextScope = 'selection'
  } else {
    intent = 'continue_at_cursor'; skills = ['continue-at-cursor']; reason = 'Write 没有授权选区，将在当前光标位置续写。'; contextScope = 'cursor'
    if (referencedDirection || SECOND_DIRECTION.test(message)) {
      skills.push('second-direction-write')
      reason = '请求引用第二写作方向，并在允许位置续写。'
    }
  }

  const contextScopes = mode === 'ask'
    ? [selectionAuthorized ? 'selection' : (currentAuthorized ? 'current_document' : 'none'), ...(intent === 'explain_revision' ? ['review_record'] : []), ...(retrievalIncluded ? ['project_retrieval'] : [])]
    : [contextScope === 'cursor' ? 'cursor' : 'current_document', ...(contextScope === 'selection' ? ['selection'] : []), ...(contextScope === 'active_proposal' ? ['active_proposal'] : []), ...(retrievalIncluded ? ['project_retrieval'] : [])]

  return Object.freeze({
    version: 1,
    mode,
    intent,
    skills: Object.freeze(skills),
    labels: Object.freeze(skills.map(name => SKILLS[name].label)),
    reason,
    contextScope,
    contextScopes: Object.freeze([...new Set(contextScopes)]),
    outputContract: mode === 'write' ? 'proposal' : 'assistant_text',
    selectionSource: acceptedOverride ? 'manual' : 'automatic',
    preferredSkill: acceptedOverride ? preferredSkill : null,
    overrideRejected: preferredSkill && !acceptedOverride ? preferredSkill : null,
  })
}

function skillInvocationLines(route) {
  return (route?.skills || []).map(name => `/${name}`)
}

module.exports = { SKILLS, availableWritingSkillOptions, routeWritingSkills, skillInvocationLines }
