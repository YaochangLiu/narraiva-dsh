import assert from 'node:assert/strict'
import test from 'node:test'

import { NarraivaConversationAdapter, contextSummary, displayQuestion, projectConversationSnapshot, requestUsesProposalProtocol } from '../src/client/conversation-adapter.cjs'

function snapshot(overrides = {}) { return { nodes: [], partial: null, running: false, promptError: null, openState: 'open', ...overrides } }

test('projects DSH user, assistant, partial and error nodes into Narraiva messages', () => {
  const view = projectConversationSnapshot(snapshot({
    nodes: [
      { kind: 'user', seq: 1, time: 10, content: [{ type: 'text', text: '[NARRAIVA_ASK_V1]\n用户问题：\n分析节奏' }] },
      { kind: 'assistant', seq: 2, time: 20, blocks: [{ kind: 'reasoning', text: '内部' }, { kind: 'text', text: '节奏较慢。' }] },
      { kind: 'turn-error', seq: 3, time: 30, message: 'rate limited', code: 'rate-limit' },
    ],
    partial: { turn: 2, step: 1, blocks: [{ kind: 'text', text: '正在分析' }] }, running: true,
  }))
  assert.deepEqual(view.messages.map(item => [item.role, item.content, item.status]), [
    ['user', '分析节奏', 'done'], ['assistant', '节奏较慢。', 'done'], ['assistant', 'DeepSeek 暂时限制了请求或额度不足，请稍后重试。', 'error'], ['assistant', '正在分析', 'streaming'],
  ])
  assert.equal(view.running, true)
  assert.match(view.messages[0].contextSummary || '', /当前章节|^$/)
})

test('creates one project session, selects the unified preset, sends and cancels through DSH', async () => {
  const sent = []; let cancelled = 0; const listeners = new Set()
  const session = { getSnapshot: () => snapshot(), subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) }, prompt: async content => { sent.push(content); return { ok: true, value: { accepted: true } } }, cancel: async () => { cancelled++; return { ok: true, value: { accepted: true } } } }
  const rows = { ids: [], byId: {}, current: undefined }
  const sessions = { list: { getSnapshot: () => rows }, create: async () => { rows.ids.push('s1'); rows.byId.s1 = { id: 's1', blank: true }; return 's1' }, binding: id => id === 's1' ? { session } : undefined, open: id => { rows.current = id }, noteAgentPreset: (id, preset) => { rows.byId[id].agentPreset = preset } }
  const selected = []
  const api = { agentPresets: { select: async payload => { selected.push(payload); return { result: { ok: true, value: { agentPreset: payload.agentPreset } } } } } }
  const adapter = new NarraivaConversationAdapter({ sessions, api })
  const opened = await adapter.ensureProjectSession({ id: 'p1', conversation: {} })
  assert.equal(opened.sessionId, 's1')
  assert.deepEqual(selected, [{ sessionId: 's1', agentPreset: 'narraiva-conversation' }])
  await adapter.send('s1', 'hello'); await adapter.cancel('s1')
  assert.equal(sent[0][0].text, 'hello'); assert.equal(cancelled, 1)
})

test('maps DSH admission failures to useful Narraiva errors', async () => {
  const session = { prompt: async () => ({ ok: false, error: { code: 'unauthorized', message: 'missing provider key' } }) }
  const adapter = new NarraivaConversationAdapter({ sessions: { binding: () => ({ session }) }, api: {} })
  await assert.rejects(() => adapter.send('s1', 'hello'), /DSH 中配置 DeepSeek 凭据/)
})

test('versioned request metadata survives localized prompt copy changes', () => {
  const prompt = `[NARRAIVA_ASK_V1]\n[NARRAIVA_META_V1]${encodeURIComponent(JSON.stringify({ question: '真实问题', receipt: { items: [{ label: '当前章节', path: 'manuscript/a.md', characterCount: 4, revision: '1:4' }] } }))}\n任意文案`
  assert.equal(displayQuestion(prompt), '真实问题')
  assert.match(contextSummary(prompt), /manuscript\/a\.md/)
})

test('recognizes mode only from the leading request protocol marker', () => {
  assert.equal(requestUsesProposalProtocol('[NARRAIVA_WRITE_V1]\nrequest'), true)
  assert.equal(requestUsesProposalProtocol('[NARRAIVA_ASK_V1]\nWhat does [NARRAIVA_WRITE_V1] mean?'), false)
})

