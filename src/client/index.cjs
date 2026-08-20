const React = require('react')
const { NarraivaProjectAdapter } = require('./project-adapter.cjs')
const { addDocument, removeDocument, renameDocument, reorderDocument } = require('./project-domain.cjs')

const PLUGIN_ID = '@narraiva/dsh'
const MODES = Object.freeze([
  { id: 'ask', label: '思考', description: '讨论、分析与澄清' },
  { id: 'write', label: '写作', description: '生成作者可审阅的 Proposal' },
])

const narraivaStyles = `
  :root { color-scheme: light; }
  .narraiva-spike { --nv-bg:#f7f4ee; --nv-panel:#f8f5f0; --nv-editor:#fffdfa; --nv-elevated:#fbfaf7; --nv-border:#e6dfd5; --nv-text:#292827; --nv-secondary:#756f68; --nv-muted:#a19a91; --nv-accent:#c77538; --nv-accent-soft:#f0e4d8; --nv-success:#5aa56f; position:fixed; inset:0; z-index:1000; min-height:100dvh; display:grid; grid-template-rows:46px minmax(0,1fr) 30px; overflow:hidden; background:var(--nv-bg); color:var(--nv-text); font-family:Inter,"Segoe UI","Microsoft YaHei",system-ui,sans-serif; }
  .narraiva-spike *,.narraiva-spike *::before,.narraiva-spike *::after { box-sizing:border-box; }
  .nv-topbar,.nv-statusbar { display:flex; align-items:center; border-color:var(--nv-border); background:var(--nv-panel); }
  .nv-topbar { gap:24px; padding:0 18px; border-bottom:1px solid var(--nv-border); }.nv-topbar::before { color:var(--nv-secondary); content:"←　文件　 编辑　 视图　 帮助"; font-size:13px; white-space:pre; }.nv-brand { color:var(--nv-text); font:700 16px/1 Inter,"Segoe UI",sans-serif; letter-spacing:.01em; }.nv-spike-label { margin-right:auto; color:var(--nv-secondary); font-size:13px; }.nv-spike-label::before { content:"— the-zero-crown　"; }.nv-workbench { min-height:0; display:grid; grid-template-columns:292px minmax(0,1fr) 350px; }.nv-sidebar,.nv-assistant { min-height:0; background:var(--nv-panel); }.nv-sidebar { display:flex; flex-direction:column; border-right:1px solid var(--nv-border); }.nv-project { display:flex; justify-content:space-between; align-items:flex-start; min-height:157px; padding:30px 20px; border-bottom:1px solid var(--nv-border); }.nv-project strong { color:var(--nv-text); font:700 31px/1 Georgia,"Times New Roman",serif; }.nv-project::after { position:absolute; margin-top:44px; color:var(--nv-secondary); content:"the-zero-crown"; font-size:13px; }.nv-icon-button,.nv-mode { border:0; color:var(--nv-secondary); background:transparent; font:inherit; cursor:pointer; }.nv-icon-button { width:28px; height:28px; border-radius:6px; font-size:20px; line-height:1; }.nv-icon-button:hover,.nv-icon-button:focus-visible { background:#f1ebe3; color:var(--nv-text); outline:none; }.nv-sidebar-label { padding:20px 18px 8px; color:#413d39; font-size:15px; font-weight:700; }
  .nv-add-chapter { width:auto; min-height:34px; margin:12px 18px 16px; padding:0 14px; border:0; border-radius:999px; color:var(--nv-accent); background:#faf1e8; font:600 13px/1 Inter,"Segoe UI",sans-serif; cursor:pointer; }.nv-add-chapter:hover { background:var(--nv-accent-soft); }.nv-chapter { position:relative; width:calc(100% - 18px); margin:4px 9px; padding:11px 14px 11px 31px; border:0; border-radius:7px; color:#6d6760; background:transparent; text-align:left; font-size:14px; cursor:pointer; }.nv-chapter::before { position:absolute; left:17px; top:50%; width:5px; height:5px; border-radius:50%; background:#c9c2ba; content:""; transform:translateY(-50%); }.nv-chapter:hover { color:var(--nv-text); background:#f5eee7; }.nv-chapter.is-active { border-left:3px solid var(--nv-accent); padding-left:28px; color:var(--nv-accent); background:var(--nv-accent-soft); }.nv-chapter.is-active::before { background:var(--nv-accent); box-shadow:0 0 0 5px rgba(199,117,56,.09); }.nv-sidebar-foot { margin-top:auto; padding:16px 18px; color:var(--nv-secondary); border-top:1px solid var(--nv-border); font-size:12px; }.nv-editor { min-width:0; overflow:auto; padding:48px 58px; background:var(--nv-editor); }.nv-editor-inner { max-width:840px; margin:0 auto; }.nv-kicker { color:var(--nv-accent); font:500 16px/1.7 "SFMono-Regular",Consolas,monospace; }.nv-editor h1 { margin:12px 0 32px; color:var(--nv-accent); font:500 25px/1.4 "SFMono-Regular",Consolas,monospace; }.nv-copy { max-width:820px; color:#252321; font:400 17px/1.9 "SFMono-Regular",Consolas,monospace; }.nv-copy p { margin:0 0 24px; }.nv-spike-note { margin-top:50px; padding-top:22px; border-top:1px solid var(--nv-border); color:var(--nv-secondary); font-size:13px; line-height:1.7; }.nv-spike-note strong { display:block; margin-bottom:4px; color:var(--nv-text); font-weight:600; }
  .nv-assistant { display:flex; flex-direction:column; border-left:1px solid var(--nv-border); padding:0; }.nv-mode-switch { display:grid; grid-template-columns:1fr 1fr; padding:0; border-bottom:1px solid var(--nv-border); border-radius:0; background:transparent; }.nv-mode { min-height:52px; border-bottom:3px solid transparent; border-radius:0; font-size:14px; }.nv-mode:hover { color:var(--nv-text); }.nv-mode.is-active { border-color:var(--nv-accent); color:var(--nv-accent); background:transparent; box-shadow:none; }.nv-connection { display:flex; align-items:center; gap:8px; margin:14px 18px; color:var(--nv-secondary); font-size:12px; }.nv-dot { width:7px; height:7px; border-radius:50%; background:var(--nv-muted); }.nv-dot.is-connected { background:var(--nv-success); box-shadow:0 0 0 3px rgba(90,165,111,.12); }.nv-dot.is-reconnecting { background:var(--nv-accent); box-shadow:0 0 0 3px rgba(199,117,56,.12); }.nv-assistant-empty { flex:1; min-height:164px; display:block; padding:22px; border:0; border-top:1px solid var(--nv-border); border-radius:0; color:#3f3a36; text-align:left; font-size:14px; line-height:1.8; }.nv-assistant-empty span { display:inline; margin:0; color:var(--nv-secondary); font-size:12px; }.nv-composer { margin:0 14px 14px; padding:12px; border:1px solid #ebe5dc; border-radius:13px; background:var(--nv-elevated); }.nv-composer textarea { width:100%; min-height:72px; resize:none; border:0; outline:0; color:var(--nv-muted); background:transparent; font:13px/1.55 inherit; }.nv-composer-foot { display:flex; align-items:center; justify-content:space-between; color:var(--nv-muted); font-size:11px; }.nv-send { width:auto; height:29px; padding:0 12px; border:0; border-radius:8px; color:white; background:#d9ad89; cursor:not-allowed; }
  .nv-statusbar { gap:24px; padding:0 18px; border-top:1px solid var(--nv-border); color:var(--nv-muted); font-size:11px; }.nv-statusbar span:last-child { margin-left:auto; }
  @media (max-width:900px) { .nv-workbench { grid-template-columns:208px minmax(0,1fr); }.nv-assistant { display:none; } } @media (max-width:620px) { .nv-workbench { grid-template-columns:1fr; }.nv-sidebar { display:none; }.nv-editor { padding:48px 25px; }.nv-statusbar { gap:12px; }.nv-statusbar span:nth-child(2) { display:none; } }
  .nv-welcome{grid-column:1/-1;display:grid;place-items:center;background:var(--nv-editor);padding:32px}.nv-welcome-card{width:min(560px,100%);padding:44px;border:1px solid var(--nv-border);border-radius:16px;background:var(--nv-elevated);box-shadow:0 18px 60px rgba(73,55,39,.08)}.nv-welcome-card h1{margin:0 0 10px;font:700 38px/1 Georgia,serif}.nv-welcome-card p{color:var(--nv-secondary);line-height:1.7}.nv-welcome-actions{display:flex;gap:10px;margin-top:28px}.nv-primary,.nv-secondary{min-height:38px;padding:0 16px;border:1px solid var(--nv-border);border-radius:9px;background:white;color:var(--nv-text);cursor:pointer}.nv-primary{border-color:var(--nv-accent);background:var(--nv-accent);color:white}.nv-error{margin-top:16px;padding:10px 12px;border-radius:8px;background:#fff0eb;color:#9d412e;font-size:12px}.nv-editor{display:flex;flex-direction:column;padding:0}.nv-editor-head{display:flex;align-items:center;justify-content:space-between;height:48px;padding:0 22px;border-bottom:1px solid var(--nv-border);color:var(--nv-secondary);font-size:12px}.nv-editor-surface{position:relative;flex:1;min-height:0;display:grid;grid-template-columns:52px minmax(0,1fr);overflow:auto;background:var(--nv-editor)}.nv-lines{padding:35px 10px;text-align:right;color:var(--nv-muted);font:13px/1.9 "SFMono-Regular",Consolas,monospace;white-space:pre;border-right:1px solid #f1ece5;user-select:none}.nv-manuscript{width:100%;min-height:100%;padding:34px 42px;border:0;outline:0;resize:none;background:transparent;color:#252321;font:16px/1.9 "SFMono-Regular",Consolas,monospace;tab-size:2}.nv-chapter-row{display:flex;align-items:center;margin:3px 8px;border-radius:7px}.nv-chapter-row.is-active{background:var(--nv-accent-soft);border-left:3px solid var(--nv-accent)}.nv-chapter-row .nv-chapter{flex:1;width:auto;margin:0}.nv-mini{border:0;background:transparent;color:var(--nv-muted);cursor:pointer;padding:5px}.nv-project::after{content:attr(data-project-name)}.nv-conflict{padding:8px 18px;background:#fff3e5;color:#914f1d;font-size:12px;border-bottom:1px solid #ebd0b6}.nv-save-error{color:#a13f32}.nv-busy{opacity:.65;pointer-events:none}
`

