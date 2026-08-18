import { cp, mkdir, access } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dshHome = process.env.DSH_HOME ?? path.join(homedir(), '.dsh')
const presetSource = path.join(repositoryRoot, 'presets', 'narraiva-writer')
const presetTarget = path.join(dshHome, '.agent-presets', 'narraiva-writer')
const force = process.argv.includes('--force')

async function pathExists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

if (await pathExists(presetTarget) && !force) {
  throw new Error(
    `Refusing to replace an existing writer preset at ${presetTarget}. `
      + 'Run "pnpm run bootstrap -- --force" only if you intend to replace it.',
  )
}

await mkdir(path.dirname(presetTarget), { recursive: true })
await cp(presetSource, presetTarget, { recursive: true, force })

console.log(`Installed Narraiva writer preset: ${presetTarget}`)
console.log('Next run: pnpm run start:spike')
