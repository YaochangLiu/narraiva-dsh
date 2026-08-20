const React = require('react')
const { NarraivaProjectAdapter } = require('./project-adapter.cjs')
const { buildProjectIndex, searchProjectIndex, selectedRetrievalContext, retrievalQueryReady } = require('./project-retrieval.cjs')
const { addDocument, removeDocument, renameDocument, reorderDocument } = require('./project-domain.cjs')
const { buildAskPrompt, buildContextReceipt } = require('./ask-context.cjs')
const { buildWritePrompt } = require('./write-context.cjs')
const { materialize, parseProposal, recoverReview } = require('./proposal-domain.cjs')
const { PatchReviewSurface, ProposalCard } = require('./proposal-review.cjs')
const { NarraivaConversationAdapter } = require('./conversation-adapter.cjs')
const { availableWritingSkillOptions, routeWritingSkills } = require('./writing-skill-router.cjs')
const { routeReceiptView } = require('./skill-route-presentation.cjs')

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
  button:disabled{opacity:.48;cursor:not-allowed}
  .nv-assistant { display:flex; flex-direction:column; border-left:1px solid var(--nv-border); padding:0; }.nv-mode-switch { display:grid; grid-template-columns:1fr 1fr; padding:0; border-bottom:1px solid var(--nv-border); border-radius:0; background:transparent; }.nv-mode { min-height:52px; border-bottom:3px solid transparent; border-radius:0; font-size:14px; }.nv-mode:hover { color:var(--nv-text); }.nv-mode.is-active { border-color:var(--nv-accent); color:var(--nv-accent); background:transparent; box-shadow:none; }.nv-connection { display:flex; align-items:center; gap:8px; margin:14px 18px; color:var(--nv-secondary); font-size:12px; }.nv-dot { width:7px; height:7px; border-radius:50%; background:var(--nv-muted); }.nv-dot.is-connected { background:var(--nv-success); box-shadow:0 0 0 3px rgba(90,165,111,.12); }.nv-dot.is-reconnecting { background:var(--nv-accent); box-shadow:0 0 0 3px rgba(199,117,56,.12); }.nv-assistant-empty { flex:1; min-height:164px; display:block; padding:22px; border:0; border-top:1px solid var(--nv-border); border-radius:0; color:#3f3a36; text-align:left; font-size:14px; line-height:1.8; }.nv-assistant-empty span { display:inline; margin:0; color:var(--nv-secondary); font-size:12px; }.nv-composer { margin:0 14px 14px; padding:12px; border:1px solid #ebe5dc; border-radius:13px; background:var(--nv-elevated); }.nv-composer textarea { width:100%; min-height:72px; resize:none; border:0; outline:0; color:var(--nv-muted); background:transparent; font:13px/1.55 inherit; }.nv-composer-foot { display:flex; align-items:center; justify-content:space-between; color:var(--nv-muted); font-size:11px; }.nv-send { width:auto; height:29px; padding:0 12px; border:0; border-radius:8px; color:white; background:#d9ad89; cursor:not-allowed; }
  .nv-statusbar { gap:24px; padding:0 18px; border-top:1px solid var(--nv-border); color:var(--nv-muted); font-size:11px; }.nv-statusbar span:last-child { margin-left:auto; }
  @media (max-width:1100px) { .nv-workbench { grid-template-columns:220px minmax(0,1fr) 340px; } } @media (max-width:820px) { .nv-workbench { grid-template-columns:minmax(0,1fr) 340px; }.nv-sidebar { display:none; } } @media (max-width:620px) { .nv-workbench { grid-template-columns:1fr; }.nv-editor { display:none; }.nv-assistant{display:flex}.nv-statusbar { gap:12px; }.nv-statusbar span:nth-child(2) { display:none; } }
  .nv-welcome{grid-column:1/-1;display:grid;place-items:center;background:var(--nv-editor);padding:32px}.nv-welcome-card{width:min(560px,100%);padding:44px;border:1px solid var(--nv-border);border-radius:16px;background:var(--nv-elevated);box-shadow:0 18px 60px rgba(73,55,39,.08)}.nv-welcome-card h1{margin:0 0 10px;font:700 38px/1 Georgia,serif}.nv-welcome-card p{color:var(--nv-secondary);line-height:1.7}.nv-welcome-actions{display:flex;gap:10px;margin-top:28px}.nv-primary,.nv-secondary{min-height:38px;padding:0 16px;border:1px solid var(--nv-border);border-radius:9px;background:white;color:var(--nv-text);cursor:pointer}.nv-primary{border-color:var(--nv-accent);background:var(--nv-accent);color:white}.nv-error{margin-top:16px;padding:10px 12px;border-radius:8px;background:#fff0eb;color:#9d412e;font-size:12px}.nv-editor{display:flex;flex-direction:column;padding:0}.nv-editor-head{display:flex;align-items:center;justify-content:space-between;height:48px;padding:0 22px;border-bottom:1px solid var(--nv-border);color:var(--nv-secondary);font-size:12px}.nv-editor-surface{position:relative;flex:1;min-height:0;display:grid;grid-template-columns:52px minmax(0,1fr);overflow:auto;background:var(--nv-editor)}.nv-lines{padding:35px 10px;text-align:right;color:var(--nv-muted);font:13px/1.9 "SFMono-Regular",Consolas,monospace;white-space:pre;border-right:1px solid #f1ece5;user-select:none}.nv-manuscript{width:100%;min-height:100%;padding:34px 42px;border:0;outline:0;resize:none;background:transparent;color:#252321;font:16px/1.9 "SFMono-Regular",Consolas,monospace;tab-size:2}.nv-chapter-row{display:flex;align-items:center;margin:3px 8px;border-radius:7px}.nv-chapter-row.is-active{background:var(--nv-accent-soft);border-left:3px solid var(--nv-accent)}.nv-chapter-row .nv-chapter{flex:1;width:auto;margin:0}.nv-mini{border:0;background:transparent;color:var(--nv-muted);cursor:pointer;padding:5px}.nv-project::after{content:attr(data-project-name)}.nv-conflict{padding:8px 18px;background:#fff3e5;color:#914f1d;font-size:12px;border-bottom:1px solid #ebd0b6}.nv-save-error{color:#a13f32}.nv-busy{opacity:.65;pointer-events:none}
  .nv-assistant-head{display:flex;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--nv-border)}.nv-conversation-select{min-width:0;flex:1;height:34px;border:1px solid var(--nv-border);border-radius:8px;background:var(--nv-editor);padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nv-chat{flex:1;min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;padding:14px}.nv-chat>*{min-width:0;max-width:100%}.nv-chat-empty{display:grid;height:100%;place-content:center;color:var(--nv-muted);text-align:center;line-height:1.7}.nv-message{width:fit-content;max-width:92%;margin:0 0 12px;padding:10px 12px;border-radius:11px;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap;font-size:13px;line-height:1.65}.nv-message.user{margin-left:auto;background:var(--nv-accent-soft);color:#503524}.nv-message.assistant{background:var(--nv-elevated);border:1px solid var(--nv-border)}.nv-message.error{border-color:#e5b6a6;background:#fff3ef;color:#8d3d2b}.nv-message.streaming::after{content:'▋';color:var(--nv-accent);animation:nv-blink 1s infinite}.nv-context-row{display:flex;gap:6px;align-items:center;margin:0 14px 8px;color:var(--nv-muted);font-size:11px;overflow:hidden}.nv-context-chip{min-width:0;border:1px solid var(--nv-border);border-radius:999px;padding:4px 8px;background:var(--nv-editor);color:var(--nv-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nv-context-chip.off{text-decoration:line-through;opacity:.55}.nv-skill-route{margin:0 14px 8px;padding:9px 10px;border:1px solid #ead8c8;border-radius:10px;background:#fffaf4;color:var(--nv-secondary);font-size:10px;line-height:1.45;overflow:hidden}.nv-skill-route-head{display:flex;align-items:center;gap:8px;min-width:0}.nv-skill-route-title{min-width:0;flex:1;color:var(--nv-accent);font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nv-skill-select{max-width:145px;min-width:0;height:27px;border:1px solid var(--nv-border);border-radius:7px;padding:0 6px;background:var(--nv-editor);color:var(--nv-secondary);font:10px/1 inherit}.nv-skill-route details{margin-top:5px}.nv-skill-route summary{cursor:pointer;color:var(--nv-muted);user-select:none}.nv-skill-route-details{display:grid;gap:2px;margin-top:5px;padding-top:5px;border-top:1px solid #eee1d5}.nv-skill-route-details span{overflow-wrap:anywhere}.nv-retrieval{margin:0 14px 8px;padding:8px;border:1px solid var(--nv-border);border-radius:10px;background:var(--nv-elevated);font-size:11px}.nv-retrieval-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.nv-retrieval-items{display:grid;gap:5px;margin-top:7px;max-height:190px;overflow:auto}.nv-retrieval-item{display:flex;gap:6px;align-items:flex-start;color:var(--nv-secondary)}.nv-retrieval-item details{min-width:0;flex:1}.nv-retrieval-item summary{cursor:pointer;overflow-wrap:anywhere}.nv-retrieval-text{max-height:130px;margin:6px 0 0;padding:7px;overflow:auto;border-radius:6px;background:#f2eee8;white-space:pre-wrap;overflow-wrap:anywhere;font:10px/1.5 Consolas,monospace}.nv-composer textarea:disabled{opacity:.55}.nv-composer-error{margin:8px 0;color:#9d412e;font-size:11px}.nv-stop{background:#8f6047}.nv-privacy{margin-top:6px;color:var(--nv-muted);font-size:10px;line-height:1.4}@keyframes nv-blink{50%{opacity:0}}
  .nv-receipt{display:block;margin-top:6px;color:var(--nv-muted);font-size:9px}.nv-markdown p{margin:0 0 8px}.nv-markdown p:last-child{margin-bottom:0}.nv-markdown pre{overflow:auto;padding:8px;border-radius:7px;background:#f2eee8;white-space:pre-wrap;font:11px/1.5 Consolas,monospace}.nv-markdown strong{font-weight:700}
  .nv-proposal{margin:12px 0;padding:14px;border:1px solid #d9b18f;border-radius:12px;background:#fffaf4;overflow:hidden}.nv-proposal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.nv-proposal h3{margin:0 0 4px;font-size:14px}.nv-proposal p{margin:0 0 8px;color:var(--nv-secondary);font-size:11px;overflow-wrap:anywhere}.nv-proposal-badge{flex:none;border-radius:999px;padding:3px 7px;background:#f4e4d6;color:var(--nv-accent);font-size:10px}.nv-change{margin:8px 0;padding:9px;border:1px solid var(--nv-border);border-radius:8px;background:white;font:11px/1.5 Consolas,monospace;cursor:pointer}.nv-change.is-rejected{opacity:.55}.nv-change-meta{display:flex;justify-content:space-between;gap:6px;margin-bottom:5px;color:var(--nv-muted);font:10px/1.4 sans-serif}.nv-change del,.nv-change ins{display:block;max-height:90px;overflow:auto;padding:4px;white-space:pre-wrap;overflow-wrap:anywhere}.nv-change del{color:#984737;background:#fff0ed}.nv-change ins{color:#376b47;background:#edf8f0;text-decoration:none}.nv-proposal-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.nv-review{flex:1;min-height:0;overflow:auto;background:var(--nv-editor);scroll-behavior:smooth}.nv-review-doc{max-width:860px;margin:0 auto;padding:34px 42px 100px;white-space:pre-wrap;overflow-wrap:anywhere;color:#252321;font:16px/1.9 "SFMono-Regular",Consolas,monospace}.nv-review-equal{white-space:pre-wrap}.nv-inline-patch{display:block;margin:8px -12px;padding:10px 12px;border-left:3px solid var(--nv-accent);border-radius:6px;background:#fff9f2;scroll-margin:80px 0}.nv-inline-patch.is-active{box-shadow:0 0 0 2px rgba(199,117,56,.25)}.nv-inline-patch-meta{display:flex;justify-content:space-between;margin-bottom:5px;color:var(--nv-secondary);font:11px/1.4 sans-serif}.nv-inline-patch del,.nv-inline-patch ins{display:block;padding:4px 7px;white-space:pre-wrap}.nv-inline-patch del{color:#984737;background:#fff0ed}.nv-inline-patch ins{color:#376b47;background:#edf8f0;text-decoration:none}.nv-review-toolbar{position:sticky;bottom:16px;display:flex;justify-content:center;gap:8px;width:max-content;max-width:calc(100% - 32px);margin:-72px auto 16px;padding:8px;border:1px solid var(--nv-border);border-radius:12px;background:rgba(255,253,250,.94);box-shadow:0 8px 30px rgba(73,55,39,.12);backdrop-filter:blur(10px)}
`

function h(type, props, ...children) { return React.createElement(type, props, ...children) }
function renderMessage(message) { if (message.role !== 'assistant') { const route = message.requestMetadata?.skillRoute; const receipt = route && routeReceiptView(route); return [message.content, receipt && h('small', { className: 'nv-receipt', key: 'skill' }, `方法：${receipt.methodLabel} · ${receipt.sourceLabel} · ${receipt.contextLabel} · ${receipt.outputLabel} · 依据：${receipt.reason}`), message.contextSummary && h('small', { className: 'nv-receipt', key: 'receipt' }, `已发送：${message.contextSummary}`)] } const parts = String(message.content || '').split(/(```[\s\S]*?```)/g); return h('div', { className: 'nv-markdown' }, parts.filter(Boolean).map((part, index) => part.startsWith('```') ? h('pre', { key: index }, part.replace(/^```[^\n]*\n?|```$/g, '')) : h('p', { key: index }, part.replace(/\*\*/g, '')))) }

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

function ManuscriptEditor({ document, content, onChange, onSelection, saveState, conflict, error, proposal, activeChangeId, onActiveChange, onApply, onReject }) {
  const lines = Math.max(1, content.split('\n').length)
  return h('article', { className: 'nv-editor', 'aria-label': '稿件编辑器' },
    h('div', { className: 'nv-editor-head' }, h('span', null, document?.path || '未选择正文'), h('span', { className: saveState === 'error' ? 'nv-save-error' : '' }, saveState === 'dirty' ? '未保存' : saveState === 'saving' ? '正在保存…' : saveState === 'error' ? '保存失败' : '已保存')),
    conflict && h('div', { className: 'nv-conflict' }, '磁盘中的文件已被其他程序修改。Narraiva 已停止自动保存，以免覆盖外部内容。请复制当前草稿后重新打开项目。'),
    error && !conflict && h('div', { className: 'nv-conflict' }, error),
    proposal ? h(PatchReviewSurface, { proposal, activeChangeId, onActiveChange, onApply, onReject }) : h('div', { className: 'nv-editor-surface' },
      h('div', { className: 'nv-lines', 'aria-hidden': true }, Array.from({ length: lines }, (_, i) => i + 1).join('\n')),
      h('textarea', { className: 'nv-manuscript', value: content, disabled: !document || conflict, spellCheck: true, onChange: event => onChange(event.target.value), onSelect: event => onSelection({ text: event.target.value.slice(event.target.selectionStart, event.target.selectionEnd), start: event.target.selectionStart, end: event.target.selectionEnd }) }),
    ))
}

function AssistantPanel({ connectionState, mode, onModeChange, runtime, adapter, manifest, onManifest, document, content, revision, selection, proposal, onProposal, onApply, onReject, onUndo, changeSet, saveState, activeChangeId, onActiveChange }) {
  const [messages, setMessages] = React.useState([])
  const [input, setInput] = React.useState('')
  const [sessionId, setSessionId] = React.useState(manifest.conversation?.activeId || null)
  const [running, setRunning] = React.useState(false)
  const [error, setError] = React.useState('')
  const [includeCurrent, setIncludeCurrent] = React.useState(true)
  const [view, setView] = React.useState('conversation')
  const [hasMore, setHasMore] = React.useState(false)
  const [loadingOlder, setLoadingOlder] = React.useState(false)
  const lastInput = React.useRef('')
  const selectionText = selection?.text || ''
  const writeSource = React.useRef(null)
  const [retrievalEnabled, setRetrievalEnabled] = React.useState(Boolean(manifest.retrieval?.enabled))
  const [retrievalIndex, setRetrievalIndex] = React.useState(null)
  const [retrievalItems, setRetrievalItems] = React.useState([])
  const [selectedRetrievalIds, setSelectedRetrievalIds] = React.useState(new Set())
  const [retrievalBusy, setRetrievalBusy] = React.useState(false)
  const [retrievalResolvedQuery, setRetrievalResolvedQuery] = React.useState('')
  const [preferredSkill, setPreferredSkill] = React.useState('')
  const routeInput = { mode, input, selection: selectionText, activeProposal: proposal, changeSet, includeCurrent, retrievalIncluded: retrievalEnabled && selectedRetrievalIds.size > 0 }
  const skillOptions = availableWritingSkillOptions(routeInput)
  const effectivePreferredSkill = skillOptions.some(option => option.id === preferredSkill) ? preferredSkill : ''
  const skillRoute = routeWritingSkills({ ...routeInput, preferredSkill: effectivePreferredSkill })
  const skillView = routeReceiptView(skillRoute)
  React.useEffect(() => { if (preferredSkill && !effectivePreferredSkill) setPreferredSkill('') }, [preferredSkill, effectivePreferredSkill])
  React.useEffect(() => { let dispose = () => {}; let live = true; (async () => { try { const opened = await runtime.conversation.ensureModeSession(manifest, mode); if (!live) return; setSessionId(opened.sessionId); if (opened.manifest !== manifest) await onManifest(opened.manifest); dispose = runtime.conversation.subscribe(opened.sessionId, state => { setMessages(state.messages); setRunning(state.running); setHasMore(state.hasMore); setLoadingOlder(state.loadingOlder); const lastUser = [...state.messages].reverse().find(item => item.role === 'user'); if (lastUser) { lastInput.current = lastUser.content; if (lastUser.requestMetadata?.source?.content != null) writeSource.current = lastUser.requestMetadata.source } const last = state.messages[state.messages.length - 1]; if (last?.protocolContent && last.status === 'done' && writeSource.current) { try { const parsed = parseProposal(last.protocolContent, writeSource.current); if (!parsed) throw new Error('DeepSeek 返回了不完整的 Proposal，稿件未发生变化。'); setError(''); if (!manifest.review?.handledProposalIds?.includes(parsed.id) && parsed.id !== proposal?.id) onProposal(parsed) } catch (cause) { setError(cause.message) } } if (state.promptError) setError(state.promptError.message || 'DSH 请求失败。'); else if (last?.status === 'error') setError(last.content); else if (!state.running && !last?.protocolContent) setError('') }) } catch (cause) { if (live) setError(cause?.message || '无法打开 DSH 对话。') } })(); return () => { live = false; dispose() } }, [manifest.id, manifest.conversation?.activeId, mode])
  function updateRetrieval(value, index = retrievalIndex, enabled = retrievalEnabled) { if (!enabled || !index) { setRetrievalItems([]); setSelectedRetrievalIds(new Set()); if (!enabled) setRetrievalResolvedQuery(value); return } const result = searchProjectIndex(index, value, { limit: 5, maxChars: 12_000, excludePaths: document?.path ? [document.path] : [] }); setRetrievalItems(result.items); setSelectedRetrievalIds(new Set(result.items.map(item => item.id))); setRetrievalResolvedQuery(value) }
  async function refreshRetrieval(value = input) { setRetrievalBusy(true); setError(''); try { const index = buildProjectIndex(await adapter.scanProjectTextFiles()); setRetrievalIndex(index); updateRetrieval(value, index, true) } catch (cause) { setError(cause?.message || '无法建立项目检索索引。'); throw cause } finally { setRetrievalBusy(false) } }
  async function toggleRetrieval() { const enabled = !retrievalEnabled; setRetrievalEnabled(enabled); setError(''); try { const next = { ...manifest, retrieval: { enabled } }; await onManifest(next); if (!enabled) { setRetrievalIndex(null); setRetrievalItems([]); setSelectedRetrievalIds(new Set()); return } await refreshRetrieval() } catch (cause) { setRetrievalEnabled(false); try { await onManifest({ ...manifest, retrieval: { enabled: false } }) } catch {} setError(cause?.message || '无法建立项目检索索引。') } }
  React.useEffect(() => { let live = true; const enabled = Boolean(manifest.retrieval?.enabled); setRetrievalEnabled(enabled); setRetrievalIndex(null); setRetrievalItems([]); setSelectedRetrievalIds(new Set()); setRetrievalResolvedQuery(enabled ? '' : input); if (enabled) { setRetrievalBusy(true); adapter.scanProjectTextFiles().then(files => { if (!live) return; const index = buildProjectIndex(files); setRetrievalIndex(index); updateRetrieval(input, index, true) }).catch(cause => { if (live) setError(cause?.message || '无法建立项目检索索引。') }).finally(() => { if (live) setRetrievalBusy(false) }) } return () => { live = false } }, [manifest.id])
  React.useEffect(() => { const timer = setTimeout(() => updateRetrieval(input), 180); return () => clearTimeout(timer) }, [input, retrievalIndex, retrievalEnabled, document?.path])
  async function send(value = input) { if (!sessionId || running) return; setError(''); try { if (!retrievalQueryReady(value, retrievalResolvedQuery, retrievalEnabled, retrievalBusy)) throw new Error('项目证据仍在匹配最新问题，请等待清单刷新并确认后再发送。'); let prompt; const retrieval = retrievalEnabled ? selectedRetrievalContext(retrievalItems, selectedRetrievalIds) : selectedRetrievalContext([], new Set()); const route = routeWritingSkills({ mode, input: value, selection: selectionText, activeProposal: proposal, changeSet, includeCurrent, retrievalIncluded: retrieval.items.length > 0, preferredSkill: effectivePreferredSkill }); await adapter.validateRetrievalItems(retrieval.items); if (mode === 'write') { if (saveState !== 'saved') throw new Error('请等待当前稿件保存完成后再生成 Proposal。'); const selected = route.contextScope === 'selection'; const cursorOffset = Number.isInteger(selection?.start) ? selection.start : content.length; const sourceStart = proposal?.source?.startOffset ?? (selected ? selection.start : cursorOffset); const sourceEnd = proposal?.source?.endOffset ?? (selected ? selection.end : cursorOffset); writeSource.current = { path: document.path, content, diskRevision: revision, startOffset: sourceStart, endOffset: sourceEnd }; prompt = buildWritePrompt({ input: value, document, content, revision, selection: selected ? selectionText : '', selectionStart: selected ? selection?.start : undefined, cursorOffset, activeProposal: proposal, retrieval, skillRoute: route }) } else { const receipt = buildContextReceipt({ document, content, revision, selection: selectionText, input: value, includeCurrent }); prompt = buildAskPrompt({ input: value, receipt, content, revision, selection: selectionText, retrieval, skillRoute: route, reviewRecord: proposal || changeSet }) } lastInput.current = value; await runtime.conversation.send(sessionId, prompt); setInput(''); setPreferredSkill(''); setRetrievalItems([]); setSelectedRetrievalIds(new Set()) } catch (cause) { setError(cause?.message || '发送失败。') } }
  async function createConversation() { try { const opened = await runtime.conversation.createModeSession(manifest, mode); await onManifest(opened.manifest); setSessionId(opened.sessionId) } catch (cause) { setError(cause?.message || '无法新建对话。') } }
  async function switchConversation(id) { try { const next = runtime.conversation.openProjectSession(manifest, id); await onManifest(next); setSessionId(id) } catch (cause) { setError(cause?.message || '无法切换对话。') } }
  async function stop() { try { await runtime.conversation.cancel(sessionId) } catch (cause) { setError(cause?.message || '停止失败。') } }
  async function loadOlder() { try { await runtime.conversation.loadOlder(sessionId) } catch (cause) { setError(cause?.message || '无法加载更早消息。') } }
  const conversations = runtime.conversation.listProjectSessions(manifest)
  const visibleMessages = messages.filter(message => message.kind !== 'proposal-protocol')
  return h('aside', { className: 'nv-assistant', 'aria-label': 'Narraiva 助手' },
    h('div', { className: 'nv-mode-switch', role: 'tablist', 'aria-label': '助手视图' },
      h('button', { className: `nv-mode${view === 'conversation' ? ' is-active' : ''}`, type: 'button', role: 'tab', 'aria-selected': view === 'conversation', onClick: () => setView('conversation') }, '对话'),
      h('button', { className: `nv-mode${view === 'history' ? ' is-active' : ''}`, type: 'button', role: 'tab', 'aria-selected': view === 'history', onClick: () => setView('history') }, '历史'),
    ),
    h('div', { className: 'nv-assistant-head' }, h('select', { className: 'nv-conversation-select', value: sessionId || '', onChange: event => switchConversation(event.target.value), 'aria-label': '当前对话' }, conversations.map((item, index) => h('option', { value: item.id, key: item.id }, item.title || `Conversation ${index + 1}`))), h('button', { className: 'nv-secondary', onClick: createConversation }, '新建')),
    h('div', { className: 'nv-connection', 'data-testid': 'narraiva-connection-state', 'data-state': connectionState },
      h('i', { className: `nv-dot is-${connectionState}` }),
      `${connectionCopy(connectionState)} · ${mode === 'ask' ? 'Ask 只读' : 'Write 仅提案'}`,
    ),
    h('div', { className: 'nv-chat', 'aria-live': 'polite' },
      view === 'history' && hasMore && h('button', { className: 'nv-secondary', disabled: loadingOlder, onClick: loadOlder }, loadingOlder ? '正在加载…' : '加载更早消息'),
      visibleMessages.length === 0 && !proposal && !changeSet ? h('div', { className: 'nv-chat-empty' }, view === 'history' ? '当前项目还没有历史消息。' : '询问当前正文，或先在编辑器中选择文本后使用 @选中文本。') : visibleMessages.map(message => h('div', { key: message.id, className: `nv-message ${message.role} ${message.status}` }, message.content ? renderMessage(message) : (message.status === 'streaming' ? '正在思考…' : ''))),
      error && h('div', { className: 'nv-composer-error' }, error, lastInput.current && h('button', { className: 'nv-mini', onClick: () => send(lastInput.current) }, '重试')),
      mode === 'write' && (proposal || changeSet) && h(ProposalCard, { proposal, changeSet, onProposal, onApply, onReject, onUndo, activeChangeId, onActiveChange }),
    ),
    h('div', { className: 'nv-context-row' }, h('button', { className: `nv-context-chip${includeCurrent ? '' : ' off'}`, onClick: () => setIncludeCurrent(value => !value), title: '点击移除或恢复默认上下文' }, `${includeCurrent ? '✓' : '＋'} 当前章节 · ${document?.title || '未选择'}`), selectionText && h('span', { className: 'nv-context-chip' }, `选区 ${selectionText.length} 字`), h('button', { className: `nv-context-chip${retrievalEnabled ? '' : ' off'}`, disabled: retrievalBusy, onClick: toggleRetrieval }, retrievalBusy ? '正在索引…' : `${retrievalEnabled ? '✓' : '＋'} 项目检索`)),
    h('div', { className: 'nv-skill-route', 'aria-label': '本次写作方法', 'data-selection-source': skillRoute.selectionSource },
      h('div', { className: 'nv-skill-route-head' },
        h('span', { className: 'nv-skill-route-title' }, `方法 · ${skillView.methodLabel} · ${skillView.sourceLabel}`),
        h('select', { className: 'nv-skill-select', 'aria-label': '本次写作方法', disabled: running, value: effectivePreferredSkill, onChange: event => setPreferredSkill(event.target.value) },
          h('option', { value: '' }, '自动选择'),
          skillOptions.map(option => h('option', { key: option.id, value: option.id }, option.label)),
        ),
      ),
      h('details', null,
        h('summary', null, '查看方法依据'),
        h('div', { className: 'nv-skill-route-details' },
          h('span', null, skillView.reason),
          h('span', null, `上下文：${skillView.contextLabel}`),
          h('span', null, `输出：${skillView.outputLabel}`),
          h('span', null, skillView.selectionAuthorized ? '已授权发送选中文本。' : '未授权发送选中文本。'),
        ),
      ),
    ),
    retrievalEnabled && h('div', { className: 'nv-retrieval', 'aria-label': '项目检索发送清单' },
      h('div', { className: 'nv-retrieval-head' }, h('strong', null, '将随请求发送的项目证据'), h('span', null, retrievalItems.length ? `${selectedRetrievalIds.size}/${retrievalItems.length} 项` : '输入问题后匹配'), h('button', { className: 'nv-mini', disabled: retrievalBusy, onClick: () => refreshRetrieval().catch(() => {}) }, '重新索引')),
      retrievalItems.length > 0 && h('div', { className: 'nv-retrieval-items' }, retrievalItems.map(item => h('label', { className: 'nv-retrieval-item', key: item.id },
        h('input', { type: 'checkbox', checked: selectedRetrievalIds.has(item.id), onChange: () => setSelectedRetrievalIds(current => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next }) }),
        h('details', null, h('summary', null, `${item.path}:${item.startLine}-${item.endLine} · ${item.heading} · ${item.text.length} 字`), h('pre', { className: 'nv-retrieval-text' }, item.text)),
      ))),
    ),
    h('div', { className: 'nv-composer', 'aria-label': `${mode === 'ask' ? 'Ask' : 'Write'} 输入框` },
      h('textarea', { disabled: running, value: input, placeholder: mode === 'write' ? '描述希望如何重写，或使用 @选中文本…' : '询问当前正文，或输入 @选中文本…', onChange: event => setInput(event.target.value), onKeyDown: event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } } }),
      h('div', { className: 'nv-composer-foot' },
        h('span', null, 'DeepSeek BYOK'),
        MODES.map(candidate => h('button', {
          className: `nv-mode${candidate.id === mode ? ' is-active' : ''}`,
          type: 'button', key: candidate.id, onClick: () => { setPreferredSkill(''); onModeChange(candidate.id) },
        }, candidate.label)),
        running ? h('button', { className: 'nv-send nv-stop', type: 'button', onClick: stop, 'aria-label': '停止生成' }, '停止') : h('button', { className: 'nv-send', type: 'button', disabled: !input.trim() || !retrievalQueryReady(input, retrievalResolvedQuery, retrievalEnabled, retrievalBusy) || (mode === 'write' && saveState !== 'saved'), onClick: () => send(), 'aria-label': '发送' }, '发送'),
      ),
      h('div', { className: 'nv-privacy' }, '本次内容直接通过本地 DSH 发送给你配置的 DeepSeek 服务，不会发送给 Narraiva。'),
    ),
  )
}

function NarraivaStatusBar({ connectionState }) {
  return h('footer', { className: 'nv-statusbar' },
    h('span', null, 'Phase 6.1 · Skill Routing & UI'),
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
  const [revision, setRevision] = React.useState(null)
  const [selection, setSelection] = React.useState(null)
  const [saveState, setSaveState] = React.useState('saved')
  const [conflict, setConflict] = React.useState(false)
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [restoreHandle, setRestoreHandle] = React.useState(null)
  const [proposal, setProposal] = React.useState(null)
  const [changeSet, setChangeSet] = React.useState(null)
  const [activeChangeId, setActiveChangeId] = React.useState(null)
  const saveTimer = React.useRef(null)
  const saveQueue = React.useRef(Promise.resolve())
  const revisionRef = React.useRef(null)
  const contentRef = React.useRef('')
  const editGeneration = React.useRef(0)
  const savedGeneration = React.useRef(0)
  const connectionState = useConnectionState(runtime.connection)

  React.useEffect(() => { recalledHandle().then(setRestoreHandle) }, [])
  async function loadProject(next) { const review = recoverReview(next.manifest.review); setProposal(review.proposal); setChangeSet(review.changeSet); setAdapter(next); setManifest(next.manifest); setError(''); await rememberHandle(next.root); const id = next.manifest.activeDocumentId; if (id) await selectDocument(next, next.manifest, id) }
  async function saveDraft(targetAdapter, document, value, generation) { let succeeded = true; saveQueue.current = saveQueue.current.then(async () => { setSaveState('saving'); try { const saved = await targetAdapter.saveDocument(document.path, value, revisionRef.current); revisionRef.current = saved.revision; setRevision(saved.revision); savedGeneration.current = Math.max(savedGeneration.current, generation); if (editGeneration.current === generation) setSaveState('saved'); else setSaveState('dirty') } catch (cause) { succeeded = false; if (cause?.code === 'WRITE_CONFLICT') setConflict(true); setSaveState('error'); setError(cause?.message || '保存失败。') } }); await saveQueue.current; return succeeded }
  async function selectDocument(targetAdapter, targetManifest, id) { clearTimeout(saveTimer.current); if (adapter && manifest && editGeneration.current > savedGeneration.current) { const current = manifest.documents.find(item => item.id === manifest.activeDocumentId); if (current && !await saveDraft(adapter, current, contentRef.current, editGeneration.current)) return } await saveQueue.current; const doc = targetManifest.documents.find(item => item.id === id); if (!doc) return; const loaded = await targetAdapter.readDocument(doc.path); const next = { ...targetManifest, activeDocumentId: id }; if (next.activeDocumentId !== targetAdapter.manifest.activeDocumentId) await targetAdapter.saveManifest(next); if (proposal?.source?.path !== doc.path) setProposal(null); if (changeSet?.path !== doc.path) setChangeSet(null); setManifest(next); contentRef.current = loaded.content; setContent(loaded.content); setSelection(null); revisionRef.current = loaded.revision; setRevision(loaded.revision); editGeneration.current = 0; savedGeneration.current = 0; setSaveState('saved'); setConflict(false); setError('') }
  async function choose(create) { setBusy(true); setError(''); try { const handle = await showDirectoryPicker({ mode: 'readwrite' }); const next = create ? await NarraivaProjectAdapter.create(handle, prompt('项目名称', handle.name) || handle.name) : await NarraivaProjectAdapter.open(handle); await loadProject(next) } catch (cause) { if (cause?.name !== 'AbortError') setError(cause?.message || '无法打开本地项目。') } finally { setBusy(false) } }
  async function restore() { setBusy(true); setError(''); try { const permission = await restoreHandle.requestPermission?.({ mode: 'readwrite' }) || await restoreHandle.queryPermission?.({ mode: 'readwrite' }); if (permission !== 'granted') throw new Error('没有获得本地项目的读写权限。'); await loadProject(await NarraivaProjectAdapter.open(restoreHandle)) } catch (cause) { setError(cause?.message || '无法恢复本地项目。') } finally { setBusy(false) } }
  function changeContent(value) { contentRef.current = value; const generation = ++editGeneration.current; setContent(value); setSaveState('dirty'); setError(''); clearTimeout(saveTimer.current); saveTimer.current = setTimeout(async () => { const doc = manifest.documents.find(item => item.id === manifest.activeDocumentId); if (doc) await saveDraft(adapter, doc, value, generation) }, 700) }
  React.useEffect(() => () => clearTimeout(saveTimer.current), [])
  async function updateManifest(next) { setManifest(next); const current = next.documents.find(item => item.id === next.activeDocumentId); if (!current) { clearTimeout(saveTimer.current); contentRef.current = ''; setContent(''); revisionRef.current = null; setRevision(null); editGeneration.current = 0; savedGeneration.current = 0; setSaveState('saved'); return } if (current.id !== manifest.activeDocumentId) await selectDocument(adapter, next, current.id) }
  async function persistConversationManifest(next) { await adapter.saveManifest(next); setManifest(next) }
  async function persistReview(nextProposal, nextChangeSet) { const handledProposalIds = [...new Set([...(manifest.review?.handledProposalIds || []), ...(proposal && !nextProposal ? [proposal.id] : [])])]; const next = { ...manifest, review: { proposal: nextProposal, changeSet: nextChangeSet, handledProposalIds } }; await adapter.saveManifest(next); setManifest(next); setProposal(nextProposal); setChangeSet(nextChangeSet) }
  async function updateProposal(nextProposal) { setActiveChangeId(nextProposal?.changes.find(change => change.status !== 'rejected')?.id || null); await persistReview(nextProposal, changeSet) }
  async function applyProposal() { const attempted = proposal; try { const active = manifest.documents.find(item => item.id === manifest.activeDocumentId); if (!active || active.path !== attempted?.source?.path) throw new Error('Proposal 不属于当前章节，已停止应用。'); clearTimeout(saveTimer.current); if (editGeneration.current > savedGeneration.current && !await saveDraft(adapter, active, contentRef.current, editGeneration.current)) return; await saveQueue.current; const nextContent = materialize(attempted.source.content, attempted.changes); const result = await adapter.applyChangeSetAndSaveManifest(attempted, nextContent, manifest, manifest.review?.handledProposalIds); contentRef.current = nextContent; setContent(nextContent); revisionRef.current = result.changeSet.appliedRevision; setRevision(result.changeSet.appliedRevision); editGeneration.current = 0; savedGeneration.current = 0; setSaveState('saved'); setManifest(result.manifest); setProposal(null); setChangeSet(result.changeSet) } catch (cause) { setError(cause?.message || '无法应用 Change Set。'); if (cause?.code === 'WRITE_CONFLICT') { setConflict(true); if (attempted) { const conflicted = { id: `conflicted-${attempted.id}`, proposalId: attempted.id, path: attempted.source.path, proposal: { ...attempted, status: 'conflicted' }, status: 'conflicted', conflictedAt: Date.now() }; try { await persistReview(null, conflicted) } catch { setProposal(null); setChangeSet(conflicted) } } } } }
  async function rejectProposal() { const rejected = proposal ? { id: `rejected-${proposal.id}`, proposalId: proposal.id, path: proposal.source.path, proposal: { ...proposal, status: 'rejected' }, status: 'rejected', rejectedAt: Date.now() } : changeSet; await persistReview(null, rejected) }
  async function undoChangeSet() { const attempted = changeSet; try { const active = manifest.documents.find(item => item.id === manifest.activeDocumentId); if (!active || active.path !== attempted?.path) throw new Error('Change Set 不属于当前章节，已停止撤销。'); clearTimeout(saveTimer.current); await saveQueue.current; const result = await adapter.undoChangeSetAndSaveManifest(attempted, manifest, manifest.review?.handledProposalIds); contentRef.current = attempted.beforeContent; setContent(attempted.beforeContent); revisionRef.current = result.changeSet.rolledBackRevision; setRevision(result.changeSet.rolledBackRevision); editGeneration.current = 0; savedGeneration.current = 0; setSaveState('saved'); setManifest(result.manifest); setChangeSet(result.changeSet) } catch (cause) { setError(cause?.message || '无法撤销 Change Set。'); if (cause?.code === 'WRITE_CONFLICT') { setConflict(true); if (attempted) { const conflicted = { ...attempted, status: 'conflicted', conflictOperation: 'undo', conflictedAt: Date.now() }; try { await persistReview(null, conflicted) } catch { setChangeSet(conflicted) } } } } }
  return h('main', { className: 'narraiva-spike', 'data-testid': 'narraiva-root', 'data-mode': mode },
    h(NarraivaTitleBar, { projectName: manifest?.name }),
    h('section', { className: 'nv-workbench', 'aria-label': 'Narraiva 写作工作台技术预览' },
      !manifest ? h(Welcome, { onCreate: () => choose(true), onOpen: () => choose(false), onRestore: restore, canRestore: Boolean(restoreHandle), error, busy }) : [
            h(ProjectNavigator, { key: 'nav', manifest, adapter, onManifest: updateManifest, onSelect: id => selectDocument(adapter, manifest, id), onError: setError }),
        h(ManuscriptEditor, { key: 'editor', document: manifest.documents.find(item => item.id === manifest.activeDocumentId), content, onChange: changeContent, onSelection: setSelection, saveState, conflict, error, proposal: mode === 'write' ? proposal : null, activeChangeId, onActiveChange: setActiveChangeId, onApply: applyProposal, onReject: rejectProposal }),
        h(AssistantPanel, { key: 'assistant', connectionState, mode, onModeChange: setMode, runtime, adapter, manifest, onManifest: persistConversationManifest, document: manifest.documents.find(item => item.id === manifest.activeDocumentId), content, revision, selection, proposal, onProposal: updateProposal, onApply: applyProposal, onReject: rejectProposal, changeSet, onUndo: undoChangeSet, saveState, activeChangeId, onActiveChange: setActiveChangeId }),
      ],
    ),
    h(NarraivaStatusBar, { connectionState }),
  )
}

const inject = ['slots', 'connection', 'sessions']
function apply(ctx) {
  const connection = typeof ctx.get === 'function' ? ctx.get('connection') : undefined
  const sessions = typeof ctx.get === 'function' ? ctx.get('sessions') : undefined
  const runtime = Object.freeze({ connection: sourceFor(connection), conversation: new NarraivaConversationAdapter({ sessions, api: connection?.api }), modes: MODES, defaultMode: 'ask' })
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'narraiva-workbench',
    inject: () => ({ runtime }),
  }, NarraivaRoot))
}

module.exports = { apply, inject }
