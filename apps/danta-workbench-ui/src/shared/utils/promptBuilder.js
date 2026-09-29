import { TASK_GUIDES } from '../constants/workflows.js';

export function makeKickoffPrompt(thought, focus, template = null, logo = null) {
  const taskGuide = TASK_GUIDES[focus];
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
