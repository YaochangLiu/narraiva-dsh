import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = path.join(repositoryRoot, 'lib')

await mkdir(outputDirectory, { recursive: true })
const source = await readFile(path.join(repositoryRoot, 'src', 'client', 'index.cjs'), 'utf8')
const banner = 'window.__ModuleLoader__.load({ id: "@narraiva/dsh", factory: (require) => { var module = { exports: {} }; var exports = module.exports;\n'
const footer = '\nreturn module.exports; } });\n'
await writeFile(path.join(outputDirectory, 'client.js'), `${banner}${source}${footer}`)

console.log('Built Narraiva DSH Browser Client bundle.')
