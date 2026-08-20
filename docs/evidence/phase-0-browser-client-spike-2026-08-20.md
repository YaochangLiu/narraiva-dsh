# Phase 0 Browser Client Spike 验证证据

**日期：** 2026-08-20
**DSH 源码基线：** `99f6f02fecdb7dff40c3fbc9470f5907c29f74ca`
**Narraiva DSH 基线：** Phase 0 工作区变更，提交前验证

## 自动化验证

- `pnpm test`：9/9 通过。
  - 覆盖双端 package 声明、`./package.json` 元数据导出、Browser Client closure factory、`shell.overlay` 注册、Ask/Write preset 和工具限制。
- `node scripts/verify-profile-composition.mjs`：通过。
  - 使用隔离 profile `narraiva-phase0` 与临时 `DSH_HOME`。
- `git diff --check`：通过。
- 静态敏感边界扫描：未发现密钥值、Narraiva Cloud URL 或 Cloud 调用；文档中仅保留“用户自行在 DSH 配置 DeepSeek API Key”的产品说明。

## localhost / Chrome 验证

以 Node 24 启动隔离 profile：

```powershell
$env:DSH_HOME = '.tmp\\phase0-dsh-home'
$env:DSH_PROFILE = 'narraiva-phase0'
$env:DSH_PORT = '3082'
$env:DSH_NODE = '<Node 24 path>'
$env:DSH_SOURCE = '<DeepSeek Harness checkout>'
node scripts/start-local-spike.mjs
```

在 Chrome 打开 `http://127.0.0.1:3082`，未填入 API Key，选择“稍后配置”。确认：

1. Narraiva 三栏工作台为唯一可见产品 UI；DSH 的 layout runtime 留在底层以满足官方 client 依赖。
2. 顶部栏、项目导航、章节树、稿件编辑区、对话/历史、状态栏均已显示。
3. 默认状态为 `Ask`、`Chapter 2`、DSH 本地连接已就绪。
4. 点击 `Chapter 3` 会更新活动稿件标题；点击 `写作` 会把本阶段的根节点预览状态改为 `write`，不会改变 DSH session preset。
5. 浏览器控制台无 error。

该验证没有创建、保存、读取或发送作者项目文件，也没有配置或传输 API Key。
