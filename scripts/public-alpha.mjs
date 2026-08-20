import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

export const MINIMUM_NODE_MAJOR = 24
export function isSupportedDshVersion(value) {
  const match = /^0\.1\.(\d+)(?:-rc\.(\d+))?$/u.exec(String(value))
  if (!match) return false
  const patch = Number(match[1]); const releaseCandidate = match[2] == null ? null : Number(match[2])
  return patch > 0 || releaseCandidate == null || releaseCandidate >= 7
}

export function validateLaunchOptions({ profileName, port }) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/iu.test(String(profileName))) throw new Error('Profile 名称只能包含字母、数字、下划线和连字符。')
  const numericPort = Number(port)
  if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) throw new Error('端口必须是 1–65535 的整数。')
  return { profileName: String(profileName), port: String(numericPort) }
}

export function parseCliArguments(argv, environment = {}) {
  const values = [...argv]
  const commands = new Set(['doctor', 'install', 'start'])
  let command = 'start'
  if (values[0] && !values[0].startsWith('-')) {
    command = values.shift()
    if (!commands.has(command)) throw new Error(`未知命令：${command}`)
  }
  const allowed = command === 'doctor' ? new Set() : command === 'install' ? new Set(['--profile']) : new Set(['--profile', '--port'])
  const parsed = { command, profile: environment.DSH_PROFILE || 'narraiva', port: environment.DSH_PORT || '3081' }
  const seen = new Set()
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index]; const value = values[index + 1]
    if (!allowed.has(flag)) throw new Error(`命令 ${command} 不支持参数：${flag || '(empty)'}`)
    if (seen.has(flag)) throw new Error(`参数不能重复：${flag}`)
    if (value == null || value.startsWith('-')) throw new Error(`参数 ${flag} 缺少值`)
    seen.add(flag)
    if (flag === '--profile') parsed.profile = value
    if (flag === '--port') parsed.port = value
  }
  validateLaunchOptions({ profileName: parsed.profile, port: parsed.port })
  return parsed
}

export function diagnoseEnvironment({ nodeVersion, dshVersion, dshAvailable }) {
  const nodeMajor = Number.parseInt(String(nodeVersion).split('.')[0], 10)
  const checks = [
    { name: 'Node.js', ok: nodeMajor >= MINIMUM_NODE_MAJOR, detail: `需要 Node.js ${MINIMUM_NODE_MAJOR}+；当前 ${nodeVersion}` },
    { name: 'DeepSeek Harness', ok: Boolean(dshAvailable), detail: dshAvailable ? `检测到 ${dshVersion}` : '未安装 @deepseek-ai/dsh' },
    { name: 'DSH compatibility', ok: Boolean(dshAvailable && isSupportedDshVersion(dshVersion)), detail: '已验证 0.1.0-rc.7；声明兼容后续 0.1.x，升级时仍应重新验证' },
  ]
  return { ok: checks.every(check => check.ok), checks }
}

export function resolveDshRuntime(repositoryRoot) {
  const source = process.env.DSH_SOURCE
  if (source) {
    const bin = path.join(path.resolve(source), 'apps', 'cli', 'lib', 'bin.js')
    const manifest = path.join(path.resolve(source), 'apps', 'cli', 'package.json')
    return existsSync(bin) ? { bin, manifest, source: 'DSH_SOURCE' } : null
  }
  try {
    const manifest = createRequire(import.meta.url).resolve('@deepseek-ai/dsh/package.json')
    const bin = path.join(path.dirname(manifest), 'lib', 'bin.js')
    return existsSync(bin) ? { bin, manifest, source: 'package dependency' } : null
  } catch { return null }
}

export async function composeProfile({ dshHome = process.env.DSH_HOME ?? path.join(homedir(), '.dsh'), profileName = 'narraiva', packageName = '@narraiva/dsh' }) {
  validateLaunchOptions({ profileName, port: 3081 })
  const profileManifestPath = path.join(dshHome, 'profiles', profileName, 'package.json')
  const profileManifest = JSON.parse(await readFile(profileManifestPath, 'utf8'))
  profileManifest.dsh ??= {}; profileManifest.dsh.profile ??= {}
  const profile = profileManifest.dsh.profile
  const bundles = Array.isArray(profile.bundles) ? [...profile.bundles] : []
  const insert = (bundle, index) => { if (!bundles.includes(bundle)) bundles.splice(index, 0, bundle) }
  insert('@deepseek-ai/dsh-base', 0)
  insert('@deepseek-ai/dsh-web-app', bundles.indexOf('@deepseek-ai/dsh-base') + 1)
  if (!bundles.includes(packageName)) bundles.push(packageName)
  profile.bundles = bundles
  await writeFile(profileManifestPath, `${JSON.stringify(profileManifest, null, 2)}\n`)
  return profileManifestPath
}
