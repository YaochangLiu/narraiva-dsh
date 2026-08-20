# Narraiva DSH 小说写作 Skills 能力审计

日期：2026-08-20  
范围：`narraiva-dsh`、当前 `NovelOS-alpha`、本地安装的 DeepSeek Harness `0.1.0-rc.7`。本报告只依据当前源码，不把规划中的能力算作已实现。

## 结论

Narraiva DSH 已经是一个安全、可审阅的“单章写作工作台”，但还不是 Narraiva Desktop 那种成熟的“小说 Harness”。它当前真正交给模型的是一个统一 persona、Ask/Write 两种协议、当前稿件和可选检索证据；**没有任何可由模型调用的 DSH tool，也没有安装小说 skill catalog/loader**。本地项目检索由浏览器 UI 在发送前执行，不属于 agent-loop tool。

所以当前短板不是 DeepSeek 不能写小说，而是缺少 Narraiva Desktop 已有的任务路由、小说技能说明、结构化 ContextPack、Storybase/Stylebase、质量门和评测闭环。下一阶段应先迁移“薄而高价值”的 skill orchestration，不应马上搬运完整 Storybase 数据栈或开放通用文件写工具。

## 1. Narraiva DSH 当前真正可调用的 skills / tools

### Agent plane

- `narraiva-conversation` preset 只有 `@deepseek-ai/dsh-persona`，persona 规定 Ask 只讨论、Write 只返回 `NARRAIVA_PROPOSAL_V1`；没有 skill 或 tool 组件（`presets/narraiva-conversation/agent.cordis.yml:1-17`）。旧的 ask/writer presets 同样只有 persona（`presets/narraiva-ask/agent.cordis.yml:1-14`；`presets/narraiva-writer/agent.cordis.yml:1-16`）。
- Host patch 明确禁用了 `tool-bash`、`tool-pwsh`、`tool-fs`、`tool-fs-search`、`tool-str-replace-editor`（`cordis.patch.yml:15-30`）。因此当前模型侧可调用 tool 数量是 **0**。
- Browser Client 只注入 DSH client runtime、connection、layout 和 conversation UI faces（`package.json:58-70`）；发送路径调用的是 conversation face 的 `prompt`，并提供 `cancel`、`loadOlder`（`src/client/conversation-adapter.cjs:62-64`），不存在 skill dispatch。

### 产品侧能力（不是 DSH agent tools）

- Ask：把当前章节/选区和可选证据编码为 `NARRAIVA_ASK_V1` prompt（`src/client/ask-context.cjs:33-54`）。
- Write：把完整当前文档、允许修改范围和证据编码为 `NARRAIVA_WRITE_V1`，要求结构化 Proposal（`src/client/write-context.cjs:3-12`）。
- 受控项目检索：浏览器本地建立索引、预览并由作者勾选，之后随普通 prompt 发送（`src/client/index.cjs:127-139,162-168`）。架构文档也明确它暂未使用 DSH `tool-fs-search`，因为 Browser handle 与 Host `cwd` 尚无可信绑定（`docs/architecture/phase-4-controlled-project-retrieval.md:18-20`）。
- Patch/Change Set：客户端解析 Proposal、校验原文 revision、由用户接受/拒绝/撤销（`src/client/project-adapter.cjs:86-108`；`src/client/proposal-review.cjs:7-31`）。这是作者控制层，不是模型工具。

## 2. DSH 原生 skill 机制如何挂到 preset / agent loop

本机 DSH `0.1.0-rc.7` 已依赖 `dsh-skill`、`dsh-skill-filesystem` 和 `dsh-tool-skill`（`node_modules/@deepseek-ai/dsh/package.json:56-57,79`），所以底层机制已经存在，不需要 Narraiva 自造 loader。

官方 `standard` preset 展示了正确组合方式：

1. 在 agent preset 中加入 `skill-filesystem` / `@deepseek-ai/dsh-skill-filesystem`，向该 preset scope 的 Host skill registry 贡献本地 skill-root discovery。
2. 加入 `tool-skill` / `@deepseek-ai/dsh-tool-skill`，向模型暴露 catalog 与按需 loader。
3. Registry 在 Host composition，按 scope 分层；preset 层可与部署全局注册的 repository-plugin skills 合并（`node_modules/@deepseek-ai/dsh/config/agent-presets/standard/agent.cordis.yml:76-87`）。

