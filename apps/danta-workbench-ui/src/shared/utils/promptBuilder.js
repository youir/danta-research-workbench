import { TASK_GUIDES } from '../constants/workflows.js';

export function makeKickoffPrompt(thought, focus, template = null) {
  const taskGuide = TASK_GUIDES[focus];
  return [
    '使用 $danta-proposal-guide，称呼我龚博士。',
    `本次方向：${focus}。`,
    taskGuide || '先陪我把问题想清楚：复述重点，区分已有事实、可能解释和待核实之处。',
    '先理解我的目标和已有材料，再决定是提问、梳理还是直接动手；研究判断由我和导师作出。',
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
