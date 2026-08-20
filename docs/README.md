# Narraiva DSH 开发文档

这里是 Narraiva DSH 的本地 Markdown 文档入口，也是开发规划的权威载体。

## 文档约定

- 未标记日期的路线图、决策和阶段计划描述当前意图；实现后必须随着代码与验收证据更新。
- `plans/` 存放可执行阶段计划。每一份计划必须说明目标、非目标、交付物、验收方式和退出条件。
- `decisions/` 将存放会影响公开协议、权限、数据边界或长期维护的架构决策记录（ADR）。
- `evidence/` 将存放已经完成的自动化、localhost、Windows 手工验证和发布证据；计划不是证据。
- 飞书中的早期讨论用于协作留档；本目录是开发时应随代码维护的版本。

## 当前入口

- [产品与技术路线图](ROADMAP.md)
- [阶段 0：DSH 与 Browser Client 技术 Spike](plans/phase-0-dsh-browser-client-spike.md)

## 当前边界

Narraiva DSH 是一个开源、local-first 的 DeepSeek Harness 插件。用户自行在其本地 DSH 环境配置 DeepSeek API Key；Narraiva DSH 不连接 Narraiva Cloud，不接收密钥、稿件、项目数据或遥测。

当前代码仅完成了基础 Host 策略与 Ask/Write preset Spike；它尚未包含 Narraiva 工作台、项目持久化、Proposal/Diff、Storybase、Stylebase 或发布安装器。

