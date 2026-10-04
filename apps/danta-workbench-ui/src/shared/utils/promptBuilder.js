import { researchStepPrompt } from './researchSteps.js';
import { TASK_GUIDES } from '../constants/workflows.js';
import { getResearchStage, getResearchTaskStatus } from '../constants/researchTasks.js';
import { getUsefulTaskRecords, formatTaskRecord } from './taskRecords.js';

export function makeKickoffPrompt(thought, focus, template = null, logo = null, task = null) {
  const taskGuide = TASK_GUIDES[focus];
  const stage = task ? getResearchStage(task.stageId) : null;
  const status = task ? getResearchTaskStatus(task.statusId) : null;
  const records = task ? getUsefulTaskRecords(task) : [];
  const lastArchive = task?.archiveLinks?.at(-1);
  const pptChoices = task?.workflowId === 'ppt'
    ? Object.entries({ 汇报形式: task.pptPromptChoices?.format, 汇报目的: task.pptPromptChoices?.purpose, 主要听众: task.pptPromptChoices?.audience, 预计时长: task.pptPromptChoices?.duration }).filter(([, value]) => value)
    : [];
  const taskContext = task ? [
    '',
    '【本机研究任务卡】',
    `任务编号：${task.id}`,
    ...(task.parentTaskId ? [`关联任务编号：${task.parentTaskId}`] : []),
    `任务名称：${task.title || focus}`,
    `当前阶段：${stage.label}（${stage.help}）`,
    `任务状态：${status.label}`,
    ...(task.objective ? [`本次目标：${task.objective}`] : []),
    ...(task.nextStep ? [`上次记录的下一步：${task.nextStep}`] : []),
    ...(task.openQuestions ? [`待确认问题：${task.openQuestions}`] : []),
    ...(pptChoices.length ? [`本次汇报设置：${pptChoices.map(([label, value]) => `${label}：${value}`).join('；')}`] : []),
    ...(task.files?.length ? [`工作台记录的关联文件名：${task.files.join('、')}（工作台只记录了文件名，没有读取文件内容；请核对既有有效授权及实际提供的材料后再使用）`] : []),
    ...(records.length ? ['成果与来源索引：', ...records.map(formatTaskRecord), '这些索引来自工作台填写内容，原文件尚未由工作台读取；请沿用既有有效授权、按本次任务范围定位资料，记录实际读取范围和未能访问的位置。'] : []),
    ...(lastArchive ? [`上次阶段记录：知识库“${lastArchive.vaultName || '未注明'}”中的 ${lastArchive.path}（路径是索引，不代表当前工作区已连接同一知识库）`] : []),
    '任务阶段与状态由龚博士手动维护，只是工作进度摘要，不构成实验、数据或结论的验证凭证。请接续当前阶段，明确哪些信息来自已提供材料、哪些仍待核实；不要把计划写成已完成结果。',
    '交付时给出实际产物路径、版本、依据或来源位置、未完成项和下一步，便于回到工作台接续。任务未完成也可以保留阶段记录，无须为归档另设本人审核环节；科研结论仍应保留其证据状态。',
  ] : [];
  const logoInstructions = focus !== '科研 PPT'
    ? []
    : logo?.id === 'custom'
      ? [
          '',
          '单位 Logo：龚博士将另行提供其他院校或课题组的标识。请在 Codex 对话中先取得获授权的原始透明底 PNG/SVG；取得文件前保留标识位，不猜测学校、不描摹或代画 Logo。',
        ]
      : logo?.id === 'none'
        ? ['', '单位 Logo：暂不添加任何院校或课题组标识，保持通用模板，不推断汇报单位。']
        : logo
          ? [
              '',
              `单位 Logo：${logo.title}`,
              `Logo 文件：${logo.assetPath}`,
              '请直接使用这份原始透明底 PNG，优先替换模板预留的单位标识位；保持原始比例、颜色和留白，不拉伸、不改色、不重绘，也不要混入其他学校标识。',
            ]
          : [
              '',
              '单位 Logo：尚未选择。制作前请先问龚博士本次汇报的实际归属及是否需要 Logo。可选工作台内置的海军军医大学、复旦大学上海医学院，也可由龚博士在 Codex 对话中提供获授权的透明底 PNG/SVG；确认前保留空白，不自动加入或虚构学校标识。',
            ];
  return [
    '使用 $danta-proposal-guide，称呼我龚博士。',
    `本次方向：${focus}。`,
    taskGuide || '先陪我把问题想清楚：复述重点，区分已有事实、可能解释和待核实之处。',
    '先理解我的目标和已有材料，再决定是提问、梳理还是直接动手；研究判断由我和导师作出。',
    ...taskContext,
    ...researchStepPrompt(task),
    ...logoInstructions,
    ...(template ? [
      '',
      `组会 PPT 模板：${template.title}`,
      `模板文件：${template.assetPath}`,
      '请先查看这份可编辑 PPTX，沿用其中的版式和视觉组件制作；模板只规定呈现方式，内容只使用我提供或授权的真实研究材料。',
    ] : []),
    '',
    `我现在想讨论：${thought.trim()}`,
  ].join('\n');
}
