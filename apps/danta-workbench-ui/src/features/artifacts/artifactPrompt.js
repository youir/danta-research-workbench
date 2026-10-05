import { researchStepPrompt } from '../../shared/utils/researchSteps.js';

export function localOutputPath(root, relative) { return `${root.replace(/[/\\]+$/, '')}/${relative}`; }

export function artifactDeliveryPrompt(task, connection) {
  if (!task || !connection?.connected) return '';
  const output = localOutputPath(connection.root, task.id);
  return [
    '', '【成果交付与工作台预览】',
    `本任务输出目录：${output}`,
    '先核对并沿用已有有效文件写入授权；仅首次或扩大范围时确认，获得授权后，将本任务成果保存在以上目录；未获权限时说明缺口，不宣称已保存。不要扫描其他研究目录。',
    '保留可编辑原件；PPTX、DOCX 同时输出同版本 PDF，SVG 可另附 PNG。不要覆盖旧版本，不虚构预览已生成。',
    '完成保存后更新目录内 danta-artifacts.json，保留旧成果项。清单格式如下（占位符须替换为真实值）：',
    JSON.stringify({ schemaVersion: 1, taskId: task.id, artifacts: [{ id: 'result-01', title: '实际成果名称', version: 'v1', original: '实际原件文件名.pptx', preview: '同版本预览.pdf', provenance: '' }] }, null, 2),
    'original、preview 是相对于本任务目录的普通文件路径，不允许 ../、绝对路径、隐藏文件或符号链接。id 与 version 的组合唯一；新版本新增一项。没有预览件则 preview 留空，勿引用旧版预览。先保存文件，最后完整更新清单。清单仅登记实际产物，不代表科学结论已验证。',
    '真实执行生信/统计分析时，按主引导 references/bioinformatics-delivery.md 同时保存本版本的来源 JSON，并将 provenance 填为该文件的相对路径。记录真实运行编号、输入索引、方法、命令/脚本、参数、环境、日志、时间、退出码、原件 SHA-256 与核查范围；不写密钥、个人敏感标识，不把方案或历史未知登记为成功运行。未执行分析或无法核实历史记录时 provenance 可留空，不影响交付预览。',
  ].join('\n');
}

export function artifactRevisionPrompt(task, artifact, view, connection) {
  const page = view.feedbackPage || view.page || 1;
  return [
    '使用 $danta-proposal-guide，接续当前任务的研究上下文。',
    `任务编号：${task.id}；任务名称：${task.title}。`,
    `本次修改成果：${artifact.title}；版本：${artifact.version}。`,
    `原件位置：${localOutputPath(connection.root, artifact.original)}`,
    ...(artifact.preview ? [`预览件位置：${localOutputPath(connection.root, artifact.preview)}`] : []),
    `反馈定位：${artifact.ext === '.pdf' ? `第 ${page} 页（以预览件为准）` : '当前成果文件'}。`,
    `龚博士的修改意见：\n${view.feedback || '请为这份原件生成同版本 PDF 或图片预览，不改动研究内容。'}`,
    '以这份实际原件为基础制作新版本；保留真实科学关系、数据和来源，不补造实验或结论。保留旧版，交付新版原件及相同版本预览。',
    ...researchStepPrompt(task),
    artifactDeliveryPrompt(task, connection),
  ].join('\n');
}