function h(type, props, ...children) { return React.createElement(type, props, ...children) }

function installStyles() {
  if (typeof document === 'undefined') return
  const selector = `style[data-plugin-css="${PLUGIN_ID}/spike-shell"]`
  if (document.querySelector(selector)) return
  const tag = document.createElement('style')
  tag.dataset.plugin = PLUGIN_ID
  tag.dataset.pluginCss = `${PLUGIN_ID}/spike-shell`
  tag.textContent = narraivaStyles
  document.head.appendChild(tag)
}

installStyles()

function sourceFor(connection) {
  const hostDescription = connection?.hostDescription
  if (!hostDescription || typeof hostDescription.getSnapshot !== 'function') return { getSnapshot: () => 'unavailable', subscribe: () => () => {} }
  return { getSnapshot: () => hostDescription.getSnapshot() ? 'connected' : 'reconnecting', subscribe: listener => hostDescription.subscribe(listener) }
}

function useConnectionState(source) { return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot) }
function connectionCopy(state) { return state === 'connected' ? 'DSH 本地连接已就绪' : state === 'reconnecting' ? '正在连接本地 DSH' : '本地 DSH 状态不可用' }

function rememberHandle(handle) {
  if (!globalThis.indexedDB) return Promise.resolve()
  return new Promise((resolve, reject) => { const open = indexedDB.open('narraiva-dsh', 1); open.onupgradeneeded = () => open.result.createObjectStore('workspace'); open.onerror = () => reject(open.error); open.onsuccess = () => { const tx = open.result.transaction('workspace', 'readwrite'); tx.objectStore('workspace').put(handle, 'last'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) } })
}
function recalledHandle() {
  if (!globalThis.indexedDB) return Promise.resolve(null)
  return new Promise((resolve) => { const open = indexedDB.open('narraiva-dsh', 1); open.onupgradeneeded = () => open.result.createObjectStore('workspace'); open.onerror = () => resolve(null); open.onsuccess = () => { const tx = open.result.transaction('workspace'); const request = tx.objectStore('workspace').get('last'); request.onsuccess = () => resolve(request.result || null); request.onerror = () => resolve(null) } })
}

