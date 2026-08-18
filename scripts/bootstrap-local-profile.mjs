import { cp, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dshHome = process.env.DSH_HOME ?? path.join(homedir(), '.dsh')
const presetSource = path.join(repositoryRoot, 'presets', 'narraiva-writer')
const presetTarget = path.join(dshHome, '.agent-presets', 'narraiva-writer')

await mkdir(path.dirname(presetTarget), { recursive: true })
await cp(presetSource, presetTarget, { recursive: true, force: true })

console.log(`Installed Narraiva writer preset: ${presetTarget}`)
console.log('Next run: npm run start:spike')
