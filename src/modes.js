const modes = Object.freeze([
  Object.freeze({
    id: 'ask',
    agentPreset: 'narraiva-conversation',
    label: 'Narraiva Ask',
    purpose: '讨论、分析与澄清',
  }),
  Object.freeze({
    id: 'write',
    agentPreset: 'narraiva-conversation',
    label: 'Narraiva Write',
    purpose: '生成作者可审阅的写作 Proposal',
  }),
])

/**
 * The sole mode seam for future Narraiva UI and session creation code.
 * Callers choose a product mode; DSH preset identifiers stay internal here.
 */
export function listNarraivaModes() {
  return modes.map(mode => ({ ...mode }))
}

export function resolveNarraivaMode(modeId) {
  const mode = modes.find(candidate => candidate.id === modeId)
  if (mode === undefined) throw new Error(`Unknown Narraiva mode: ${modeId}`)
  return { ...mode }
}