function NarraivaTitleBar({ projectName }) {
  return h('header', { className: 'nv-topbar' },
    h('span', { className: 'nv-brand' }, 'Narraiva'),
    h('span', { className: 'nv-spike-label' }, projectName || '本地写作工作台'),
  )
}

function ProjectNavigator({ manifest, onManifest, onSelect, onError, adapter }) {
  const activeId = manifest.activeDocumentId
  async function mutate(action) { try { await action() } catch (cause) { onError(cause?.message || '项目操作失败。') } }
  async function add() { const title = prompt('章节名称', `Chapter ${manifest.documents.length + 1}`); if (!title) return; await mutate(async () => { const next = addDocument(manifest, title); const doc = next.documents.find(item => !manifest.documents.some(old => old.id === item.id)); await adapter.addDocumentAndSaveManifest(doc, `# ${doc.title}\n\n`, next); onManifest(next) }) }
  async function rename(doc) { const title = prompt('重命名章节', doc.title); if (!title) return; await mutate(async () => { const next = renameDocument(manifest, doc.id, title); await adapter.saveManifest(next); onManifest(next) }) }
  async function move(doc, delta) { await mutate(async () => { const next = reorderDocument(manifest, doc.id, delta); if (next === manifest) return; await adapter.saveManifest(next); onManifest(next) }) }
  async function remove(doc) { if (!confirm(`删除“${doc.title}”？此操作会删除本地文件。`)) return; await mutate(async () => { const next = removeDocument(manifest, doc.id); await adapter.deleteDocumentAndSaveManifest(doc.path, next); onManifest(next); if (next.activeDocumentId) onSelect(next.activeDocumentId) }) }
  return h('nav', { className: 'nv-sidebar', 'aria-label': '项目导航' },
    h('div', { className: 'nv-project', 'data-project-name': manifest.name },
      h('strong', null, 'Narraiva'),
      h('button', { className: 'nv-icon-button', type: 'button', 'aria-label': '刷新项目' }, '↻'),
    ),
    h('div', { className: 'nv-sidebar-label' }, `▤　正文　　${manifest.documents.length}　⌃`),
    h('button', { className: 'nv-add-chapter', type: 'button', 'aria-label': '新建章节', onClick: add }, '＋ 章节'),
    manifest.documents.map((doc, index) => h('div', { className: `nv-chapter-row${doc.id === activeId ? ' is-active' : ''}`, key: doc.id },
      h('button', { className: 'nv-chapter', type: 'button', onClick: () => onSelect(doc.id) }, doc.title),
      h('button', { className: 'nv-mini', title: '上移', disabled: index === 0, onClick: () => move(doc, -1) }, '↑'),
      h('button', { className: 'nv-mini', title: '下移', disabled: index === manifest.documents.length - 1, onClick: () => move(doc, 1) }, '↓'),
      h('button', { className: 'nv-mini', title: '重命名', onClick: () => rename(doc) }, '✎'),
      h('button', { className: 'nv-mini', title: '删除', onClick: () => remove(doc) }, '×'),
    )),
    h('div', { className: 'nv-sidebar-label' }, '⌘　设定与大纲　　9　⌄'),
    h('div', { className: 'nv-sidebar-label' }, '♧　故事记忆　　已就绪　●　⌃'),
    h('div', { className: 'nv-sidebar-foot' }, '•　概览　　•　人物　　•　事件　　•　关系　　•　时间线'),
  )
}

