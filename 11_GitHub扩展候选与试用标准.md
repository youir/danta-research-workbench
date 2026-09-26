# GitHub 扩展候选与试用标准

**核对日期：2026-09-26。** 本页记录值得观察的项目，不表示它们已在龚博士设备完成端到端验证。两个本工作台原创的生信专项技能已纳入发行包；BioServices 库、R/Python 环境及其他候选仍按任务配置。

## 当前候选

| 候选 | 能力与适用阶段 | 本工作台判断 | 状态 |
|---|---|---|---|
| [scientific-agent-skills](https://github.com/yigityildiz0/scientific-agent-skills) | README 列出 17 项可供 Codex 等读取的科研 skills，包括科学问题选择、实验设计、学术报告、qPCR/引物规划、R、生信和单细胞流程。适合实际研究需要匹配到其中具体模块时评估。 | 有些主题与本工作台主引导、开题流程和研究库重叠。仓库声明不同 skill 各自保留上游许可；不能根据仓库层 README 推断所有模块都可再分发。对刚出现的小型项目，要检查确切提交、目标 skill 全文、许可和依赖。可先选一个问题选择或研究设计 skill 做隔离比较，不下载整包。 | **观察中；未打包、未安装** |
| [K-Dense BioServices skill](https://github.com/K-Dense-AI/scientific-agent-skills/tree/49c6e97775eaa18ba791bebe23162a70ae601c18/skills/bioservices) | BioServices Python 接口覆盖 UniProt、KEGG、ChEMBL、Reactome 等数据库与跨库 ID 查询。 | 用途由工作台原创 `danta-bioservices` 适配；目标上游 SKILL.md 标 GPLv3，但仓库 LICENSE.md 是 MIT，因此不复制上游文件。运行时包按需独立安装。 | **用途参考；原创适配已接入** |
| [OpenAI Life Science Research Plugin](https://github.com/openai/plugins/tree/main/plugins/life-science-research) | 生命科学数据库检索和路由，覆盖遗传学、表达、通路、蛋白结构、临床证据和公开数据集；仓库说明面向 Codex。 | 源码目录可公开访问，但该插件的 `.codex-plugin/plugin.json` 标注许可证为 **Proprietary**，因此不可称作开源项目，也不能复制进本工作台发行包。适合遵守其许可与隐私条件、并且 Codex 环境支持时另行评估。它是公共数据库研究助手，不会替代切片判读或实验。 | **只记录为外部产品；不分发** |
| [Nature-Paper-Skills](https://github.com/Boom5426/Nature-Paper-Skills) | 面向 Nature 系列投稿的论文结构、图文对齐、统计报告、图形检查和投稿前审查。 | 本工作台已有 Nature 阅读能力；该项目主要补论文后期写作与提交，和开题思维不是同一阶段。未来进入稿件阶段时按具体缺口挑选，注意官方安装器有覆盖/升级行为，须先审查脚本与现有版本。 | **后期观察；非默认项** |
| [PathAgent](https://github.com/G14nTDo4/PathAgent) | 研究全视野病理图像（WSI）的 agent 式多步证据检索与尺度选择。 | 仅当龚博士研究数字病理/WSI 时有直接参考价值；这是研究代码，不是通用 Codex skill。 | **方向待确认** |
| [MOOZY](https://github.com/AtlasAnalyticsLab/MOOZY) | 以患者病例为单位建模多个 WSI 的计算病理基础模型。 | 若研究目标涉及计算病理、跨切片患者表征或公开模型基准，再读论文、代码与模型卡；不因名字新或榜单结果就直接用于临床/实验结论。 | **方向待确认** |

## 关于已读 GitHub 技能的许可纠正

之前的讨论将 OpenAI Life Science Research 称为开源插件；核对插件 manifest 后发现这一表述不准确。GitHub 仓库公开可读不等于开放许可：插件清单明确标注 `Proprietary`。因此本包只记录链接与适用边界，不复制其技能、脚本或图标。

`scientific-agent-skills` 仓库的 `LICENSE.md` 也说明其 MIT 许可只覆盖仓库自有的目录元数据、文档、网站和打包脚本；`skills/` 下各项内容遵循各自来源许可，并要求先查 `THIRD_PARTY_NOTICES.md`。若未来要分发某一项，先核实该技能的确切来源许可和原文；无许可说明时不再分发。

## 如何试用一个候选

1. 先指出具体瓶颈：它要帮助解决哪一件她真实在做的事？主引导或已有技能目前差在哪里？
2. 锁定上游提交，读完整的目标 `SKILL.md`、被引用文件、脚本、许可、安全说明及依赖；检查联网、外传数据、覆盖文件和是否会改写研究记录。
3. 在隔离副本用公开或虚构材料做一个窄任务。保留提问、引用/运行记录、预期结果与人工核对，不把示例写入龚博士的研究画像。
4. 用实际节省的步骤、来源核查质量、可复现性、依赖负担、隐私与决定权来比较。不仅看 README 的自报基准或“全自动”演示。
5. 仅当结果清楚改善工作、许可允许分发、安装安全且能在 Codex 实测后，才考虑作为**可选模块**固定提交并打包。默认安装仍以主 agent 和私有知识库为主。

### 本工作台已接入：生物数据库与生信论文写作

截图中的两项能力现已作为 Codex 专项 skills 接入：`danta-bioservices` 与 `danta-bio-paper-writing`。它们由主引导依赖安装、按任务路由调用，采用本工作台自己的授权和证据规则。前者针对数据库查询/ID 映射；后者针对稿件协作、分析决定记录及生物医学图稿。BioServices 与截图里的 Codar 产品仍是上游/外部服务，未声称本仓库包含 Codar 官方插件。来源与许可边界见 [03_Skills来源与边界.md](03_Skills来源与边界.md#生物数据库与论文写作扩展-v114)。

## 研究方向明确后怎么选

- 偏临床/队列/医学 AI：优先评估研究设计、样本量、STROBE/CONSORT 等报告核查，谨慎处理病例资料和隐私。
- 偏分子病理/实验机制：评估实验设计、qPCR/引物规划与统计模块；由实验人员确认试剂、样本与方案。
- 偏转录组/单细胞/空间组学：再看 DESeq2、单细胞质控、scVI、公开数据集及其生信依赖。
- 偏数字病理/WSI：重点追踪 PathAgent、MOOZY 与基础模型基准，并依据组织来源、切片制备、患者层级拆分和独立验证审查。

起点仍是 [龚博士启动指南](00_从这里开始.md)；整体工具分层见 [完整体系架构](08_完整体系架构.md)。
