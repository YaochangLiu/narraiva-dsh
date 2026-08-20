import assert from 'node:assert/strict'
import test from 'node:test'

import { NarraivaConversationAdapter, contextSummary, displayQuestion, projectConversationSnapshot } from '../src/client/conversation-adapter.cjs'

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

test('creates one project session, selects Ask preset, sends and cancels through DSH', async () => {
  const sent = []; let cancelled = 0; const listeners = new Set()
  const session = { getSnapshot: () => snapshot(), subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) }, prompt: async content => { sent.push(content); return { ok: true, value: { accepted: true } } }, cancel: async () => { cancelled++; return { ok: true, value: { accepted: true } } } }
  const rows = { ids: [], byId: {}, current: undefined }
  const sessions = { list: { getSnapshot: () => rows }, create: async () => { rows.ids.push('s1'); rows.byId.s1 = { id: 's1', blank: true }; return 's1' }, binding: id => id === 's1' ? { session } : undefined, open: id => { rows.current = id }, noteAgentPreset: (id, preset) => { rows.byId[id].agentPreset = preset } }
  const selected = []
  const api = { agentPresets: { select: async payload => { selected.push(payload); return { result: { ok: true, value: { agentPreset: payload.agentPreset } } } } } }
  const adapter = new NarraivaConversationAdapter({ sessions, api })
  const opened = await adapter.ensureProjectSession({ id: 'p1', conversation: {} })
  assert.equal(opened.sessionId, 's1')
  assert.deepEqual(selected, [{ sessionId: 's1', agentPreset: 'narraiva-ask' }])
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

test('fails closed or creates a fresh session when the active session is not Ask', async () => {
  const rows = { ids: ['old'], byId: { old: { id: 'old', blank: false, agentPreset: 'other' } } }
  const face = { getSnapshot: () => snapshot(), subscribe: () => () => {} }
  const sessions = { list: { getSnapshot: () => rows }, binding: id => rows.byId[id] ? { session: face } : undefined, create: async () => { rows.ids.push('fresh'); rows.byId.fresh = { id: 'fresh', blank: true }; return 'fresh' }, open: () => {}, noteAgentPreset: (id, preset) => { rows.byId[id].agentPreset = preset } }
  const api = { agentPresets: { select: async payload => ({ result: { ok: true, value: { agentPreset: payload.agentPreset } } }) } }
  const opened = await new NarraivaConversationAdapter({ sessions, api }).ensureProjectSession({ conversation: { activeId: 'old', ids: ['old'] } })
  assert.equal(opened.sessionId, 'fresh')
  await assert.rejects(() => new NarraivaConversationAdapter({ sessions: { ...sessions, create: async () => 'unbound' }, api: {} }).ensureProjectSession({ conversation: {} }), /Ask preset 绑定能力/)
})

test('exposes history pagination state and maps terminal DSH errors', () => {
  const view = projectConversationSnapshot({ nodes: [{ kind: 'turn-error', seq: 1, message: 'quota exceeded', code: 'quota' }], hasMore: true, loadingOlder: true })
  assert.equal(view.hasMore, true)
  assert.equal(view.loadingOlder, true)
  assert.match(view.messages[0].content, /额度/)
})

test('binds Write to a separate fail-closed writer session', async () => {
  const rows = { byId: {} }
  const session = { getSnapshot: () => snapshot(), subscribe: () => () => {} }
  let count = 0; const selected = []
  const sessions = { list: { getSnapshot: () => rows }, create: async () => { const id = `w${++count}`; rows.byId[id] = { blank: true }; return id }, binding: id => rows.byId[id] ? { session } : undefined, open: () => {}, noteAgentPreset: (id, preset) => { rows.byId[id].agentPreset = preset } }
  const adapter = new NarraivaConversationAdapter({ sessions, api: { agentPresets: { select: async payload => { selected.push(payload); return { result: { ok: true } } } } } })
  const opened = await adapter.ensureModeSession({ id: 'book' }, 'write')
  assert.equal(opened.manifest.conversation.writeId, 'w1')
  assert.deepEqual(selected, [{ sessionId: 'w1', agentPreset: 'narraiva-writer' }])
})
