---
title: "科研知识库使用指南 / User Guide"
tags: ["research", "guide"]
created: ""
updated: ""
type: "permanent"
record: "guide"
status: "template"
summary: "科研知识库使用指南 / User Guide"
project: ""
sources: []
aliases: []
---

# 科研知识库使用指南 / User Guide

## 第一次使用

如果下载的是 `danta-research-vault-v1.9.0.zip`，直接解压并打开其中 `00_科研知识库_Research-Vault` 文件夹即可；已附主引导和角色配置，无需再运行初始化器。以下命令仅针对完整工作台发行包。

从发行包运行 `python3 scripts/create_research_vault.py --dest <一个尚不存在的新目录>`。脚本只复制公开模板、主引导和项目角色，不读取其他 vault，不安装第三方插件，不覆盖同名目录。终端中含空格的路径需加引号。新库路径是 Obsidian 与 Codex 共同打开的同一个目录。

Obsidian：Manage Vaults → Open folder as vault，选择新库根目录；打开 `00_index.md`。初始化包附核心 Templates 设置，不依赖 Dataview、Templater 或同步服务。第一次确认 Settings → Core plugins → Templates 已启用，模板目录为 `12_笔记模板_Templates`。新建笔记后在正文调用 Templates: Insert template；变量会展开，复制粘贴模板文件本身则不会自动展开。

Codex：打开同一新库，发“使用 $danta-proposal-guide，称呼我龚博士。先按 Path-Map 恢复我的研究画像、协作偏好、状态与 Idea 画布，再从我当前最需要的地方继续。”知识库不是自动注入模型的永久记忆；这套读取协议让新会话有依据地恢复。初始化画像中的资料均注明由准备者提供、待龚博士核实。

外部科研 skills 仍按发行包安装指南安装，和已有目录冲突时备份比较。本库已附主引导，在全局装了旧版时优先显式阅读本库入口。真实子 agent、PDF解析和联网检索需单独试用；有配置不代表验证完成。

## 第一天只做三件事

打开首页；把一份愿意提供的资料放到原始资料区或给出已有受控位置；说清当前困惑。AI 先登记来源与阅读范围，再按需要建立一篇文献笔记和一个问题，不催你填完整套模板。

## 常用话术

- “把这份材料登记归档，保留原件，写清读到了哪里。”
- “从这篇研究提炼一个可复用知识条目，分开作者结论和我的推断。”
- “用证据ID更新当前课题，检查它是否改变我们的 OGSM。”
- “收尾：更新需要长期记住的内容和未闭环事项，下次从哪里继续。”
- “只检查索引、重复和断链，先给修复方案，不移动现有文件。”

## 已有 Obsidian 库

推荐先把新科研库作为独立 vault 使用。确需嵌入旧库时，先在库外生成新模板，再只复制笔记目录到一个新建的编号课题目录；不要复制 `.obsidian`、根 AGENTS 或 `.agents` 去覆盖旧配置。相对 Markdown 链接随整体目录复制仍可用；旧 vault 的附件目录和 Templates 位置要在 UI 手动选择。让 Codex 打开该课题子目录并显式读取其入口。不要同时把嵌套库和外层库作为两个 vault 修改同一文件。

## 同步与恢复

同步按学校、医院和课题组的资料管理要求自行配置；本模板不启用任何云同步、自动上传或自动 Git push。同步不是备份。定期保留离线版本快照，并在独立目录验证能恢复首页、附件、台账和链接。原始医学数据留在批准的受控环境，本库只用合规研究ID和访问说明。

## 官方参考

- [Vault 管理](https://obsidian.md/help/manage-vaults)
- [核心 Templates](https://obsidian.md/help/plugins/templates)
- [内部链接](https://obsidian.md/help/links)
- [属性](https://obsidian.md/help/properties)
- [附件](https://obsidian.md/help/attachments)

核对日期：2026-09-24。尚未在蛋挞设备上实测。

## 组会

从首页“准备组会”进入。先明确问题，整理真实依据和讨论选项；按需生成逐页提纲与口头摘要，会后按真实记录更新决策、OGSM及未闭环。没有结果时可以汇报困难与排查，不补造发现。Templates已含第13类“组会讨论”。
