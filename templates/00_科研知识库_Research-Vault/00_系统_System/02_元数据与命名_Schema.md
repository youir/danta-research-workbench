---
title: "命名、元数据与唯一记录 / Schema"
tags: ["research", "guide"]
created: ""
updated: ""
type: "permanent"
record: "guide"
status: "template"
summary: "命名、元数据与唯一记录 / Schema"
project: ""
sources: []
aliases: []
---

# 命名、元数据与唯一记录 / Schema

## 命名

业务目录从 `00` 连续编号，格式为 `00_中文_English`；每层用 `00_index.md` 导航，标题同时写中文与英文。记录命名：`01_LIT-0001_中文主题_English-Topic.md`；日期记录：`01_2026-09-24_会议_Meeting.md`（仅格式示例，日期以实际为准）。编号是排序，不是证据等级。ID 在类型内唯一且不复用；改标题不改ID。

避免空格及 Windows 禁用字符，不把人名/患者标识放入文件名。`AGENTS.md`、`SKILL.md`、`.obsidian`、`.agents`、`.codex`、JSON配置键以及女娲顾问内部原版目录为工具协议例外，不强行改名。已有权威原件按原名保存，通过登记表和侧边笔记给中英文说明，不能只为统一命名破坏原件。

## 属性

沿用 fleeting（待整理）、literature（阅读）、permanent（可复用知识）三值；`record` 另标 source/literature/concept/topic/method/experiment/analysis/meeting/decision/memory/review/output，不把 permanent 理解为永久正确。

| 字段 | 规则 |
|---|---|
| title / summary | 可读标题与一句话摘要；摘要不代表已读全文 |
| id | 记录稳定ID；LIT/CON/EXP/RUN/DEC/MEM等前缀；创建时查重 |
| created / updated | 实际日期 YYYY-MM-DD；created不随编辑改写；空白模板不伪造研究日期 |
| type / record | 笔记类型和科研用途，互不混用 |
| status | template / draft / reviewed / superseded / archived；reviewed不代表假说已证实 |
| project | 主课题P001；共享条目可为空，正文列关联课题 |
| sources | 来源ID列表或可解析链接；统一复数，不再混用source |
| aliases / tags | 中文英文同义词；小写标签research、reading、method、evidence、idea、decision、memory、output等 |

自定义属性不自动变成检索证据。真实笔记的id、来源、日期由人或AI按实际填写；不知道就空着并在正文标缺口。模板变量仅用核心 Templates 支持的 title/date/time，创建后核对并补唯一ID。

## 链接与权威位置

默认用相对 Markdown 链接，GitHub和Obsidian均可读；同名 index 用完整相对路径消歧，不用裸 index 链接。需要 Obsidian 双链时用自动补全选真实文件；YAML内双链需引号。不为“图谱好看”创建无内容的虚假关联。

- 当前状态、Idea画布、OGSM、人的决策：只在主课题对应文件维护，路径以 Path-Map 为准。
- 检索记录与证据矩阵CSV：逐项权威记录；阅读笔记解释细节，证据导航和Wiki仅引用证据ID。
- 原始资料：保留原件；PDF/图像不加YAML，元数据写来源登记或侧边Markdown。
- 实验记录 → 数据集ID → 分析运行ID → 图表ID → 成果版本，保留追溯链。
- 长期记忆只保存来源指针及适用范围；事实冲突回到原记录核查，不能用摘要覆盖原证据。

## 第二个课题

先明确是否独立项目；新建 `05_课题项目_Projects/01_课题简称_Project-Name`，从空白发行模板取得课题文件而非复制已填写的P001。赋新项目ID，公共文献/方法只引用不复制。切换活动课题时显式更新 Path-Map 中的项目专属路径、active_project及vault标记，并更新首页；证据ID不能跨项目重复使用为不同证据。不支持脚本自动多项目切换，变更后运行结构检查。
