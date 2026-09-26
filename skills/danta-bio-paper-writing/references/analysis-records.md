# 环境与分析授权记录

这些记录用于区分机器状态、研究者决定和具体执行授权。JSON 是记录模板，不会因创建而表示“已经批准”。

## `r_environment.json`

```json
{
  "checked_at": "",
  "rscript_found": false,
  "r_version": null,
  "rstudio_found": false,
  "project_lockfile": null,
  "check_scope": "仅检测可执行文件与项目配置；未运行分析",
  "notes": ""
}
```

## `backend_decision.json`

```json
{
  "status": "pending_user_choice",
  "question": "",
  "options": [],
  "assistant_recommendation": null,
  "researcher_choice": null,
  "decided_at": null,
  "notes": "建议不等于选择"
}
```

## `analysis_approval.json`

```json
{
  "status": "not_approved",
  "approved_by": null,
  "approved_at": null,
  "data_paths_or_scope": [],
  "analysis_purpose": null,
  "approved_actions": [],
  "output_location": null,
  "external_services_allowed": false,
  "privacy_constraints": [],
  "expires_or_recheck_on_scope_change": true
}
```

## 引文与稿件审批

采用 `citation_preference.json` 记录作者选择的格式与目标期刊，采用 `manuscript_approval.json` 记录稿件范围与获准生成内容。两者仅在论文任务确有需要时创建，不要求她预填固定问卷。决策记录列明来源、确认人和日期；助手建议不能写作用户选择。