function ManuscriptEditor({ document, content, onChange, onSelection, saveState, conflict, error }) {
  const lines = Math.max(1, content.split('\n').length)
  return h('article', { className: 'nv-editor', 'aria-label': '稿件编辑器' },
    h('div', { className: 'nv-editor-head' }, h('span', null, document?.path || '未选择正文'), h('span', { className: saveState === 'error' ? 'nv-save-error' : '' }, saveState === 'dirty' ? '未保存' : saveState === 'saving' ? '正在保存…' : saveState === 'error' ? '保存失败' : '已保存')),
    conflict && h('div', { className: 'nv-conflict' }, '磁盘中的文件已被其他程序修改。Narraiva 已停止自动保存，以免覆盖外部内容。请复制当前草稿后重新打开项目。'),
    error && !conflict && h('div', { className: 'nv-conflict' }, error),
    h('div', { className: 'nv-editor-surface' },
      h('div', { className: 'nv-lines', 'aria-hidden': true }, Array.from({ length: lines }, (_, i) => i + 1).join('\n')),
      h('textarea', { className: 'nv-manuscript', value: content, disabled: !document || conflict, spellCheck: true, onChange: event => onChange(event.target.value), onSelect: event => onSelection(event.target.value.slice(event.target.selectionStart, event.target.selectionEnd)) }),
    ))
}

