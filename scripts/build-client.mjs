import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = path.join(repositoryRoot, 'lib')

await mkdir(outputDirectory, { recursive: true })
const sourceDirectory = path.join(repositoryRoot, 'src', 'client')
const moduleNames = ['project-domain.cjs', 'project-adapter.cjs', 'ask-context.cjs', 'conversation-adapter.cjs', 'index.cjs']
const modules = await Promise.all(moduleNames.map(async name => [name, await readFile(path.join(sourceDirectory, name), 'utf8')]))
const banner = 'window.__ModuleLoader__.load({ id: "@narraiva/dsh", factory: (require) => { var module = { exports: {} }; var exports = module.exports;\n'
const moduleTable = modules.map(([name, source]) => `"./${name}": function(module, exports, require) {\n${source}\n}`).join(',\n')
const runtime = `
var __modules = {${moduleTable}};
var __cache = {};
function __require(id) {
  if (!__modules[id]) return require(id);
  if (__cache[id]) return __cache[id].exports;
  var local = __cache[id] = { exports: {} };
  __modules[id](local, local.exports, __require);
  return local.exports;
}
return __require("./index.cjs");`
const footer = '\n} });\n'
await writeFile(path.join(outputDirectory, 'client.js'), `${banner}${runtime}${footer}`)

console.log('Built Narraiva DSH Browser Client bundle.')
