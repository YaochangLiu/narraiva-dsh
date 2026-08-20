#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { composeProfile, diagnoseEnvironment, parseCliArguments, resolveDshRuntime } from './public-alpha.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let options
try { options = parseCliArguments(process.argv.slice(2), process.env) } catch (cause) { console.error(cause.message); process.exit(2) }
const { command, profile, port } = options
const runtime = resolveDshRuntime(root)
let dshVersion = ''
if (runtime) { try { dshVersion = JSON.parse(readFileSync(runtime.manifest, 'utf8')).version } catch {} }
const diagnosis = diagnoseEnvironment({ nodeVersion: process.versions.node, dshVersion, dshAvailable: Boolean(runtime) })

function printDiagnosis() { for (const check of diagnosis.checks) console.log(`${check.ok ? '✓' : '✗'} ${check.name}: ${check.detail}`) }
function runDsh(dshArgs) {
  if (!runtime) throw new Error('未找到 DeepSeek Harness。请运行 npm install -g @deepseek-ai/dsh @narraiva/dsh，或设置 DSH_SOURCE。')
  const result = spawnSync(process.execPath, [runtime.bin, ...dshArgs], { cwd: root, env: { ...process.env, DSH_TELEMETRY_DISABLED: process.env.DSH_TELEMETRY_DISABLED ?? '1' }, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (command === 'doctor') { printDiagnosis(); process.exit(diagnosis.ok ? 0 : 1) }
if (!diagnosis.ok) { printDiagnosis(); process.exit(1) }
runDsh(['plugin', '--profile', profile, 'add', root])
await composeProfile({ profileName: profile })
console.log(`Narraiva profile “${profile}” 已安装。`)
if (command === 'start') runDsh(['--profile', profile, '--port', port])
