import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addDocument,
  createProjectManifest,
  parseProjectManifest,
  removeDocument,
  renameDocument,
  reorderDocument,
  validateProjectPath,
} from '../src/client/project-domain.cjs'

test('creates a versioned Narraiva project with one manuscript', () => {
  const manifest = createProjectManifest('The Zero Crown', { now: '2026-08-20T00:00:00.000Z', id: 'project-1' })
  assert.equal(manifest.version, 1)
  assert.equal(manifest.name, 'The Zero Crown')
  assert.equal(manifest.documents[0].path, 'manuscript/chapter_001.md')
  assert.equal(manifest.activeDocumentId, manifest.documents[0].id)
})

test('rejects absolute and escaping document paths', () => {
  for (const value of ['../secret.md', 'manuscript/../../secret.md', '/tmp/a.md', 'C:\\secret.md', 'manuscript/a.txt']) {
    assert.throws(() => validateProjectPath(value), /project-relative Markdown path/)
  }
  assert.equal(validateProjectPath('manuscript/chapter_001.md'), 'manuscript/chapter_001.md')
})

test('parses manifests strictly and reports corrupt data', () => {
  assert.throws(() => parseProjectManifest('{'), /invalid JSON/)
  assert.throws(() => parseProjectManifest(JSON.stringify({ version: 99 })), /unsupported project version/)
  const manifest = createProjectManifest('Novel', { id: 'p', now: '2026-08-20T00:00:00.000Z' })
  manifest.documents[0].path = '../escape.md'
  assert.throws(() => parseProjectManifest(JSON.stringify(manifest)), /project-relative Markdown path/)
})

test('adds, renames, reorders and removes documents without mutating input', () => {
  const initial = createProjectManifest('Novel', { id: 'p', now: '2026-08-20T00:00:00.000Z' })
  const added = addDocument(initial, 'Interlude', { id: 'd2', now: '2026-08-20T00:00:01.000Z' })
  assert.equal(initial.documents.length, 1)
  assert.equal(added.documents[1].path, 'manuscript/interlude.md')
  const renamed = renameDocument(added, 'd2', 'A New Interlude', '2026-08-20T00:00:02.000Z')
  assert.equal(renamed.documents[1].title, 'A New Interlude')
  const reordered = reorderDocument(renamed, 'd2', -1, '2026-08-20T00:00:03.000Z')
  assert.equal(reordered.documents[0].id, 'd2')
  const removed = removeDocument(reordered, 'd2', '2026-08-20T00:00:04.000Z')
  assert.equal(removed.documents.length, 1)
  assert.equal(removed.activeDocumentId, removed.documents[0].id)
})