`dsh-tool-skill` 的实际执行链也验证了这一点：它在每次 `agent/pre-step` 按 session `cwd` 获取 skill snapshot，过滤当前 agent 可见且 `modelInvocable` 的条目，再注入精简 catalog；模型命中后调用 `skill(name)` 才加载正文（`node_modules/.pnpm/@deepseek-ai+dsh-tool-skill_f3793eb43e6a43b71de1699fa6687ab0/node_modules/@deepseek-ai/dsh-tool-skill/README.zh.md:7-29,39-52`；同包 `lib/index.js:37-43,117-145,185-234`）。它也支持用户通过 `/skill-name` 显式触发（README `152-156`；`lib/index.js:159-170,352`）。

因此建议的 Narraiva 接法是：把小说 skills 随 `@narraiva/dsh` 包发布，在 `narraiva-conversation/agent.cordis.yml` 注册 skill filesystem root 和 `tool-skill`；模型先看精简 catalog，再按任务加载完整 skill。**skill 是任务方法与约束，不等于文件权限**；继续禁用 shell/通用写工具不会妨碍 skill loader 工作。任何 skill 的写作结果仍必须落入现有 Proposal 协议。

## 3. NovelOS-alpha 已有但尚未迁移的小说能力

### A. 十个 Markdown 小说 skills

Desktop 当前 registry 要求十个 skills：章节诊断、选区诊断、选区改写、短选区改写、降低 AI 腔、继续修改当前 revision、光标续写、第二方向写作、普通回答、解释 revision（`NovelOS-alpha/packages/agent/skills.py:10-21`）。Registry 会读取 Markdown frontmatter/sections，支持 require、批量解析和缺失检查（同文件 `24-66`）。

这些 skills 不只是标签：planner 根据 intent、选区长度、AI 腔关键词、是否引用第二方向，选择具体 skill（`NovelOS-alpha/packages/agent/planner.py:232-269`）。当前 Narraiva DSH 只有 Ask/Write 两个宽泛模式，没有这层任务路由和按需方法注入。

### B. Capability / Planner / PromptPack 安全链

- Desktop 有七个产品 capability：章节/选区诊断、改写选区、光标续写、调整 active revision、普通响应、revision 解释，并映射 backend adapter 和输出 modality（`NovelOS-alpha/packages/agent/capabilities.py:21-71`）。
- Planner 将 capability、selected skills、ContextPack/PromptPack id 和审计原因写入 handoff，并固定 `may_apply_patch_directly=False`（`NovelOS-alpha/packages/agent/planner.py:69-150`）。
- PromptPack 区分 thinking 与 write system prompt，记录 selected skills、上下文统计，并按 modality 定义 diagnostic / revision proposal / explanation 的输出合同（`NovelOS-alpha/packages/agent/prompt_pack.py:34-64,69-98,140-161`）。

这些 orchestration 与可观测性尚未进入 DSH；当前 DSH 主要依赖一段 persona 和两种 prompt envelope。

### C. ContextPack、Storybase 与连续性证据

- Desktop ContextPack 注入项目 constitution、最近对话和 editor/active revision，并以显式优先级组织（`NovelOS-alpha/packages/agent/context_pack.py:140-170`）。
- 若 Storybase 存在，会选择受限、可解释的 canonical context，并附 selected/total counts 与选择理由；Style guide 也作为独立 context item（同文件 `199-245`）。
- SAG-lite 会按 task、章节、truth status、narrative scope 和 before-chapter 过滤，最多提供 6 条证据，同时记录 trace、反证、confidence 及向量 fallback（同文件 `251-305`）。
- 项目 constitution 有规范文件选择、内容 hash 与冲突 warning（`NovelOS-alpha/packages/agent/constitution.py:35-80`）。

DSH Phase 4 只有普通文本 chunk lexical retrieval；没有 canonical/candidate 区分、实体关系、时间线、反证、章节因果边界或 project constitution。

