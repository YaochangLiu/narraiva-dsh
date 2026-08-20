# Narraiva DSH 路线图

## 产品目标

在 DeepSeek Harness（DSH）之上提供 Narraiva 的完整本地长篇创作工作台：用户自带 DeepSeek API Key，Narraiva 接管主 UI 与创作交互，但不连接 Narraiva Cloud。

Ask、Write 和未来的 Full Access 是三个独立模式：

- **Ask**：讨论、诊断、分析与澄清；默认模式。
- **Write**：生成可审阅的 Proposal，作者通过 Change Set 决定是否写入。
- **Full Access**：未来的高权限模式；本期仅预留概念，不实现。

## 阶段顺序

| 阶段 | 目标 | 主要退出条件 |
| --- | --- | --- |
| 0 | DSH 与 Browser Client 技术 Spike | Narraiva 能通过正式插件接口稳定挂载并接管本地 Web 根 UI；Host/Browser 边界已验证。 |
| 1 | 本地项目工作台 | 创建、打开、编辑、自动保存和重启恢复在项目根目录内可靠完成。 |
| 2 | Ask 垂直切片 | 用户在 DSH 本地配置自己的 DeepSeek Key 后，可从 Narraiva Ask 获得带显式上下文的真实回答。 |
| 3 | Write 与 Change Set | **已实现。** 模型只能提议；作者可逐项/批量审阅、接受、拒绝、撤销；冲突不会覆盖文件。 |
| 3.1 | Proposal Review UI | **已实现。** 协议不进入聊天正文；Proposal 生命周期统一；Patch 在完整稿件上下文和真实 offset 中审阅、定位。 |
| 3.2 | 统一会话模式 | **已实现。** Ask 与 Write 共享同一个 DSH Conversation；模式仅改变请求协议与审阅 UI。 |
| 4 | 受控项目检索 | **已实现。** Ask/Write 项目检索默认关闭；开启后只索引授权根目录的受支持文本，作者逐项确认，并在 Context Receipt 中审计实际发送范围。 |
| 5 | 公开 Alpha | **代码已实现。** npm 可发布包、公共 CLI、MIT 与商标文本、贡献治理、兼容性 doctor、公开文档与 CI 已完成；正式 prerelease 仍以干净 Windows + 真实 BYOK 人工证据为发布门槛。 |
| 6A | Writing Skill Kernel | **已实现。** 十个小说方法通过 DSH 原生 catalog/loader 按需加载；确定性路由与 UI/历史回执可解释；危险工具仍关闭，Write 仍只产生 Proposal。 |
| 6.1 | Skills 路由与 UI | **已实现。** 默认自动路由，作者可为下一次请求选择当前上下文允许的方法；方法、选择来源、上下文和输出边界在发送前可见并随历史持久。 |
| 6B | 小说质量评测基线 | 对 persona-only 与 skill-loaded 运行固定任务集，分别记录协议通过率与人工文学质量盲评。 |
| 后续 | Story Context Lite、Stylebase Explicit Lite、本地 Companion、Full Access | 仅在 Skills 质量基线和现有数据边界稳定后启动。 |

## 实施原则

1. **产品一致、实现边界清晰。** `NovelOS-alpha` 是 Narraiva 产品与 UI 的权威源头。当前 Public Alpha 按其布局、视觉 token、组件职责与交互哲学重新实现了独立的 DSH Browser Client；没有把 Electron、账户、云端、设备或私有引擎源码打入开源包。未来若直接复制可移植源码，必须先记录文件级来源与再许可依据。
2. **先验证接口，再扩大 UI。** 第一个工程切片是 DSH Browser Client 运行时，而不是完整视觉重制。
3. **本地优先、BYOK、最小发送。** 密钥仅由 DSH 管理；作品内容仅按用户可见的上下文清单直接发送给其配置的 DeepSeek 服务。
4. **作者控制优先于自动化。** Ask 不写入；Write 只产生 Proposal；没有明确审阅与确认就不会更改稿件。
5. **完成需有证据。** 每阶段分别记录实现提交、针对性自动化、localhost 手工验证；涉及模型时另有真实 BYOK 验证，但不记录或泄露密钥。

## 当前阶段

阶段 6.1 已完成 Skills 路由和可审计 UI 的代码与契约。下一产品阶段是 6B 小说质量评测基线；公开发布门槛仍是从 npm tarball 进行干净 Windows 安装并补齐真实 BYOK 人工流程证据。Full Access 仍不实现。