function AssistantPanel({ connectionState, mode, onModeChange }) {
  const selected = MODES.find(candidate => candidate.id === mode) ?? MODES[0]
  return h('aside', { className: 'nv-assistant', 'aria-label': 'Narraiva 助手' },
    h('div', { className: 'nv-mode-switch', role: 'tablist', 'aria-label': '助手视图' },
      h('button', { className: 'nv-mode is-active', type: 'button', role: 'tab', 'aria-selected': true }, '对话'),
      h('button', { className: 'nv-mode', type: 'button', role: 'tab', 'aria-selected': false }, '历史'),
    ),
    h('div', { className: 'nv-connection', 'data-testid': 'narraiva-connection-state', 'data-state': connectionState },
      h('i', { className: `nv-dot is-${connectionState}` }),
      connectionCopy(connectionState),
    ),
    h('div', { className: 'nv-assistant-empty' },
      h('div', null, h('span', null, '@选中文本　'), '只有在编辑器确实把选区传给我时才有效；聊天里显示了文字，不代表我已经取得实际选中文本。'),
      h('p', null, '“当前章节”将由编辑器提供活动文件；如果文件状态不同步，就可能出现章节编号对不上的情况。'),
      h('p', null, '我不能假装已经看到没有被工具读取到的原文。当前在只读分析模式，不能直接把修改写回正式稿件。'),
      h('p', null, h('strong', null, 'Narraiva 的目标不是单纯润色，而是有项目记忆、有原文证据、并且不会擅自改稿件的编辑工作台。')),
      h('p', null, `当前模式：${selected.description}。当前阶段先完成本地项目与编辑器，Agent 发送将在下一阶段接入。`),
    ),
    h('div', { className: 'nv-composer', 'aria-label': '助手输入框技术预览' },
      h('textarea', { disabled: true, value: '询问当前正文、大纲或故事记忆…', readOnly: true }),
      h('div', { className: 'nv-composer-foot' },
        h('span', null, '仅本地 DSH'),
        MODES.map(candidate => h('button', {
          className: `nv-mode${candidate.id === selected.id ? ' is-active' : ''}`,
          type: 'button', key: candidate.id, onClick: () => onModeChange(candidate.id),
        }, candidate.label)),
        h('button', { className: 'nv-send', type: 'button', disabled: true, 'aria-label': '发送' }, '发送'),
      ),
    ),
  )
}

