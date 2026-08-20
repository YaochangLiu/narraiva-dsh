# 阶段 0：DSH 与 Browser Client 技术 Spike

**状态：** 已完成（2026-08-20）
**目的：** 用最小可验证实现证明 Narraiva 可以作为正式 DSH bundle 在本地 Web 中接管主工作台，并保留安全、会话和未来本地项目能力所需的 Host/Browser 边界。

## 为什么先做这一项

现有仓库已经证明了 Host 侧的 Narraiva policy 和 Ask/Write preset 可以加入 DSH profile；但它仍使用 DSH 原有聊天界面，尚未有 Narraiva 浏览器入口。产品承诺“由 Narraiva 接管主 UI”能否成立，取决于 DSH 的 `dsh.client`、`./client` 导出、客户端插件装载和 `root` slot 是否能在实际 profile 中稳定协作。

先验证这个契约，再以同一组件边界迁入桌面端 UI，避免把 Electron 或云端耦合误带进浏览器。迁移的不是一个“相似皮肤”，而是现有产品的工作台结构、样式和可移植交互；具体替换点见 [客户端复用映射](../architecture/desktop-ui-reuse-map.md)。

## 已有基础

- `@narraiva/dsh` 已作为 DSH bundle，含 Host 入口和 Cordis patch。
- 已有 `Narraiva Ask` 与 `Narraiva Write` preset，且 Write 没有 shell、通用文件系统或直接稿件写入工具。
- 已有 profile bootstrap、组合验证、启动脚本和 Node test 合约。

这些是起点，不代表 Browser Client 或完整阶段 0 已验收。

## 本子阶段的范围

### 要交付的能力

1. **双端插件声明**
   - 包清单声明 DSH Web client，并提供独立的 Browser Client 导出。
   - 保持 Host 入口与 Browser Client 入口分离；浏览器端不得读取本地密钥、项目文件或 Node API。

2. **Narraiva 主工作台 shell**
   - 通过 DSH 正式 `shell.overlay` slot 注册 Narraiva 的最小 React 主壳；上游 `ui-layout` 仍提供不可见的装载与 `layout` 服务，避免其基础插件发生未满足依赖。
   - 主壳迁入桌面端同名工作台结构：左侧项目导航、中央稿件编辑器、右侧助手与状态栏；本阶段使用明确的只读/静态 adapter，保留 Ask/Write 模式状态与“技术 Spike”提示。
   - Narraiva 以全屏可见工作台接管产品 UI；上游的 layout/service 仅作为 DSH 运行时依赖，不维护 DSH 源码 fork。

3. **最小 Host/Browser 交互契约**
   - Browser Client 能取得不含敏感数据的运行时状态：插件已加载、当前 session 的 preset/mode 可用性、DSH 连接失败状态。
   - 先定义一个极小、可替换的 `NarraivaRuntime` 边界；不在本阶段实现项目文件读写或真实模型调用。

4. **模式默认值一致性**
   - 新建会话的产品默认值改为 **Narraiva Ask**，与已确认的产品决策一致。
   - Write 保持可显式选择，但不授予写入权限。

5. **可重复本地开发**
   - 在项目 README 中记录所需 Node/DSH 版本、bootstrap、验证和启动步骤。
   - 从空的专用 DSH profile 完成一次 bootstrap 与启动，不依赖手工改 Harness 源码。

### 明确不做

- 不迁入任何 Electron、账户、云端、设备或本地文件桥接；章节树与编辑器只展示经过 adapter 的无副作用演示状态，尚不创建、读取、保存或格式化真实项目文件。
- 不读取任何项目文件、不做检索、不发送自定义上下文。
- 不做真实 DeepSeek 对话、Key 引导、模型选择或流式消息 UI；它们属于阶段 2。
- 不做 Proposal/Diff、Change Set、Storybase、Stylebase、Full Access、第三方 MCP 或发布安装器。
- 不改 DeepSeek Harness 上游源码；发现缺口时记录兼容性结论或最小 upstream issue/patch 建议。

## 实施拆分

### 0A：锁定 DSH 契约与骨架

