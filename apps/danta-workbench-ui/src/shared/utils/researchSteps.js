export const STEP_LIMIT = 100;
export const STEP_STATUSES = { planned: '待开始', in_progress: '进行中', waiting_input: '等待材料', complete: '本步完成' };

export function createResearchStep(title, goal) {
  return { key: crypto.randomUUID(), title: title.trim().slice(0, 100), goal: goal.trim().slice(0, 240), status: 'planned', nextAction: '', createdAt: Date.now() };
}

export function currentResearchStep(task) {
  return task?.steps?.find(step => step.key === task.activeStepKey) || null;
}

// Disk fields are refreshed only by an exact task/key match; absent records remain drafts.
export function mergeResearchSteps(local = [], remote = []) {
  const keys = new Set(local.map(step => step.key));
  const merged = [...local.map(step => {
    const actual = remote.find(item => item.key === step.key);
    return actual ? { ...step, ...actual } : { ...step, available: false };
  }), ...remote.filter(step => !keys.has(step.key)).map(step => ({ ...step }))];
  if (merged.length > STEP_LIMIT) throw new Error('本机草稿与知识库步骤合计超过 100 条，请拆分任务再同步；原记录已保留。');
  return merged;
}

export function researchStepPrompt(task) {
  const step = currentResearchStep(task);
  if (!step) return [];
  return [
    '', '【当前实际研究步骤】',
    `工作台步骤键：${step.key}`, `步骤名称：${step.title}`, `步骤目标：${step.goal}`,
    ...(step.vaultPath ? [`上次核对的知识库路径：${step.vaultPath}（须在本机核对仍为本人指定库）`] : []),
    ...(step.directory && !step.available ? ['上次的步骤记录当前未核对到；先定位原记录，不直接复制或建立新步骤。'] : []),
    ...(step.projectId ? [`所属课题：${step.projectId}`] : []),
    ...(step.directory ? [`知识库内步骤路径：${step.directory}（相对已核对的知识库，不能套到其他库）`] : []),
    ...(step.nextAction ? [`步骤下一步：${step.nextAction}`] : []),
    '先核对唯一私有知识库、活动课题及既有有效授权。已有步骤属于另一课题时，先定位原课题，不在新活动课题复制同一步。',
    `读取主技能 references/research-step-workspace.md。实质工作开始时，用 create_research_step.py 的 --task-id ${task.id} --step-key ${step.key} ${step.projectId ? ` --project-id ${step.projectId}` : ''} 建立或恢复本步骤；标题/目标取上面的真实内容，--workspace 用核对后的本机知识库路径。不要因重试或改标题产生重复步骤。`,
    '工作台里的步骤草稿不代表文件已创建或分析已运行。过程记录按实际动作填写；更新 00_步骤卡.md 的 status、next_action 和 updated 字段；完成时只将本步标为 complete，不自动将整个研究任务标为完成。',
    '成果采用下方指定的原成果目录，并在步骤的产出索引中记录原件位置、版本和来源。保留原始资料与唯一状态/证据/决策记录，只链接，不建立第二份权威记录。',
  ];
}

export function validResearchSteps(task) {
  if (task.stepDraft != null && (typeof task.stepDraft !== 'object' || typeof task.stepDraft.title !== 'string' || typeof task.stepDraft.goal !== 'string' || task.stepDraft.title.length > 100 || task.stepDraft.goal.length > 240)) return false;
  if (task.steps === undefined) return task.activeStepKey === undefined || task.activeStepKey === '';
  if (!Array.isArray(task.steps) || task.steps.length > STEP_LIMIT) return false;
  const keys = new Set();
  for (const step of task.steps) {
    if (!step || typeof step !== 'object' || typeof step.key !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(step.key) || keys.has(step.key)
      || typeof step.title !== 'string' || step.title.length > 240 || typeof step.goal !== 'string' || step.goal.length > 1000
      || !Object.hasOwn(STEP_STATUSES, step.status) || ['directory', 'projectId', 'stepId', 'nextAction'].some(field => step[field] !== undefined && typeof step[field] !== 'string')) return false;
    keys.add(step.key);
  }
  return !task.activeStepKey || (typeof task.activeStepKey === 'string' && keys.has(task.activeStepKey));
}
