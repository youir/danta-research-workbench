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

## 后续可选扩展（暂不接入）

社区另有两类开题后阶段的技能，属实验执行与论文产出范畴，超出本工作台"开题"边界，暂不引入：`build-research-evidence`（方法设计→代码实现→实验执行→结果诊断→投稿证据审查的多技能协作流程）与 `nature-academic-search`、`nature-writing` 等论文阶段技能。若未来评估，须先核验其仓库、许可与 references 内容，再按本文档的固定提交方式引入；评估记录写入本文件。
