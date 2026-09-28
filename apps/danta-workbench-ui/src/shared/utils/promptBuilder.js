import { TASK_GUIDES } from '../constants/workflows.js';

export function makeKickoffPrompt(thought, focus) {
  const taskGuide = TASK_GUIDES[focus];
  return [
    '使用 $danta-proposal-guide，称呼我龚博士。',
    `本次方向：${focus}。`,
    taskGuide || '先陪我把问题想清楚：复述重点，区分已有事实、可能解释和待核实之处。',
    '先理解我的目标和已有材料，再决定是提问、梳理还是直接动手；研究判断由我和导师作出。',
    '',
    `我现在想讨论：${thought.trim()}`,
  ].join('\n');
}