### D. Stylebase

Desktop Stylebase 是基于 Storybase evidence 的确定性 explicit profile，拥有独立 sidecar，并区分 ready/current/stale（`NovelOS-alpha/packages/stylebase/service.py:33-69`）。当前只承诺 explicit profile 与 NLP core，明确不包含 latent profile、candidate comparison、跨项目作者画像（同文件 `62-68`）；构建前要求 Storybase evidence（`71-98`）。

DSH 尚无 Stylebase profile、风格样本选择、风格规则 receipt 或 stale 生命周期。迁移时不应把它误说成成熟的“自动模仿作者”系统。

### E. 质量控制与评测

- Desktop 有规则质量门：空输出、prompt 泄露、未改写、重复、长度异常（`NovelOS-alpha/packages/quality/analyzer.py:19-40,55-94`）。
- Agent quality eval fixture 显式检查 mode、intent、output modality、capability、selected skills、rewrite strategy、是否生成 revision、是否禁止直接 apply（`NovelOS-alpha/packages/agent/quality_eval.py:20-42`）。
- DSH 当前测试重点是协议、安全、存储和 UI contract；没有小说文本质量评分、skill A/B、连续性问答集或真实长篇回归。换言之，“能安全地产生 Patch”已有证据，“能稳定写好长篇小说”尚无充分证据。

## 4. 建议下一阶段优先级

### P0：Phase 6A — Narraiva Writing Skill Kernel

先迁移方法层，不迁移 Python runtime：

1. 将十个 Desktop Markdown skills 按 DSH 原生格式整理并随 npm 包发布。
2. 在统一 preset 中挂载 `skill-filesystem` + `tool-skill`，保持 shell/fs/write tools 禁用。
3. 建立确定性 task router：Ask 细分普通问答、章节诊断、选区诊断、revision 解释；Write 细分选区改写、短改写、AI 腔降低、续写、继续修改 Proposal。
4. 所有 Write skill 强制输出现有 `NARRAIVA_PROPOSAL_V1`，不得绕过 review/apply。
5. UI 显示本轮选择的 skill、原因、输入上下文和输出合同。

这是投入最小、最能立即改善写作体验、又最不容易泄露 Narraiva 核心 Storybase 技术的一层。

### P1：Phase 6B — 小说质量评测基线

在继续堆能力前建立可比较基线：续写、局部改写、AI 腔、人物一致性、时间线、引用事实、Proposal 合法率；同一 fixture 比较“persona only”与“skill loaded”。把协议通过率与文学质量人工盲评分开。没有这层，就无法判断 skills 是否真的改善小说工作。

### P2：Phase 6C — Story Context Lite

先在现有浏览器检索之上增加轻结构化本地资料：人物、地点、事件、关系、章节摘要、项目 constitution；保留来源、状态、章节边界和 receipt。优先迁移 Desktop 的选择规则/数据合同，而不是 SQLite、云 embedding、完整 SAG pipeline。

### P3：Phase 6D — Stylebase Explicit Lite

让作者主动选择样本，生成可见、可编辑、可关闭的规则；每次发送显示使用了哪些规则和来源。先做 explicit profile，不做 latent/cross-project profile。

### P4：Workspace Bridge 与 DSH 原生只读工具

只有 Browser root 与 Host `cwd` 能 canonical proof 后，再启用 DSH `tool-fs-search` / 有界 read。写入仍由 Proposal/Change Set 完成。多文件 Proposal 在此基础上开发；Full Access 最后。

## 推荐的下一开发目标

下一阶段定义为 **Phase 6A：Writing Skill Kernel**，验收条件是：十个小说 skills 能被 DSH catalog 发现并按需加载；至少六类用户意图可稳定路由；UI 可见本轮 skill；Ask 永不生成 Patch，Write 永不直接写文件；persona-only 与 skill-loaded 的固定测试集有首个 A/B 结果。

这会把 Narraiva DSH 从“带安全 Patch 的通用 DeepSeek 写作聊天”提升为“具有 Narraiva 小说工作方法的 DSH Harness”，同时把 Storybase/Stylebase 的核心技术迁移延后到有质量证据之后。
