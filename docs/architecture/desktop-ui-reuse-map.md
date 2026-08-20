# Narraiva Desktop → DSH 客户端复用映射

## 结论

Narraiva DSH 的界面以当前 `NovelOS-alpha` 桌面端为唯一产品源头。它不是重新设计的网页，也不是对桌面端视觉的参考实现：可移植的布局、视觉 token、组件层次与交互状态将直接迁入本仓库；只有运行时边界需要替换。

这份映射把“可以直接用什么”和“必须用 DSH 改写什么”分开，避免在公共 BYOK 插件中意外携带 Electron、Narraiva Cloud、账户或设备逻辑。

## Phase 0 已建立的迁移骨架

Phase 0 已验证 DSH 的装载边界，并以桌面端同名组件责任实现了可运行的 Web 壳。它不是对 Desktop TSX 的逐文件复制：Electron、Zustand、Monaco 和本地服务使直接 import 不成立。Phase 1 应在这些已经固定的边界内，将可移植的组件、token 和状态模块从 `NovelOS-alpha` 逐项迁入；在此之前，不把下面的“对应”误称为原文件已经复制。

| 桌面端源组件 | DSH Browser Client 对应 | 本阶段的状态 | DSH adapter 替换点 |
| --- | --- | --- | --- |
| `components/layout/AppShell.tsx` | `NarraivaRoot` + 三栏 workbench | 已验证同一布局责任 | DSH `shell.overlay` 作为可见主 UI；上游 `root` 只保留 layout runtime 服务 |
| `components/layout/TitleBar.tsx` | `NarraivaTitleBar` | 已实现可运行的 Web 对应壳 | 删除窗口控制和原生菜单调用 |
| `components/sidebar/ProjectNavigator.tsx` | `ProjectNavigator` | 已实现静态层次与选择预览 | Phase 1 直接迁入可移植 UI 并以本地项目 adapter 提供树与操作 |
| `components/editor/ManuscriptEditor.tsx` | `ManuscriptEditor` | 已实现静态编辑工作区预览 | Phase 1 直接迁入可移植 UI 并以 editor/project adapter 提供文本、保存与选区 |
| `components/assistant/AIPanel.tsx` | `AssistantPanel` | 已实现对话、历史、模式控制预览 | Phase 2 直接迁入可移植 UI 并以 DSH conversation adapter 提供消息和发送 |
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
