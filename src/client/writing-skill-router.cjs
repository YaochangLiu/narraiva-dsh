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

const DIAGNOSTIC = /(诊断|分析|检查|问题|节奏|结构|视角|人物弧|张力|逻辑|连贯|评估|点评)/iu
const EXPLAIN_REVISION = /(为什么.*(?:改|修改)|解释.*(?:改|修改|proposal|提案)|修改理由|改动理由|revision)/iu
const AI_FLAVOR = /(ai\s*腔|像\s*ai|ai\s*flavou?r|formulaic|模板感|机械感)/iu
const SECOND_DIRECTION = /(第二(?:个)?方向|另一(?:个)?方向|备选方向|上个方向)/iu

function routeWritingSkills({ mode, input = '', selection = '', activeProposal = null, changeSet = null, referencedDirection = false, includeCurrent = true } = {}) {
  if (mode !== 'ask' && mode !== 'write') throw new Error(`不支持的 Narraiva 模式：${mode}`)
  const message = String(input)
  const selected = String(selection || '')
  const selectionAuthorized = Boolean(selected) && /@选中文本/u.test(message)
  let intent; let skills; let reason; let contextScope

  if (mode === 'ask') {
    if ((activeProposal || changeSet) && EXPLAIN_REVISION.test(message)) {
      intent = 'explain_revision'; skills = ['revision-explain']; reason = activeProposal ? '问题指向当前待审 Proposal 的修改理由。' : '问题指向最近的 Proposal / Change Set 修改记录。'; contextScope = 'review_record'
    } else if (DIAGNOSTIC.test(message)) {
      intent = selectionAuthorized ? 'diagnose_selection' : 'diagnose_chapter'
      skills = [selectionAuthorized ? 'diagnostic-selection' : 'diagnostic-chapter']
      reason = selectionAuthorized ? '诊断请求明确引用了有效选区。' : '诊断请求使用当前章节作为证据。'
      contextScope = selectionAuthorized ? 'selection' : (includeCurrent ? 'current_document' : 'none')
    } else {
      intent = 'respond'; skills = ['agent-respond']; reason = '普通写作讨论，不创建稿件修改。'; contextScope = selectionAuthorized ? 'selection' : (includeCurrent ? 'current_document' : 'none')
    }
  } else if (activeProposal) {
    intent = 'refine_active_proposal'; skills = ['active-revision-refine']; reason = '当前存在待审 Proposal，本轮生成完整替代 Proposal。'; contextScope = 'active_proposal'
  } else if (selectionAuthorized) {
    intent = 'rewrite_selection'
    skills = [selected.length <= 80 ? 'short-selection-rewrite' : 'selection-rewrite']
    if (AI_FLAVOR.test(message)) skills.push('ai-flavor-reduction')
    reason = selected.length <= 80 ? '有效选区不超过 80 字，采用短选区精修。' : '有效选区超过 80 字，采用完整选区改写。'
    contextScope = 'selection'
  } else {
    intent = 'continue_at_cursor'; skills = ['continue-at-cursor']; reason = 'Write 没有授权选区，将在当前光标位置续写。'; contextScope = 'cursor'
    if (referencedDirection || SECOND_DIRECTION.test(message)) {
      skills.push('second-direction-write')
      reason = '请求引用第二写作方向，并在允许位置续写。'
    }
  }

  return Object.freeze({
    version: 1,
    mode,
    intent,
    skills: Object.freeze(skills),
    labels: Object.freeze(skills.map(name => SKILLS[name].label)),
    reason,
    contextScope,
    outputContract: mode === 'write' ? 'proposal' : 'assistant_text',
  })
}

function skillInvocationLines(route) {
  return (route?.skills || []).map(name => `/${name}`)
}

module.exports = { SKILLS, routeWritingSkills, skillInvocationLines }
