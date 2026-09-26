# Skills 来源、固定版本与能力边界

## 来源

仓库：[K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills)

本包固定提交：`49c6e97775eaa18ba791bebe23162a70ae601c18`。不跟随 main 自动升级。

原始许可：MIT，Copyright (c) 2025 K-Dense Inc.，全文见 `vendor/LICENSE-K-Dense.md`；每个安装技能也附带 `UPSTREAM_LICENSE.md`。

本包复制七个 skill 的完整子目录，保留原文、scripts、references 和 assets；仅增加许可证副本。安装器不运行上游代码，也不联网。主引导技能、中文模板和本包脚本为此工作台编写，并非 K-Dense 官方产品。

| 技能 | 固定版本源码 | 基础用途与扩展依赖 |
|---|---|---|
| scientific-brainstorming | [SKILL.md](https://github.com/K-Dense-AI/scientific-agent-skills/blob/49c6e97775eaa18ba791bebe23162a70ae601c18/skills/scientific-brainstorming/SKILL.md) | 见下表与对应 SKILL.md |
| literature-review | [SKILL.md](https://github.com/K-Dense-AI/scientific-agent-skills/blob/49c6e97775eaa18ba791bebe23162a70ae601c18/skills/literature-review/SKILL.md) | 见下表与对应 SKILL.md |
| scientific-critical-thinking | [SKILL.md](https://github.com/K-Dense-AI/scientific-agent-skills/blob/49c6e97775eaa18ba791bebe23162a70ae601c18/skills/scientific-critical-thinking/SKILL.md) | 见下表与对应 SKILL.md |
| hypothesis-generation | [SKILL.md](https://github.com/K-Dense-AI/scientific-agent-skills/blob/49c6e97775eaa18ba791bebe23162a70ae601c18/skills/hypothesis-generation/SKILL.md) | 见下表与对应 SKILL.md |
| statistical-analysis | [SKILL.md](https://github.com/K-Dense-AI/scientific-agent-skills/blob/49c6e97775eaa18ba791bebe23162a70ae601c18/skills/statistical-analysis/SKILL.md) | 见下表与对应 SKILL.md |
| research-grants | [SKILL.md](https://github.com/K-Dense-AI/scientific-agent-skills/blob/49c6e97775eaa18ba791bebe23162a70ae601c18/skills/research-grants/SKILL.md) | 见下表与对应 SKILL.md |
| peer-review | [SKILL.md](https://github.com/K-Dense-AI/scientific-agent-skills/blob/49c6e97775eaa18ba791bebe23162a70ae601c18/skills/peer-review/SKILL.md) | 见下表与对应 SKILL.md |

## 依赖分层

- 第一层：主引导、阅读资料、访谈、整理模板。安装器需要 Python 3.9+，无需 API Key 或科学计算库；不会替你安装 Python 本身。
- 第二层：brainstorming、hypothesis-generation、peer-review 的随附校验脚本，按上游说明要求 Python 3.11+；安装时不运行。
- 第三层：联网检索、统计计算和导出等实际任务，按所选脚本再检查依赖。统计上游包含 SciPy、statsmodels、pingouin 等选项；PDF 导出可能需要 Pandoc/LaTeX；部分检索或绘图涉及第三方服务。

## 上游流程里需要特别辨别的要求

`literature-review` 当前原文将 parallel-web 作为主要检索入口，并要求用 scientific-schematics 生成综述配图。本包未打包这些额外技能/服务，也未配置其 API。它们不是完成研究画像和开题选题所必需的条件。

若暂不配置，应明确以现有检索工具执行“借鉴该 skill 的文献证据整理”，保留检索记录和引用核验；不要宣称完整执行了该 skill，也不要默默上传未公开资料或自动开通付费服务。

`scientific-brainstorming` 提到 experimental-design 与 statistical-power 等其他技能；本包没有声称安装它们。当前阶段可以使用本包设计检查表与 statistical-analysis 辅助，复杂设计仍应接受相应专家审查。

research-grants 中的特定资助机构模板仅作论证参考，学校要求优先。peer-review 不授予任何第三方保密手稿处理权限。

## 更新与完整性

安装文件的摘要保存在 MANIFEST.json。校验可发现下载、解压或编辑造成的变化，但摘要本身不是发布者数字签名，也不证明科研有效性。

更新时应先查看新版本及依赖变化，再在独立目录试用，记录新提交。不要直接覆盖已用于研究的旧版本；研究记录需要保留可追溯性。

## v1.4 新增的固定来源

|模块|仓库与固定提交|许可与打包范围|
|---|---|---|
|codex-research|[LIU-31415/codex-research](https://github.com/LIU-31415/codex-research/tree/a943bf3678bd92904f3520322a66ae1faca65b1a)|MIT；仅SKILL.md、references、LICENSE和VERSION（0.2.4）|
|nature-reader、nature-shared|[Yuan1z0825/nature-skills](https://github.com/Yuan1z0825/nature-skills/tree/9c9953a06cd33a88cbd258386a295ca4b6a1ef1e)|Apache-2.0；运行子目录（排除带上游本机路径的evals），另附UPSTREAM_LICENSE；保留的原文件未修改|

各模块来源与提交另记在 MANIFEST.json 的对应条目；顶层 upstream 字段保留旧版 K-Dense 信息供兼容使用，并不代表所有第三方模块都来自该仓库。

`codex-research` 的学术检索连接器可选且未打包；`nature-reader` 的完整读本可能需要PDF提取、OCR或图像处理工具，均非安装技能时自动就绪。`nature-shared` 内对其他未附带 Nature 技能的说明仅是上游参考，不代表已安装。主引导按范围选择模块，不将期刊名当作质量认证。

上游 nature-reader 的 SKILL.md 标记2.1.1、manifest.yaml标记2.1.0；保留原文，以固定提交和文件摘要标识本版。首轮测试仅覆盖摘要/图注转述问答，详见 [报告](tests/reports/v1.4-skills-review.md)。

## 后续可选扩展（未打包）

`nature-academic-search`、`nature-writing`、`researchwrite` 与实验执行模块仍未接入。若需要，应分别审查许可、依赖与实际行为，固定版本后引入；不会因本次安装自动可用。

v1.10.0 的 GitHub 候选清单见 [扩展候选与试用标准](11_GitHub扩展候选与试用标准.md)。核查发现 OpenAI Life Science Research 插件的 GitHub 目录虽可公开浏览，manifest 却声明 Proprietary，因此不纳入开源发行包。`scientific-agent-skills` 由多个许可来源组成；必须审查具体 skill，而非仅依据整个仓库的 MIT 文档打包。

## 生物数据库与论文写作扩展（v1.14）

- `skills/danta-bioservices/` 是本工作台原创的跨数据库访问流程技能，支持规划 UniProt、KEGG、Reactome、ChEMBL 等查询与 ID 映射。上游参考为 [K-Dense scientific-agent-skills 的 bioservices](https://github.com/K-Dense-AI/scientific-agent-skills/tree/49c6e97775eaa18ba791bebe23162a70ae601c18/skills/bioservices)。其上游仓库根 `LICENSE.md` 是 MIT，但该项 `SKILL.md` 自标 GPLv3；为避免许可混用，本包没有复制其文本、脚本或 references。具体执行所需 Python `bioservices` 包按其自身许可另行安装。
- `skills/danta-bio-paper-writing/` 为工作台原创，提供 R/RStudio 检测、后端选择/分析执行分层确认、证据驱动稿件流程和生物医学科研图检查。它参考截图所述 Codar 功能和 [Teng-bio/codex-skills-hub 的 bio-paper-writing](https://github.com/Teng-bio/codex-skills-hub/tree/c6fa6a320d82fdbdb6f68936473b5d54ed451b7b/skills/local/bio-paper-writing) 的用途描述；该上游未声明可再分发许可，未复制其代码/文本。截图展示的 Codar 版本并不等同于上述 GitHub 项目。
- 两个原创技能随主引导依赖安装，在 Codex 中作为按需专项技能提供；并非 Codar 官方插件，也不代替真实数据库服务、R/Python 环境或 BioRender。Bio 图稿路由至工作台 PPT/科研图流程，并保留可编辑源文件、证据状态和真实病理图像边界。

## v1.5 女娲固定来源与适配

[alchaincyf/nuwa-skill](https://github.com/alchaincyf/nuwa-skill/tree/fe0374687037c4cc51a65c1e0c145afe2981dc69)，提交 `fe0374687037c4cc51a65c1e0c145afe2981dc69`，实际技能名 `huashu-nuwa`。MIT，Copyright (c) 2026 Huashu (花叔)，见该技能内 LICENSE。

原样保留SKILL.md、references/、scripts/、LICENSE及评分卡引用的COMMUNITY.md/CONTRIBUTING.md；不分发人物示例、宣传资产或本机缓存。固定版本不自动升级。路径/并发/落盘和科研用途适配集中在主引导 [expert-distillation.md](skills/danta-proposal-guide/references/expert-distillation.md)，没有删改上游蒸馏阶段、确认检查点或质量标准。

独立验证不可用时应交付标明缺口的中间产物，不能声称完整蒸馏通过。原始脚本的关键词比例不等于实际来源比例；保真评分不等于科研有效性。来源、模型局限和知识截止时间随顾问保存。
