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
| 3 | Write 与 Change Set | 模型只能提议；作者可逐项/批量审阅、接受、拒绝、撤销；冲突不会覆盖文件。 |
| 4 | 受控项目检索 | Write 的项目检索默认关闭，开启后只在项目根目录内检索，并向作者展示最终发送范围。 |
| 5 | 公开 Alpha | npm/单命令启动、MIT 与商标文本、Windows 端到端证据和公开文档完整。 |
| 后续 | Storybase Lite、本地 Companion、Full Access | 仅在前面数据边界、审阅与恢复机制已稳定后启动。 |

## 实施原则

1. **行为迁移，不是整包复制。** `NovelOS-alpha` 是 Narraiva 产品与 UI 的参考源；仅迁移不依赖 Electron、账户、云端或设备服务的组件、状态和领域模型。
2. **先验证接口，再扩大 UI。** 第一个工程切片是 DSH Browser Client 运行时，而不是完整视觉重制。
3. **本地优先、BYOK、最小发送。** 密钥仅由 DSH 管理；作品内容仅按用户可见的上下文清单直接发送给其配置的 DeepSeek 服务。
4. **作者控制优先于自动化。** Ask 不写入；Write 只产生 Proposal；没有明确审阅与确认就不会更改稿件。
5. **完成需有证据。** 每阶段分别记录实现提交、针对性自动化、localhost 手工验证；涉及模型时另有真实 BYOK 验证，但不记录或泄露密钥。

## 当前阶段

阶段 0 正在进行。基础 Host policy、Ask/Write presets 和无通用文件/终端工具的限制已存在；下一项工作是 [Browser Client 技术 Spike](plans/phase-0-dsh-browser-client-spike.md)。