1. 固定本 Spike 验证过的 DSH 版本/提交，并在文档记录它。
2. 参照上游 client package 的结构新增 Browser Client 入口、类型/构建配置与 `dsh.client` 声明。
3. 为 Host 和 Browser 各写一个最小启动断言：Host policy 可装载，Browser entry 可被 Web bundle 发现。

**完成信号：** DSH 的配置/构建验证能够识别 Narraiva 的双端插件；不产生重复或未解析的 client 入口。

### 0B：接管主工作台 UI

1. 在 Browser Client 注册唯一的 Narraiva `shell.overlay` 主工作台；保留上游 `root` 及其 `layout` 服务作为不可见的运行时底座。
2. 渲染无业务数据依赖的三栏 shell，并使用明确的 `data-testid` 或等价可访问性标记供测试定位。
3. 核对官方 overlay/layout 的组合顺序；仅使用 profile/bundle patch 完成组合。

**完成信号：** 本地 Web 只出现 Narraiva 技术 Spike 主壳，没有 slot 冲突、空白页或官方/品牌壳叠加。

### 0C：加入最小状态边界

1. 以显式接口为 Browser Client 提供模式列表、默认模式和连接状态；不得传递 API Key 或完整 DSH 配置。
2. 显示“离线/连接失败/尚未连接”状态，但不在浏览器内实现凭据管理。
3. 本阶段只验证默认 Ask 和无敏感连接状态。页面的 Write 控件是交互预览，尚不更改 DSH session preset；真实 session-preset 与页面模式绑定属于 Phase 2 的 conversation adapter。

**完成信号：** 可在无需项目目录与无需 API Key 的环境下演示状态更新与安全回退。

### 0D：验证与记录

1. 补充 Node 合约测试，检查 package 的双端声明、overlay 注册、默认 Ask、工具限制和不含敏感 bridge 字段。
2. 补充/运行最小 localhost 集成检查，证明 Narraiva 主工作台实际可渲染。
3. 在独立 profile 做 localhost 人工检查；记录 URL、DSH 版本、浏览器表现和截图/短视频位置，但不记录密钥。

**完成信号：** 自动化与人工证据分开保存，能从干净 profile 重现。

## 验收清单

- [x] `pnpm test` 覆盖 Host 与 Browser Client 的关键公开契约并通过。
- [x] DSH 的配置检查/客户端发现确认 `dsh.client`、`./client` 与 `./package.json` 导出一致。
- [x] bootstrap 后，本地 Web 能由 Narraiva 作为唯一可见的主工作台打开。
- [x] 页面存在三栏技术 shell、Ask/Write 可见状态和连接状态；不需要 API Key 即可打开。
- [x] 新会话默认 Ask；Write 只能显式选择，且仍无直接文件/终端工具。
- [x] Browser bundle 与代码库中不存在 Key、云 API 地址或对 Narraiva Cloud 的调用。
- [x] 从隔离的专用 DSH profile 重新执行 bootstrap/启动可以重现以上结果。

具体命令、DSH 提交和 Chrome 验证记录在[阶段 0 验证证据](../evidence/phase-0-browser-client-spike-2026-08-20.md)。

## 风险与处理

| 风险 | 处理方式 |
| --- | --- |
| DSH `root` slot 不允许与官方 Web roster 并存 | 优先通过官方 bundle 组合/禁用选项处理；无法处理时停在 Spike，形成最小 upstream 兼容性结论。 |
| DSH 浏览器插件构建只扫描上游 monorepo packages | 用本地 bundle 的正式发现机制验证；若外部包不支持，不复制上游源码，研究 npm/tarball/链接包的支持路径。 |
| Host/Browser RPC 需要比预期更多框架设施 | 先用静态 shell 验证装载，再选一个无敏感、只读状态进行端到端实验，避免过早设计完整 RPC。 |
| 现有 Desktop 组件依赖 Electron 或云端 | 使用 [复用映射](../architecture/desktop-ui-reuse-map.md) 逐项以 DSH adapter 替换边界；不把 Electron 或云端依赖复制到公共插件。 |

## 阶段退出条件

阶段 0 只有在所有验收清单完成、相关 DSH 版本已记录、并且 Host/Browser 扩展边界已获得自动化与 localhost 双重证据时才能结束。完成后才进入阶段 1 的本地项目工作台；不要在此之前开始完整 UI 搬运。
