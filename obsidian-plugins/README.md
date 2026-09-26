# 龚博士的 Obsidian 信息源与工作台面板

本仓库包含两个独立的 Obsidian 社区插件，适配龚博士现有 `GY` vault，也可用于新建的 `00_科研知识库_Research-Vault`。实现前检查了 [Qiaomu AI RSS 的公开源码](https://github.com/joeseesun/qiaomu-ai-rss)，重点参考 RSS/Atom 与 OPML 解析、来源分组、缓存策略和输入边界；插件代码为本项目独立编写，没有复制其源码、素材、服务或数据。为清楚标示代码审阅的上游来源，RSS 插件按 GPL-3.0-only 许可分发；管理面板与构建脚本采用 MIT 许可。

## 科研信息源

`danta-rss-collector` 支持 RSS/Atom 来源、分组、全部/未读/收藏筛选、搜索、手动更新、按间隔自动更新和保存线索到知识库。

- 初始来源列表为空。龚博士添加并选择具体来源，工作台不会替她预设订阅。
- 添加源只保存地址，不发请求。自动更新默认为关闭。手动更新或她明确打开自动更新后，插件才请求她添加的 HTTP/HTTPS 地址。
- 默认间隔为 6 小时，可设为 30–1440 分钟。暂停单个源不删除历史文章。
- 默认只保留最多 60 篇/源、1200 篇本机缓存；源内容上限 2.5 MB。刷新失败会保留已有缓存。
- 文章只在点击「存入知识库」后创建为 Markdown，保存来源提供的短摘要、日期和原文链接；不抓全文、不生成 AI 摘要、不上传到外部服务。
- 文章笔记位于 `01_收件箱_Inbox/02_RSS_动态线索/`，初始标记 `status: to_review`。她阅读并核实后，可转为正式阅读笔记。
- 订阅地址、已读/收藏和缓存保存在当前库 `.obsidian/plugins/danta-rss-collector/data.json`。如果订阅 URL 含令牌，应把知识库和同步备份当作私密资料。

插件使用 Obsidian 官方 `requestUrl` 发起她明确配置的源请求。URL 仅接受 HTTP(S)，摘要作为纯文本呈现，不执行源内 HTML、脚本或嵌入内容；拒绝含 DTD/ENTITY 的 XML，并限制单源大小和条目数。网络失败、内容变更和 RSS 不完整均由人核验。

## 科研工作台面板

`danta-workbench-dashboard` 汇总笔记数、带工作状态的待跟进记录、RSS 待复核条目、最近更新以及知识库核心目录入口。它只读取当前 Obsidian 知识库内编号的科研目录，不读取隐藏目录、其他工作区或知识库外文件，不联网、不改写笔记。

面板是概览，不代替 index、来源登记、实验记录或导师意见。待跟进数来自笔记 frontmatter 的 `status`；如果记录没填写状态，面板不会推测其进度。

## 安装

### 新建的空白知识库

v1.13.0 的独立知识库 ZIP 已包含两款插件并在 Obsidian 插件列表中启用。打开知识库后，可从左侧 ribbon 图标或命令面板打开「科研信息源」和「科研工作台」。打开 RSS 面板本身不会联网。

### 龚博士现有 GY 知识库

1. 在龚博士电脑上确认 Obsidian 当前打开的就是 `GY` vault；若不清楚路径，请让她通过 Obsidian“管理库”确认。
2. 从 v1.13.0 独立知识库 ZIP 解压出 `.obsidian/plugins/danta-rss-collector/` 和 `.obsidian/plugins/danta-workbench-dashboard/`。
3. 将这两个插件文件夹复制到 GY 的 `.obsidian/plugins/` 下。若目标插件目录已经存在，先备份并比较，不要覆盖她的配置或自定义内容；不要改动已有笔记或其他 Obsidian 设置。
4. 打开 Obsidian → 设置 → 第三方插件，启用「龚博士科研信息源」与「龚博士科研工作台面板」。
5. 先打开信息源设置，由龚博士添加认可的订阅；确认后再决定是否开启自动更新。

插件安装只访问 Obsidian 配置目录；读取或归纳 GY 内既有研究资料属于另一项工作，开始前必须取得龚博士本人授权。

不会修改她现有的 `community-plugins.json`、插件配置或研究记录。复制后新插件需在设置中手动启用。

## 本地开发和测试

项目使用 Obsidian 官方 API，以 `obsidianmd/obsidian-sample-plugin` 为开发结构参考。运行 `npm ci`、`npm test` 和 `npm run build`。RSS XML 解析核心通过小型固定测试；完整桌面/移动交互仍需在 Obsidian 中人工验收。

## 设计参考

- [Qiaomu AI RSS](https://github.com/joeseesun/qiaomu-ai-rss)：已检查其公开代码，并参考健壮性设计和交互；没有复制上游代码。上游 GPL-3.0-only 许可文本随 RSS 插件保留。
- [Obsidian 官方插件开发文档](https://docs.obsidian.md/)
- [Obsidian 官方 `requestUrl` API](https://docs.obsidian.md/Reference/TypeScript%20API/requestUrl)：使用官方网络请求接口，而非浏览器跨域 `fetch`。
- [Obsidian 官方插件示例](https://github.com/obsidianmd/obsidian-sample-plugin)
