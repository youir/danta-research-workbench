# 学术检索与 PubMed 文献脉络探索

## 适用场景

用户想快速查看一个研究问题有哪些相关论文、初步浏览不同研究，或扩展关键论文的引用线索时，可以并行检索 Consensus 与 Semantic Scholar。它们用于发现线索；不能替代系统综述的多库检索、筛选、全文核查或原文证据评价。Consensus 的文献元数据来源包含 Semantic Scholar，因此两边重复命中不算独立验证。

仅发送用户本轮明确提供的查询词。不要把论文、病历、未发表数据、研究方案或未公开假说作为查询内容上传。若当前查询会暴露未公开研究计划，先改写为不含项目特征的通用问题，或仅在获准后检索。脚本只接受查询字符串，不读取工作区文件。

## Linked Discoveries：从关键 PubMed 论文拓展脉络

找到与本轮问题直接相关的 PubMed 关键论文后，可用 [NLM 的 Linked Discoveries](https://linkeddiscoveries.ncbi.nlm.nih.gov/userguide/) 查看其文献邻域。它是 PubMed 页面里的实验性探索工具，网页使用无需 API key 或本工作台安装脚本；仅以本轮公开检索得到或用户提供的 PMID 为种子，不上传本地研究文件或未公开研究计划。

1. 从 PubMed 摘要页打开 “Linked Discoveries”，查看 graph 和 timeline。优先梳理种子论文引用的早期工作（Cites）与后来引用它的论文（Cited by）；再查看相关 review，以及 article information card 中的 retraction、errata、expression of concern、comments 和 updates。
2. 按需要用 condition、gene、chemical 主题筛选；可将有价值的邻居设为新种子，继续扩展一层。仅在需要批量整理时下载当前可见结果的 CSV，并保留种子 PMID、日期、筛选条件和导出文件。
3. 将候选标记为“种子引用”“后来引用”“语义相关”“综述”或“出版更新”，并保留 PMID/DOI 与 PubMed 链接。把它们送回本工作流的原文核查；工具显示“相关”或存在引文关系，不代表研究结果已重复验证或相互支持。

此工具仍处于试验阶段，结果可能不完整或不准确。只有带摘要的部分 PubMed 记录可作为种子或邻居；文献邻域依据题名、摘要和关键词作语义相似匹配，不读取全文。可见的引文关系也不是完整引文清单。它会展示引用、主题、综述和出版更新等线索，但不评价研究质量，也不判断某项研究是否复现成功。系统综述、查新或重要结论仍需按预设检索式检索相应数据库，并逐篇核对原文与出版状态。详情见 [NLM 用户指南](https://linkeddiscoveries.ncbi.nlm.nih.gov/userguide/) 和 [NIH 发布说明](https://www.nih.gov/news-events/news-releases/nih-launches-new-pubmed-tool-strengthen-research-replication-reproducibility)。

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

## 自动：用 Jev 筛选公开搜索结果

这是工作台的默认后台步骤，不要求龚博士主动提 Jev。检索结果中有 4 条或更多候选、且查询和候选内容可安全外发时，当前客户端若实际提供 Jev MCP（例如 `jev_rerank`、`jev_find`、`jev_screen`、`jev_verify`），主引导或文献负责人自动在召回后重排一次；不足 4 条、单篇指定来源或 Jev 未连接时，跳过并继续原流程。Jev 不是检索源，不替代搜索、阅读全文或主引导综合。

1. 只向 Jev 发送公开问题的通用表述，以及本轮检索返回的公开题名、摘要片段、来源 ID 和链接。剔除姓名、未公开假说、患者/学生资料、实验数据和内部项目特征。若无法安全泛化，跳过 Jev，不要求用户重复授权后再继续本轮检索。
2. 候选不超过 20 篇时，用 `jev_rerank` 按“是否直接回答本轮问题”排序；只需挑最可能的一篇时用 `jev_find`。保留来源 ID 对应关系，并至少检查少量不同研究设计、相反结果或限制条件，不因低相关分数删掉反例。
3. 若结果不足以回答，主引导先提出 2–5 条具体的补充检索词，再让 Jev 从中选择一条；Jev 不生成检索词。最多补搜一轮，避免无休止搜索。
4. 打开并阅读被选中的原始论文页面或全文。Jev 的相关性分数、筛查结果和置信度都不是论文事实、证据质量或引文核验；只引用实际打开并核对过的来源。需要核验报告主张时，可将主张与对应原文片段交给 `jev_verify`，但仍由主引导按研究设计和原文语境复核。
5. 交付仍按日常科研语言说明来源、实际阅读和核验范围，无需让龚博士辨认 Jev 工具名。未连接、超时、输出无效或隐私筛查不通过时，按搜索工具原顺序继续阅读；只有当回退实质影响结果或覆盖范围时，简短说明该限制，不能把故障说成“判断无需补搜”。

Jev 是可选后处理，不是本工作台检索脚本的依赖。连接说明和能力边界见 [Jev 检索接入说明](jev-search-integration.md)。

## 官方文档

- [Consensus API](https://help.consensus.app/en/articles/16516328-the-consensus-api)：API key、调用额度和计费规则。
- [Semantic Scholar Academic Graph API](https://api.semanticscholar.org/api-docs)：论文搜索字段、API key 与速率限制。
- [Consensus 数据库说明](https://help.consensus.app/en/articles/10055108-consensus-research-database)：数据库来源包含 Semantic Scholar、OpenAlex、自有采集及出版商合作。
