import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relative => readFile(path.join(root, relative), 'utf8')

test('public alpha package is publishable, licensed, and exposes a CLI', async () => {
  const manifest = JSON.parse(await read('package.json'))
  assert.equal(manifest.version, '0.1.0-alpha.1')
  assert.equal(manifest.private, false)
  assert.equal(manifest.license, 'MIT')
  assert.equal(manifest.publishConfig.access, 'public')
  assert.equal(manifest.bin['narraiva-dsh'], './scripts/cli.mjs')
  assert.match(manifest.peerDependencies['@deepseek-ai/dsh'], /0\.1\.0-rc\.7/)
  assert.match(await read('LICENSE'), /MIT License/)
  assert.match(await read('TRADEMARKS.md'), /Narraiva/)
})

test('public repository includes contributor, security, and support boundaries', async () => {
  for (const file of ['CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'PRIVACY.md', 'THIRD_PARTY_NOTICES.md', '.github/PULL_REQUEST_TEMPLATE.md', '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/feature_request.yml']) assert.ok((await read(file)).trim().length > 100, `${file} should be substantive`)
  assert.match(await read('SECURITY.md'), /security advisory/i)
  assert.match(await read('PRIVACY.md'), /DeepSeek API/i)
})

test('public alpha docs describe portable install, compatibility, and architecture', async () => {
  const install = await read('docs/INSTALLATION.md')
  const architecture = await read('docs/ARCHITECTURE.md')
  const data = await read('docs/DATA-BOUNDARY.md')
  assert.match(install, /npm install -g @deepseek-ai\/dsh @narraiva\/dsh/)
  assert.doesNotMatch(install, /D:\\entertiment|_tools\/deepseek-harness/)
  assert.match(architecture, /DSH Runtime[\s\S]*Narraiva Adapter[\s\S]*Narraiva Domain[\s\S]*Narraiva UI/)
  assert.match(data, /Narraiva Cloud/)
})

test('release doctor fails closed on unsupported Node and reports compatibility', async () => {
  const { diagnoseEnvironment, parseCliArguments, validateLaunchOptions } = await import('../scripts/public-alpha.mjs')
  assert.equal(diagnoseEnvironment({ nodeVersion: '23.9.0', dshVersion: '0.1.0-rc.7', dshAvailable: true }).ok, false)
  assert.equal(diagnoseEnvironment({ nodeVersion: '24.1.0', dshVersion: '0.1.0-rc.7', dshAvailable: true }).ok, true)
  assert.equal(diagnoseEnvironment({ nodeVersion: '24.1.0', dshVersion: '0.1.0', dshAvailable: true }).ok, true)
  assert.equal(diagnoseEnvironment({ nodeVersion: '24.1.0', dshVersion: '0.1.0-rc.6', dshAvailable: true }).ok, false)
  assert.equal(diagnoseEnvironment({ nodeVersion: '24.1.0', dshVersion: '', dshAvailable: false }).ok, false)
  assert.throws(() => validateLaunchOptions({ profileName: '../../escape', port: 3081 }), /Profile/)
  assert.throws(() => validateLaunchOptions({ profileName: 'narraiva', port: 70000 }), /端口/)
  assert.deepEqual(parseCliArguments(['start', '--profile', 'book', '--port', '3090']), { command: 'start', profile: 'book', port: '3090' })
  assert.throws(() => parseCliArguments(['start', '--profile']), /缺少值/)
  assert.throws(() => parseCliArguments(['start', '--port', '3090', '--port', '3091']), /不能重复/)
  assert.throws(() => parseCliArguments(['doctor', '--dsh-version', '0.1.0-rc.7']), /不支持参数/)
  assert.throws(() => parseCliArguments(['start', '--unknown', 'x']), /不支持参数/)
})

test('CI validates tests, package contents, and public-alpha doctor', async () => {
  const workflow = await read('.github/workflows/ci.yml')
  assert.match(workflow, /pnpm test/)
  assert.match(workflow, /npm pack/)
  assert.match(workflow, /doctor/)
})
