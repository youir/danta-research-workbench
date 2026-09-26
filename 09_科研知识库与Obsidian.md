# 科研知识库与 Obsidian / Research Knowledge Vault

这是给龚博士的新研究项目使用的私有科研知识库：从 00 开始的中英文目录、分层索引、笔记模板、来源追溯、OGSM 与长期记忆。参考她指定的 hwm 目录结构和低噪音记忆原则重新编写，不包含 hwm 的个人或业务资料。

## 最省事：下载可直接打开的知识库ZIP

下载最新版独立知识库 ZIP，解压到她自己的私有研究目录，然后在 Obsidian 与 Codex 打开同一个 `00_科研知识库_Research-Vault` 文件夹，再打开 `00_index.md`。主引导和角色配置已附带，不含真实研究资料，也不要求先安装其他技能或执行终端命令。若希望 Codex 协助下载、部署与配置，直接复制 [本机部署说明](12_本机部署与首次配置.md) 的启动语。

## 从完整发行包创建独立知识库

在完整发行包目录运行：

```bash
python3 scripts/create_research_vault.py --dry-run
python3 scripts/create_research_vault.py
```

默认生成私有 `.local/research-vault/`，脚本会打印完整路径。也可用 `--dest` 指向仓库外**尚不存在的新目录**。重复运行保留已有知识库，既不升级也不覆盖笔记；已有其他目录会被拒绝。

用 Obsidian 的 **Open folder as vault** 打开这个目录；Codex 也打开同一目录，阅读 `00_index.md`。这种本地文件夹方式是 Obsidian 官方支持的使用方式，见 [Vault 管理](https://obsidian.md/help/manage-vaults)。本次只交付模板和初始化能力，没有操作蛋挞电脑上的应用或现有库。

初始化已附带主引导 skill、三个 agent 的项目配置和核心 Templates 配置。科研第三方 skills 仍按 [安装指南](01_安装与环境指南.md) 安装；不会自动装社区插件、云同步或后台任务。没有 Python 时，可以完整复制 [模板目录](templates/00_科研知识库_Research-Vault/00_index.md) 所在文件夹到私有位置，再按指南从发行包安装或显式读取主引导；手工复制不自动附加主引导与agent配置。

第一次启动只需说：

> 使用 $danta-proposal-guide，称呼我龚博士。先恢复本项目相关上下文，告诉我你对研究背景、当前进展和未知的理解，再从我今天最想处理的事开始：……

主引导会按任务读取索引、研究画像、当前状态、Idea 画布和相关来源；龚博士只要正常提出需求，无须手动背诵 Path-Map 或 skill 名称。新使用者不先安装第三方 skills、agent 插件或科学计算环境；任务需要时再单独配置。

## 目录分工

| 编号 | 中英文目录 | 职责 |
|---|---|---|
| 00 | 系统 System | 入口、规则、使用、路径映射、维护 |
| 01 | 收件箱 Inbox | 待整理输入与困惑 |
| 02 | 原始资料 Sources | 原件与来源登记 |
| 03 | 文献证据 Literature-Evidence | 阅读笔记、检索与证据CSV |
| 04 | 知识百科 Wiki | 概念、实体、主题 |
| 05 | 课题项目 Projects | 背景、思考、候选、方案、OGSM、决定 |
| 06 | 方法流程 Methods | SOP与分析计划 |
| 07 | 数据分析 Data-Analysis | 数据字典、实验、运行、质控 |
| 08 | 成果输出 Outputs | 开题、论文、报告、图表 |
| 09 | 专家顾问 Advisors | 女娲产物与阶段索引 |
| 10 | 日志复盘 Journal | 日常、会议与阶段复盘 |
| 11 | 长期记忆 Memory | 稳定背景、未闭环、会话交接 |
| 12 | 笔记模板 Templates | 13类可插入笔记模板 |
| 13 | 附件资源 Attachments | PDF、图片与补充材料 |
| 14 | 历史归档 Archive | 替代关系、版本与归档登记 |

## 已经在旧工作台研究

旧布局继续可用，不强制搬迁。新库中的 Path-Map 对应26个旧文件；迁移按 [归档与维护指南](templates/00_科研知识库_Research-Vault/00_系统_System/04_归档与维护_Archive-Maintenance.md) 逐项复制和核验。不能用空白目录覆盖真实研究，也不应同时维护两套证据、OGSM和状态。选择新库后，它是唯一活动研究位置。

## 验证

```bash
python3 scripts/validate_research_vault.py .local/research-vault
```

只读检查索引、元数据、链接、唯一ID及路径映射，不证明材料真实、科研推断正确或使用者的 Obsidian 已配置成功。引用和原文必须实际核查。库内可见的长期记忆是有来源的 Markdown，不是自动向模型注入全部历史。

组会入口在 `10_日志复盘_Journal/03_组会_Lab-Meetings`，首页及核心Templates均已加入；详见 [组会指南](10_组会与持续研究指南.md)。