test('projects an assistant-first snapshot by its stable DSH turn mode', () => {
  const literal = '<NARRAIVA_PROPOSAL_V1>example</NARRAIVA_PROPOSAL_V1>'
  const view = projectConversationSnapshot(snapshot({ nodes: [
    { kind: 'assistant', turn: 7, seq: 2, blocks: [{ kind: 'text', text: literal }] },
    { kind: 'user', turn: 7, seq: 1, content: [{ type: 'text', text: '[NARRAIVA_ASK_V1]\nExplain this example' }] },
  ] }))
  assert.equal(view.messages[0].content, literal)
  assert.equal(view.messages[0].protocolContent, undefined)
})

test('carries turn mode across paginated snapshots and applies it to partial output', () => {
  const protocolByTurn = new Map()
  projectConversationSnapshot(snapshot({ nodes: [{ kind: 'user', turn: 8, seq: 1, content: [{ type: 'text', text: '[NARRAIVA_ASK_V1]\nExplain an envelope' }] }] }), { protocolByTurn })
  const askPage = projectConversationSnapshot(snapshot({ nodes: [{ kind: 'assistant', turn: 8, seq: 2, blocks: [{ kind: 'text', text: '<NARRAIVA_PROPOSAL_V1>example</NARRAIVA_PROPOSAL_V1>' }] }] }), { protocolByTurn })
  assert.match(askPage.messages[0].content, /NARRAIVA_PROPOSAL/)

  const write = projectConversationSnapshot(snapshot({
    nodes: [{ kind: 'user', turn: 9, seq: 3, content: [{ type: 'text', text: '[NARRAIVA_WRITE_V1]\nRewrite' }] }],
    partial: { turn: 9, step: 1, blocks: [{ kind: 'text', text: '<NARRAIVA_PROPOSAL_V1>{' }] },
  }), { protocolByTurn })
  assert.equal(write.messages.at(-1).kind, 'proposal-streaming')
})

test('fails closed or creates a fresh session when the active session is not unified Narraiva', async () => {
  const rows = { ids: ['old'], byId: { old: { id: 'old', blank: false, agentPreset: 'other' } } }
  const face = { getSnapshot: () => snapshot(), subscribe: () => () => {} }
  const sessions = { list: { getSnapshot: () => rows }, binding: id => rows.byId[id] ? { session: face } : undefined, create: async () => { rows.ids.push('fresh'); rows.byId.fresh = { id: 'fresh', blank: true }; return 'fresh' }, open: () => {}, noteAgentPreset: (id, preset) => { rows.byId[id].agentPreset = preset } }
  const api = { agentPresets: { select: async payload => ({ result: { ok: true, value: { agentPreset: payload.agentPreset } } }) } }
  const opened = await new NarraivaConversationAdapter({ sessions, api }).ensureProjectSession({ conversation: { activeId: 'old', ids: ['old'] } })
  assert.equal(opened.sessionId, 'fresh')
  await assert.rejects(() => new NarraivaConversationAdapter({ sessions: { ...sessions, create: async () => 'unbound' }, api: {} }).ensureProjectSession({ conversation: {} }), /Narraiva preset 绑定能力/)
})

test('exposes history pagination state and maps terminal DSH errors', () => {
  const view = projectConversationSnapshot({ nodes: [{ kind: 'turn-error', seq: 1, message: 'quota exceeded', code: 'quota' }], hasMore: true, loadingOlder: true })
  assert.equal(view.hasMore, true)
  assert.equal(view.loadingOlder, true)
  assert.match(view.messages[0].content, /额度/)
})

test('projects structured Proposal envelopes as protocol items, never chat prose', () => {
  const raw = '<NARRAIVA_PROPOSAL_V1>{"summary":"test","changes":[]}</NARRAIVA_PROPOSAL_V1>'
  const view = projectConversationSnapshot(snapshot({ nodes: [{ kind: 'assistant', seq: 9, blocks: [{ kind: 'text', text: raw }] }] }))
  assert.equal(view.messages[0].kind, 'proposal-protocol')
  assert.equal(view.messages[0].content, '')
  assert.equal(view.messages[0].protocolContent, raw)
})

test('malformed Proposal protocol is also quarantined from chat rendering', () => {
  const raw = '<NARRAIVA_PROPOSAL_V1>{broken'
  const view = projectConversationSnapshot(snapshot({ nodes: [{ kind: 'assistant', seq: 10, blocks: [{ kind: 'text', text: raw }] }] }))
  assert.equal(view.messages[0].kind, 'proposal-protocol')
  assert.equal(view.messages[0].content, '')
})

test('keeps assistant prose while removing an embedded Proposal envelope', () => {
  const envelope = '<NARRAIVA_PROPOSAL_V1>{"summary":"test","changes":[]}</NARRAIVA_PROPOSAL_V1>'
  const view = projectConversationSnapshot(snapshot({ nodes: [{ kind: 'assistant', seq: 11, blocks: [{ kind: 'text', text: `Here is the review.\n${envelope}` }] }] }))
  assert.equal(view.messages[0].kind, 'message')
  assert.equal(view.messages[0].content, 'Here is the review.')
  assert.equal(view.messages[0].protocolContent, envelope)
})

