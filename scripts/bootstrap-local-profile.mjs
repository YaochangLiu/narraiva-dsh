import { cp, mkdir, access } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dshHome = process.env.DSH_HOME ?? path.join(homedir(), '.dsh')
const force = process.argv.includes('--force')
const presetIds = ['narraiva-conversation', 'narraiva-ask', 'narraiva-writer']

async function pathExists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

const presetRoot = path.join(dshHome, '.agent-presets')
await mkdir(presetRoot, { recursive: true })
const installed = []
const skipped = []

for (const presetId of presetIds) {
  const presetSource = path.join(repositoryRoot, 'presets', presetId)
  const presetTarget = path.join(presetRoot, presetId)
  if (await pathExists(presetTarget) && !force) {
    skipped.push(presetId)
    continue
  }
  await cp(presetSource, presetTarget, { recursive: true, force })
  installed.push(presetId)
}

if (installed.length > 0) console.log(`Installed Narraiva presets: ${installed.join(', ')}`)
if (skipped.length > 0) console.log(`Preserved existing local presets: ${skipped.join(', ')}`)
console.log('Next run: pnpm run start:spike')