function NarraivaStatusBar({ connectionState }) {
  return h('footer', { className: 'nv-statusbar' },
    h('span', null, '技术 Spike'),
    h('span', null, '默认模式：Ask'),
    h('span', null, connectionCopy(connectionState)),
  )
}

function Welcome({ onOpen, onCreate, onRestore, error, busy, canRestore }) {
  return h('section', { className: 'nv-welcome' }, h('div', { className: `nv-welcome-card${busy ? ' nv-busy' : ''}` },
    h('h1', null, 'Narraiva'), h('p', null, '选择一个本地文件夹作为写作项目。正文和项目清单只保存在你授权的目录中，不会上传到远程服务。'),
    h('div', { className: 'nv-welcome-actions' }, h('button', { className: 'nv-primary', onClick: onCreate }, '创建项目'), h('button', { className: 'nv-secondary', onClick: onOpen }, '打开项目'), canRestore && h('button', { className: 'nv-secondary', onClick: onRestore }, '恢复上次项目')),
    !globalThis.showDirectoryPicker && h('div', { className: 'nv-error' }, '当前浏览器不支持本地目录访问。请使用最新版 Chrome 或 Edge 打开 localhost。'), error && h('div', { className: 'nv-error' }, error),
  ))
}

function NarraivaRoot({ runtime }) {
  const [mode, setMode] = React.useState('ask')
  const [adapter, setAdapter] = React.useState(null)
  const [manifest, setManifest] = React.useState(null)
  const [content, setContent] = React.useState('')
  const [, setRevision] = React.useState(null)
  const [saveState, setSaveState] = React.useState('saved')
  const [conflict, setConflict] = React.useState(false)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [restoreHandle, setRestoreHandle] = React.useState(null)
  const saveTimer = React.useRef(null)
  const saveQueue = React.useRef(Promise.resolve())
  const revisionRef = React.useRef(null)
  const contentRef = React.useRef('')
  const editGeneration = React.useRef(0)
  const savedGeneration = React.useRef(0)
  const connectionState = useConnectionState(runtime.connection)

  React.useEffect(() => { recalledHandle().then(setRestoreHandle) }, [])
  async function loadProject(next) { setAdapter(next); setManifest(next.manifest); setError(''); await rememberHandle(next.root); const id = next.manifest.activeDocumentId; if (id) await selectDocument(next, next.manifest, id) }
  async function saveDraft(targetAdapter, document, value, generation) { let succeeded = true; saveQueue.current = saveQueue.current.then(async () => { setSaveState('saving'); try { const saved = await targetAdapter.saveDocument(document.path, value, revisionRef.current); revisionRef.current = saved.revision; setRevision(saved.revision); savedGeneration.current = Math.max(savedGeneration.current, generation); if (editGeneration.current === generation) setSaveState('saved'); else setSaveState('dirty') } catch (cause) { succeeded = false; if (cause?.code === 'WRITE_CONFLICT') setConflict(true); setSaveState('error'); setError(cause?.message || '保存失败。') } }); await saveQueue.current; return succeeded }
  async function selectDocument(targetAdapter, targetManifest, id) { clearTimeout(saveTimer.current); if (adapter && manifest && editGeneration.current > savedGeneration.current) { const current = manifest.documents.find(item => item.id === manifest.activeDocumentId); if (current && !await saveDraft(adapter, current, contentRef.current, editGeneration.current)) return } await saveQueue.current; const doc = targetManifest.documents.find(item => item.id === id); if (!doc) return; const loaded = await targetAdapter.readDocument(doc.path); const next = { ...targetManifest, activeDocumentId: id }; if (next.activeDocumentId !== targetAdapter.manifest.activeDocumentId) await targetAdapter.saveManifest(next); setManifest(next); contentRef.current = loaded.content; setContent(loaded.content); revisionRef.current = loaded.revision; setRevision(loaded.revision); editGeneration.current = 0; savedGeneration.current = 0; setSaveState('saved'); setConflict(false); setError('') }
  async function choose(create) { setBusy(true); setError(''); try { const handle = await showDirectoryPicker({ mode: 'readwrite' }); const next = create ? await NarraivaProjectAdapter.create(handle, prompt('项目名称', handle.name) || handle.name) : await NarraivaProjectAdapter.open(handle); await loadProject(next) } catch (cause) { if (cause?.name !== 'AbortError') setError(cause?.message || '无法打开本地项目。') } finally { setBusy(false) } }
  async function restore() { setBusy(true); setError(''); try { const permission = await restoreHandle.requestPermission?.({ mode: 'readwrite' }) || await restoreHandle.queryPermission?.({ mode: 'readwrite' }); if (permission !== 'granted') throw new Error('没有获得本地项目的读写权限。'); await loadProject(await NarraivaProjectAdapter.open(restoreHandle)) } catch (cause) { setError(cause?.message || '无法恢复本地项目。') } finally { setBusy(false) } }
  function changeContent(value) { contentRef.current = value; const generation = ++editGeneration.current; setContent(value); setSaveState('dirty'); setError(''); clearTimeout(saveTimer.current); saveTimer.current = setTimeout(async () => { const doc = manifest.documents.find(item => item.id === manifest.activeDocumentId); if (doc) await saveDraft(adapter, doc, value, generation) }, 700) }
  React.useEffect(() => () => clearTimeout(saveTimer.current), [])
  async function updateManifest(next) { setManifest(next); const current = next.documents.find(item => item.id === next.activeDocumentId); if (!current) { clearTimeout(saveTimer.current); contentRef.current = ''; setContent(''); revisionRef.current = null; setRevision(null); editGeneration.current = 0; savedGeneration.current = 0; setSaveState('saved'); return } if (current.id !== manifest.activeDocumentId) await selectDocument(adapter, next, current.id) }
  return h('main', { className: 'narraiva-spike', 'data-testid': 'narraiva-root', 'data-mode': mode },
    h(NarraivaTitleBar, { projectName: manifest?.name }),
    h('section', { className: 'nv-workbench', 'aria-label': 'Narraiva 写作工作台技术预览' },
      !manifest ? h(Welcome, { onCreate: () => choose(true), onOpen: () => choose(false), onRestore: restore, canRestore: Boolean(restoreHandle), error, busy }) : [
            h(ProjectNavigator, { key: 'nav', manifest, adapter, onManifest: updateManifest, onSelect: id => selectDocument(adapter, manifest, id), onError: setError }),
        h(ManuscriptEditor, { key: 'editor', document: manifest.documents.find(item => item.id === manifest.activeDocumentId), content, onChange: changeContent, onSelection: () => {}, saveState, conflict, error }),
        h(AssistantPanel, { key: 'assistant', connectionState, mode, onModeChange: setMode }),
      ],
    ),
    h(NarraivaStatusBar, { connectionState }),
  )
}

const inject = ['slots', 'connection']
function apply(ctx) {
  const connection = typeof ctx.get === 'function' ? ctx.get('connection') : undefined
  const runtime = Object.freeze({ connection: sourceFor(connection), modes: MODES, defaultMode: 'ask' })
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'narraiva-workbench',
    inject: () => ({ runtime }),
  }, NarraivaRoot))
}

module.exports = { apply, inject }
