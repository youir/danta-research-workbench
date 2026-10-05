import { MECHANISM_WORKFLOW, PROMPT_STARTERS } from './workflows.js';

export const RESEARCH_STAGES = [
  { id: 'question', label: '问题界定', help: '明确观察、研究问题与本次希望回答的判断。' },
  { id: 'evidence', label: '文献与证据', help: '整理来源、证据强弱、争议和仍需核实的内容。' },
  { id: 'design', label: '假说与设计', help: '比较解释、研究设计、对照、终点和可行条件。' },
  { id: 'execution', label: '实验或数据', help: '记录实际完成的实验、数据获取或分析准备。' },
  { id: 'analysis', label: '分析与解释', help: '区分观察结果、分析结果、解释和局限。' },
  { id: 'communication', label: '写作与汇报', help: '面向论文、组会或其他交流整理材料。' },
  { id: 'review', label: '整理与归档', help: '整理阶段成果、来源和下一步，保留可接续的记录。' },
];

export const RESEARCH_TASK_STATUSES = [
  { id: 'in_progress', label: '进行中' },
  { id: 'waiting_input', label: '等待补充' },
  { id: 'review', label: '待整理' },
  { id: 'complete', label: '已完成' },
];

const DEFAULT_STAGE_BY_WORKFLOW = {
  topic: 'question',
  writing: 'communication',
  ppt: 'communication',
  meeting: 'communication',
  briefing: 'evidence',
  mechanism: 'design',
};

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `research-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createResearchTask(workflow, overrides = {}) {
  const now = Date.now();
  return {
    schemaVersion: 1,
    id: overrides.id || makeId(),
    workflowId: workflow.id,
    parentTaskId: overrides.parentTaskId || '',
    focus: workflow.focus,
    title: overrides.title || `${workflow.label} · 新任务`,
    stageId: overrides.stageId || DEFAULT_STAGE_BY_WORKFLOW[workflow.id] || 'question',
    statusId: overrides.statusId || 'in_progress',
    objective: overrides.objective || '',
    content: overrides.content ?? workflow.seed,
    openQuestions: overrides.openQuestions || '',
    nextStep: overrides.nextStep || '',
    files: Array.isArray(overrides.files) ? overrides.files : [],
    records: Array.isArray(overrides.records) ? overrides.records : [],
    literatureIds: Array.isArray(overrides.literatureIds) ? [...overrides.literatureIds] : [],
    steps: Array.isArray(overrides.steps) ? overrides.steps : [],
    activeStepKey: overrides.activeStepKey || '',
    archiveLinks: Array.isArray(overrides.archiveLinks) ? overrides.archiveLinks : [],
    selectedPptTemplate: overrides.selectedPptTemplate || null,
    selectedPptLogo: overrides.selectedPptLogo || null,
    pptPromptChoices: overrides.pptPromptChoices || { format: '', purpose: '', audience: '', duration: '' },
    meetingMode: overrides.meetingMode || 'prepare',
    linkedCodexThreadId: overrides.linkedCodexThreadId || '',
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
  };
}

export function migrateLegacyResearchTasks({ drafts = {}, filesByWorkflow = {}, selectedPptTemplate = null, selectedPptLogo = null, pptPromptChoices = {}, mechanismBrief = MECHANISM_WORKFLOW.seed, lastCheckpoint = null } = {}) {
  const tasks = PROMPT_STARTERS.flatMap(workflow => {
    const content = drafts[workflow.id] || workflow.seed;
    const hasFiles = Boolean(filesByWorkflow[workflow.id]?.length);
    const hasPptChoices = workflow.id === 'ppt' && Object.values(pptPromptChoices || {}).some(Boolean);
    const hasPptSelection = workflow.id === 'ppt' && Boolean(selectedPptTemplate || selectedPptLogo);
    const hasUserContent = String(content).trim() !== String(workflow.seed).trim();
    if (!hasUserContent && !hasFiles && !hasPptChoices && !hasPptSelection) return [];

    const checkpointAt = lastCheckpoint?.page === workflow.id ? lastCheckpoint.updatedAt : 0;
    return [createResearchTask(workflow, {
      title: `${workflow.label} · 已恢复草稿`,
      content,
      files: filesByWorkflow[workflow.id] || [],
      selectedPptTemplate: workflow.id === 'ppt' ? selectedPptTemplate : null,
      selectedPptLogo: workflow.id === 'ppt' ? selectedPptLogo : null,
      pptPromptChoices: workflow.id === 'ppt' ? pptPromptChoices : undefined,
      updatedAt: checkpointAt || undefined,
      createdAt: checkpointAt || undefined,
    })];
  });
  if (String(mechanismBrief).trim() !== MECHANISM_WORKFLOW.seed.trim()) {
    const checkpointAt = lastCheckpoint?.page === 'mechanism' ? lastCheckpoint.updatedAt : 0;
    tasks.push(createResearchTask(MECHANISM_WORKFLOW, {
      title: '科研机制图 · 已恢复草稿',
      content: mechanismBrief,
      updatedAt: checkpointAt || undefined,
      createdAt: checkpointAt || undefined,
    }));
  }
  return tasks.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getResearchStage(id) {
  return RESEARCH_STAGES.find(stage => stage.id === id) || RESEARCH_STAGES[0];
}

export function getResearchTaskStatus(id) {
  return RESEARCH_TASK_STATUSES.find(status => status.id === id) || RESEARCH_TASK_STATUSES[0];
}
