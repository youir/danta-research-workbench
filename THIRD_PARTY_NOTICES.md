# 第三方来源与使用范围

`vendor/skills/` 中原有七个 K-Dense 技能来自 K-Dense-AI/scientific-agent-skills，固定提交 `49c6e97775eaa18ba791bebe23162a70ae601c18`，保留原始 MIT 许可证，见 `vendor/LICENSE-K-Dense.md` 与各技能内 `UPSTREAM_LICENSE.md`。

主引导、工作区模板、协作角色与本仓库自编脚本为本项目内容。公开可访问不自动意味着本项目全部内容已按 MIT 授权；第三方许可仅适用于其对应部分。本次发布未另行授予本项目原创部分的开源许可证。

公开学者方法参照沿用原包出处，并明确为有限方法归纳，不代表教授真实意见或对项目的授权。个人导师关系不在公开模板中预填。

## 新增第三方模块（v1.4）

- `vendor/skills/codex-research/` 来自 LIU-31415/codex-research，提交 `a943bf3678bd92904f3520322a66ae1faca65b1a`；运行文件原样保留，MIT许可见目录中的 LICENSE。未分发其维护脚本与测试目录。
- `vendor/skills/nature-reader/`、`vendor/skills/nature-shared/` 来自 Yuan1z0825/nature-skills，提交 `9c9953a06cd33a88cbd258386a295ca4b6a1ef1e`；保留的原文件未修改，排除含上游个人本机路径的evals目录，仅增加许可副本。Apache-2.0全文见 `vendor/LICENSE-Nature-Skills` 及各目录的 UPSTREAM_LICENSE。保留原作者标注；本工作台不代表上游作者或期刊认可。
- 测试报告仅分发自主编写的情境和概述，不分发论文全文、图像或下载失败的网页。

## 女娲（v1.5）

`vendor/skills/huashu-nuwa/` 的运行文件来自 alchaincyf/nuwa-skill，固定提交 `fe0374687037c4cc51a65c1e0c145afe2981dc69`，MIT许可见目录内 LICENSE，Copyright (c) 2026 Huashu (花叔)。所分发的上游文件未修改；工作台适配说明另存于主引导references。生成顾问按原模板保留女娲与创建者归属。本包未分发原仓库人物示例或任何新生成专家语料。

## 可编辑科研 PPT（v1.11）

`vendor/skills/presentation-skill/` 来自 [siril9/presentation-skill](https://github.com/siril9/presentation-skill)，固定提交 `b6b0974e75e4c7702cfa48ba037d241f2b601d9c`（上游版本 `0.12.0`）。完整上游 MIT `LICENSE` 与技能文件随包保留；本工作台另增 `UPSTREAM_SOURCE.md` 记录固定来源。它提供从结构化提纲生成与校验可编辑 `.pptx` 的工作流。使用其依赖时各依赖仍按自己的许可证分发；本工作台没有附带私有视频平台、第三方研究资料或上游 demo 研究源文件。
