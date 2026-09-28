# Consensus 与 Semantic Scholar 检索

## 适用场景

用户想快速查看一个研究问题有哪些相关论文、初步浏览不同研究，或扩展关键论文的引用线索时，可以并行检索 Consensus 与 Semantic Scholar。它们用于发现线索；不能替代系统综述的多库检索、筛选、全文核查或原文证据评价。Consensus 的文献元数据来源包含 Semantic Scholar，因此两边重复命中不算独立验证。

仅发送用户本轮明确提供的查询词。不要把论文、病历、未发表数据、研究方案或未公开假说作为查询内容上传。若当前查询会暴露未公开研究计划，先改写为不含项目特征的通用问题，或仅在获准后检索。脚本只接受查询字符串，不读取工作区文件。

## 本地配置

脚本：`scripts/search_literature.py`（相对于本技能目录）。仅使用 Python 标准库。密钥从进程环境变量读取，不接受命令行参数，也不写入检索结果：

- `CONSENSUS_API_KEY`：Consensus API key，使用 `x-api-key` 请求头。
- `SEMANTIC_SCHOLAR_API_KEY`：Semantic Scholar API key，使用 `x-api-key` 请求头。

申请入口：Consensus 的 [API & MCP Dashboard](https://consensus.app/home/api)；Semantic Scholar 的 [API key 申请页](https://www.semanticscholar.org/product/api#api-key-form)。

将密钥配置在运行 Codex 的本机环境中；不要发在聊天、提示词、Markdown、终端命令行参数或 Git 文件里。未配置某一站点密钥时，脚本会标为跳过；配置失败或限流会在该站点状态中如实记录，不自动重试，以免意外消耗额度。

Consensus API 与 MCP 共用月度调用额度。脚本每站仅发出一次请求，默认请求 10 篇，最高 20 篇；不自动翻页。如果账号开启额外用量并耗尽套餐额度，官方当前列出的超额价格为每次调用 0.05 美元；以账号当期计划和 API 仪表板为准。Semantic Scholar 的 API 也可能限流；遵守响应状态和官方服务条款。

## 运行

在工作台根目录运行，或将路径替换为已安装技能目录中的脚本位置：

```bash
python3 skills/danta-proposal-guide/scripts/search_literature.py \
  --query "与本轮明确问题对应的公开学术检索词" \
  --source both \
  --limit 10 \
  --output ".local/literature-search.json"
```

`--source` 可选 `both`、`consensus` 或 `semantic-scholar`。不提供 `--output` 时，结构化 JSON 仅输出到标准输出；指定路径后只在该位置保存一份 JSON 检索结果，不自动修改研究画像、证据矩阵、决策日志或任何 vault 文件。记录会保留查询词、UTC 查询时间、各站成功/失败状态、论文元数据和来源链接，不写入密钥。

## 整理结果

1. 分开保留两个来源的命中数、字段和原始论文链接；缺失字段留空，不补造 DOI、作者、摘要或引用量。
2. DOI 相同可标作疑似同一论文；没有 DOI 时只按标准化标题提示可能重复，并保留两个来源 ID。引用数只显示各数据库自己的值，不合并或用作研究质量替代。
3. 不把搜索摘要直接作为研究结论。对关键论文核对 DOI/PMID、出版状态、全文和方法，记录实际阅读范围及支持/反对/限制的主张。
4. 用户要写入正式检索记录时，按问题、数据库、日期、完整检索词、结果数、输出路径和限制更新 `我的开题/03_文献与证据/检索记录.csv`；只有完成原文核查后才新增逐篇证据记录。

## 官方文档

- [Consensus API](https://help.consensus.app/en/articles/16516328-the-consensus-api)：API key、调用额度和计费规则。
- [Semantic Scholar Academic Graph API](https://api.semanticscholar.org/api-docs)：论文搜索字段、API key 与速率限制。
- [Consensus 数据库说明](https://help.consensus.app/en/articles/10055108-consensus-research-database)：数据库来源包含 Semantic Scholar、OpenAlex、自有采集及出版商合作。
