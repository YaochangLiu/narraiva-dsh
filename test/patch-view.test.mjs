import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPatchView, changeSummary } from '../src/client/patch-view.cjs'

test('places Patch changes inside the complete manuscript at exact offsets', () => {
  const content = 'Alpha\nbeta\ngamma'
  const view = buildPatchView(content, [{ id: 'c1', startOffset: 6, endOffset: 10, beforeText: 'beta', afterText: 'BETA', status: 'pending' }])
  assert.deepEqual(view.segments.map(item => item.type), ['equal', 'change', 'equal'])
  assert.equal(view.segments[1].change.startLine, 2)
  assert.equal(view.segments.map(item => item.type === 'equal' ? item.text : item.change.beforeText).join(''), content)
  assert.equal(changeSummary(view.segments[1].change), '替换 · +4 −4 字符')
})

test('rejected changes remain original prose and leave the review projection', () => {
  const view = buildPatchView('hello', [{ id: 'c1', startOffset: 5, endOffset: 5, beforeText: '', afterText: ' world', status: 'rejected' }])
  assert.equal(view.changeCount, 0)
  assert.equal(view.segments[0].text, 'hello')
})
