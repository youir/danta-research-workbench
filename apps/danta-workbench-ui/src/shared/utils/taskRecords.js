import { getResearchStage, getResearchTaskStatus } from '../constants/researchTasks.js';
import { MECHANISM_WORKFLOW, PROMPT_STARTERS } from '../constants/workflows.js';

export const TASK_RECORD_KINDS = [
  { id: 'source', label: '文献或来源线索' },
  { id: 'analysis', label: '实验或分析记录' },
  { id: 'presentation', label: 'PPT 或科研图' },
  { id: 'manuscript', label: '论文稿件' },
  { id: 'note', label: '其他阶段记录' },
];

export const TASK_RECORD_LIMIT = 30;
export const TASK_RECORD_FIELDS = ['title', 'kind', 'location', 'source', 'version', 'note'];

export function createTaskRecord() {
  return {
    id: crypto.randomUUID(),
    kind: 'note',
    title: '',
    location: '',
    source: '',
    version: '',
    note: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function getUsefulTaskRecords(task) {
  return (task.records || []).filter(record =>
    ['title', 'location', 'source', 'version', 'note'].some(field => String(record[field] || '').trim()));
}

export function formatTaskRecord(record, index) {
  const kind = TASK_RECORD_KINDS.find(item => item.id === record.kind)?.label || '阶段记录';
  return [
    `${index + 1}. ${record.title || '未命名记录'}（${kind}）`,
    ...(record.location ? [`   文件位置或链接：${record.location}`] : []),
    ...(record.version ? [`   版本：${record.version}`] : []),
    ...(record.source ? [`   来源与定位：${record.source}`] : []),
    ...(record.note ? [`   记录与未决问题：${record.note}`] : []),
  ].join('\n');
}

export function makeRelatedTaskContext(parent, workflow) {
  const parentWorkflow = [MECHANISM_WORKFLOW, ...PROMPT_STARTERS].find(item => item.id === parent.workflowId);
  const parentContent = String(parent.content || '').trim();
  return {
    parentTaskId: parent.id,
    title: `${workflow.label} · ${parent.title || parent.focus}`.slice(0, 100),
    content: [workflow.seed, '', '【前序任务背景】', `关联任务：${parent.title || parent.focus}`,
      ...(parentContent && parentContent !== String(parentWorkflow?.seed || '').trim() ? [parentContent] : []),
      ...(parent.openQuestions ? [`前序待解决问题：${parent.openQuestions}`] : []),
    ].join('\n'),
    files: [...(parent.files || [])],
    records: getUsefulTaskRecords(parent).map(record => ({ ...record })),
  };
}

export function buildTaskArchiveDraft(task) {
  const stage = getResearchStage(task.stageId);
  const workflow = [MECHANISM_WORKFLOW, ...PROMPT_STARTERS].find(item => item.id === task.workflowId);
  const content = String(task.content || '').trim();
  const records = getUsefulTaskRecords(task);
  const body = [
    '> 本机研究任务的阶段快照。记录进度、成果索引和未决问题；文件内容与科研结论以原始材料为准。',
    '',
    `任务编号：${task.id}`,
    ...(task.parentTaskId ? [`关联任务编号：${task.parentTaskId}`] : []),
    `工作类型：${workflow?.label || task.focus || '研究任务'}`,
    `当前阶段：${stage.label}`,
    `进度状态：${getResearchTaskStatus(task.statusId).label}`,
    ...(task.objective ? [`本次目标：${task.objective}`] : []),
    ...(task.linkedCodexThreadId ? [`Codex 对话编号：${task.linkedCodexThreadId}`] : []),
    '',
    ...(content && content !== String(workflow?.seed || '').trim() ? ['## 任务内容', '', content, ''] : []),
    ...(task.nextStep ? ['## 下一步', '', task.nextStep, ''] : []),
    ...(task.openQuestions ? ['## 待解决问题', '', task.openQuestions, ''] : []),
    ...(records.length ? ['## 成果与来源索引', '', ...records.map(formatTaskRecord), ''] : []),
    ...(task.files?.length ? ['## 关联文件名', '', ...task.files.map(name => `- ${name}`), '', '本快照仅记录文件名，没有复制或读取附件内容。', ''] : []),
    ...(task.selectedPptTemplate ? [`汇报模板：${task.selectedPptTemplate.title}`, `模板位置：${task.selectedPptTemplate.assetPath || '未注明'}`] : []),
    ...(task.selectedPptLogo ? [`单位标识：${task.selectedPptLogo.title || task.selectedPptLogo.id}`] : []),
    ...(task.workflowId === 'ppt' ? Object.entries({ 汇报形式: task.pptPromptChoices?.format, 汇报目的: task.pptPromptChoices?.purpose, 主要听众: task.pptPromptChoices?.audience, 预计时长: task.pptPromptChoices?.duration }).filter(([, value]) => value).map(([label, value]) => `${label}：${value}`) : []),
  ].join('\n');
  const draft = { title: `${task.title || task.focus || '研究任务'} · ${stage.label}`, category: '研究任务阶段快照', body };
  if (body.length > 60_000 || new TextEncoder().encode(JSON.stringify(draft)).length > 96 * 1024) {
    throw new Error('阶段记录过长，请拆分内容后再保存；文件位置和来源索引可以保留，正文可分次归档。');
  }
  return draft;
}
