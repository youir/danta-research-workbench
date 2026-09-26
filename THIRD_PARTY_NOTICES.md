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

## 可编辑科研 PPT 与图（v1.12）

工作台不再随包分发旧版 `presentation-skill`。当前主引擎是 [hugohe3/ppt-master](https://github.com/hugohe3/ppt-master) v6.6.0，官方发布于 2026-09-19，固定版本技能包 SHA-256 为 `4e239ac3c11036c8c9d3bb987f5ccbd02a176d6832f2404f8a067414d834d2a1`。首次制图时安装器从 [官方 v6.6.0 Release](https://github.com/hugohe3/ppt-master/releases/tag/v6.6.0) 下载原始 ZIP，校验后仅安装到当前 `.agents/skills/ppt-master/`，不会修改或裁剪上游文件。完整性检查、MIT LICENSE、赞助信息与强制 attribution guard 保留在上游包内；工作台把科学证据审查写在自己的包装技能中。

上游 requirements 为可选依赖集合；工作台不默认安装完整清单。上游将 PyMuPDF 标明为 AGPL-3.0，仅需 PDF 转换时再单独审查其许可与必要性。工作台不自动调用其在线研究、网页搜图、AI 图片生成或商业 API。未打包视频中的专有平台、上游演示资料、第三方科研来源及龚博士的研究材料。
