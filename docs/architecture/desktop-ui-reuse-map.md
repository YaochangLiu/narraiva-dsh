# Narraiva Desktop → DSH 客户端复用映射

## 结论

Narraiva DSH 的界面以当前 `NovelOS-alpha` 桌面端为唯一产品源头，不另行发明一套产品哲学。Public Alpha 已按照桌面端的布局、视觉 token、组件职责与交互状态完成独立的 DSH Browser Client 实现；由于运行时和开源边界不同，本期没有直接复制 Desktop React/Electron 源文件。未来直接迁移源码前必须补充来源与许可记录。

这份映射把“可以直接用什么”和“必须用 DSH 改写什么”分开，避免在公共 BYOK 插件中意外携带 Electron、Narraiva Cloud、账户或设备逻辑。

## Phase 0 已建立的迁移骨架

Phase 0 已验证 DSH 的装载边界，并以桌面端同名组件责任实现了可运行的 Web 壳。它不是对 Desktop TSX 的逐文件复制：Electron、Zustand、Monaco 和本地服务使直接 import 不成立。Phase 1 应在这些已经固定的边界内，将可移植的组件、token 和状态模块从 `NovelOS-alpha` 逐项迁入；在此之前，不把下面的“对应”误称为原文件已经复制。

| 桌面端源组件 | DSH Browser Client 对应 | 本阶段的状态 | DSH adapter 替换点 |
| --- | --- | --- | --- |
| `components/layout/AppShell.tsx` | `NarraivaRoot` + 三栏 workbench | 已验证同一布局责任 | DSH `shell.overlay` 作为可见主 UI；上游 `root` 只保留 layout runtime 服务 |
| `components/layout/TitleBar.tsx` | `NarraivaTitleBar` | 已实现可运行的 Web 对应壳 | 删除窗口控制和原生菜单调用 |
| `components/sidebar/ProjectNavigator.tsx` | `ProjectNavigator` | 已按职责映射并以本地 project adapter 独立实现树与操作 | 后续逐项校准产品一致性，不复制 Electron 依赖 |
| `components/editor/ManuscriptEditor.tsx` | `ManuscriptEditor` | 已按职责映射并以 browser project adapter 独立实现文本、保存与选区 | 后续逐项校准产品一致性 |
| `components/assistant/AIPanel.tsx` | `AssistantPanel` | 已按职责映射并以 DSH conversation adapter 独立实现消息与发送 | 后续逐项校准产品一致性 |
| `components/layout/StatusBar.tsx` | `NarraivaStatusBar` | 已实现无敏感连接状态 | DSH `connection` 只暴露无敏感连接状态 |

## 不可直接复制的依赖

| 桌面端依赖 | DSH 处理 | 原因 |
| --- | --- | --- |
| `window.electronAPI`、窗口控制、原生菜单 | 删除或用 Web 行为替代 | 浏览器插件没有 Electron runtime |
| Desktop Zustand stores 中的设备、账户、云端状态 | 不迁入 | 本项目是本地优先、无 Narraiva Cloud 的 BYOK 插件 |
| 本地文件系统服务、自动保存、Monaco bridge | Phase 1 `NarraivaProjectAdapter` | 先定义项目根目录授权与恢复约束，不能在 Phase 0 隐式读取文件 |
| 现有 assistant/runtime 客户端 | Phase 2 `NarraivaConversationAdapter` | 仅使用用户在 DSH 内配置的 DeepSeek Key；浏览器不接触 Key |

## 迁移规则

1. 每个迁入组件保留桌面端的责任、信息架构与用户可见状态；不要因 DSH 的默认 UI 而回退成聊天窗口。
2. 每个非可移植调用都必须收敛在命名 adapter 中，组件不可直接调用 `window`、Node API、云 API 或密钥接口。
3. 组件迁入的先后顺序是：布局与 token → 项目/编辑器本地 adapter → DSH 对话 adapter → Write 审阅 surface。
4. 每次同步桌面端 UI 时，都须审查许可证、隐私边界与依赖图；不会把私有服务实现复制进公开仓库。