test('quarantines a streaming Proposal after a prose preamble', () => {
  const view = projectConversationSnapshot(snapshot({ partial: { turn: 2, step: 1, blocks: [{ kind: 'text', text: 'Here it is:\n<NARRAIVA_PROPOSAL_V1>{' }] } }))
  assert.equal(view.messages[0].kind, 'proposal-streaming')
  assert.doesNotMatch(view.messages[0].content, /NARRAIVA_PROPOSAL/)
})

test('quarantines malformed final protocol after prose and leaves Ask snapshots unchanged', () => {
  const raw = 'Here it is:\n<NARRAIVA_PROPOSAL_V1>{broken'
  const write = projectConversationSnapshot(snapshot({ nodes: [{ kind: 'assistant', seq: 12, blocks: [{ kind: 'text', text: raw }] }] }))
  assert.equal(write.messages[0].content, 'Here it is:')
  assert.match(write.messages[0].protocolContent, /NARRAIVA_PROPOSAL/)
  const ask = projectConversationSnapshot(snapshot({ nodes: [{ kind: 'assistant', seq: 12, blocks: [{ kind: 'text', text: raw }] }] }), { proposalProtocol: false })
  assert.equal(ask.messages[0].content, raw)
  assert.equal(ask.messages[0].protocolContent, undefined)
})

test('never renders a second Proposal envelope as assistant prose', () => {
  const one = '<NARRAIVA_PROPOSAL_V1>{"summary":"one","changes":[]}</NARRAIVA_PROPOSAL_V1>'
  const two = '<NARRAIVA_PROPOSAL_V1>{"summary":"two","changes":[]}</NARRAIVA_PROPOSAL_V1>'
  const view = projectConversationSnapshot(snapshot({ nodes: [{ kind: 'assistant', seq: 13, blocks: [{ kind: 'text', text: `Review:\n${one}\n${two}` }] }] }))
  assert.equal(view.messages[0].content, 'Review:')
  assert.doesNotMatch(view.messages[0].content, /NARRAIVA_PROPOSAL/)
  assert.equal(view.messages[0].protocolContent, one)
})

test('Ask and Write share one fail-closed Narraiva conversation session', async () => {
  const rows = { byId: {} }
  const session = { getSnapshot: () => snapshot(), subscribe: () => () => {} }
  let count = 0; const selected = []
  const sessions = { list: { getSnapshot: () => rows }, create: async () => { const id = `w${++count}`; rows.byId[id] = { blank: true }; return id }, binding: id => rows.byId[id] ? { session } : undefined, open: () => {}, noteAgentPreset: (id, preset) => { rows.byId[id].agentPreset = preset } }
  const adapter = new NarraivaConversationAdapter({ sessions, api: { agentPresets: { select: async payload => { selected.push(payload); return { result: { ok: true } } } } } })
  const ask = await adapter.ensureModeSession({ id: 'book', conversation: {} }, 'ask')
  const write = await adapter.ensureModeSession(ask.manifest, 'write')
  assert.equal(write.sessionId, ask.sessionId)
  assert.equal(write.manifest.conversation.activeId, 'w1')
  assert.equal(write.manifest.conversation.writeId, undefined)
  assert.deepEqual(selected, [{ sessionId: 'w1', agentPreset: 'narraiva-conversation' }])
})

test('migrates legacy Ask and Write references into history before creating a unified session', async () => {
  const rows = { byId: { ask1: { blank: false, agentPreset: 'narraiva-ask' }, write1: { blank: false, agentPreset: 'narraiva-writer' } } }
  const face = { getSnapshot: () => snapshot(), subscribe: () => () => {} }
  const sessions = { list: { getSnapshot: () => rows }, create: async () => { rows.byId.unified = { blank: true }; return 'unified' }, binding: id => rows.byId[id] ? { session: face } : undefined, open: () => {}, noteAgentPreset: (id, preset) => { rows.byId[id].agentPreset = preset } }
  const api = { agentPresets: { select: async () => ({ result: { ok: true } }) } }
  const opened = await new NarraivaConversationAdapter({ sessions, api }).ensureModeSession({ conversation: { activeId: 'ask1', ids: ['ask1'], writeId: 'write1' } }, 'write')
  assert.equal(opened.sessionId, 'unified')
  assert.deepEqual(opened.manifest.conversation.ids, ['ask1', 'write1', 'unified'])
  assert.equal(opened.manifest.conversation.writeId, undefined)
})
