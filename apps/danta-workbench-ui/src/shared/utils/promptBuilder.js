import { TASK_GUIDES } from '../constants/workflows.js';

export function makeKickoffPrompt(thought, focus) {
  const taskGuide = TASK_GUIDES[focus];
  return [
    '使用 $danta-proposal-guide,称呼我龚博士。',
    `本次方向:${focus}。`,
    taskGuide || '先陪我把问题想清楚:复述重点,区分已有事实、可能解释和待核实之处。',
    '先理解我的目标和已有材料,再决定是提问、梳理还是直接动手;研究判断由我和导师作出。',
    '',
    `我现在想讨论:${thought.trim()}`,
  ].join('\n');
}

export function getStartActionLabel(focus) {
  const labels = {
    '自由讨论': '开始梳理',
    '选题思路': '开始梳理选题',
    '论文写作': '准备写作启动语',
    '科研 PPT': '准备 PPT 启动语',
    '科研机制图': '准备机制图启动语',
    '组会工作': '准备组会启动语',
    '生物科研日报': '准备日报启动语',
  };
  return labels[focus] || '开始梳理';
}
