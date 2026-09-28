export const PROMPT_STARTERS = [
  {
    id: 'evidence',
    label: '文献证据',
    detail: '检索文献、整理证据、追溯来源'
  },
  {
    id: 'bioinformatics',
    label: '生信数据',
    detail: '查询数据库、分析表达、验证靶点'
  },
  {
    id: 'writing',
    label: '论文写作',
    detail: '起草稿件、修改润色、回复审稿'
  },
  {
    id: 'methods',
    label: '方法统计',
    detail: '设计实验、统计分析、数据可视化'
  },
  {
    id: 'communication',
    label: '组会汇报',
    detail: '生成PPT、准备口头摘要、可视化机制图'
  }
];

export const WORKFLOW_CONFIGS = {
  evidence: {
    title: '文献证据工作流',
    description: '检索相关文献,整理关键证据,追溯数据来源。每条证据都标注出处,不假装核查过。',
    agents: ['文献检索', '证据整理', '来源追溯']
  },
  bioinformatics: {
    title: '生信数据工作流',
    description: '查询生物信息数据库,分析基因表达,验证分子靶点。结果带查询参数,便于复现。',
    agents: ['数据库查询', '表达分析', '靶点验证']
  },
  writing: {
    title: '论文写作工作流',
    description: '起草学术稿件,修改润色文字,回复审稿意见。支持中英文互译和格式调整。',
    agents: ['稿件起草', '语言润色', '审稿回复']
  },
  methods: {
    title: '方法统计工作流',
    description: '设计实验方案,进行统计分析,制作数据可视化图表。',
    agents: ['实验设计', '统计分析', '数据可视化']
  },
  communication: {
    title: '组会汇报工作流',
    description: '生成PPT大纲,准备口头摘要,绘制可编辑的机制图。区分真实数据与计划数据。',
    agents: ['PPT生成', '摘要提炼', '机制图绘制']
  }
};
