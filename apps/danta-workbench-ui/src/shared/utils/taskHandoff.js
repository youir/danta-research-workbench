export function getHandoffThreadId(pending, task) {
  if (pending?.handoffThreadId) return pending.handoffThreadId;
  return pending?.taskId && pending.taskId === task?.id ? task.linkedCodexThreadId || '' : '';
}

export function isSameKickoff(current, snapshot) {
  if (!current || !snapshot) return false;
  if (snapshot.id) return current.id === snapshot.id;
  return current.prompt === snapshot.prompt && current.taskId === snapshot.taskId && current.updatedAt === snapshot.updatedAt;
}

export function retainThreadLinks(task, threadId) {
  return { ...task, linkedCodexThreadId: threadId,
    codexThreadIds: [...new Set([...(task.codexThreadIds || []), task.linkedCodexThreadId, threadId].filter(Boolean))], updatedAt: Date.now() };
}

export function describeHandoff(handoff) {
  if (!handoff) return '';
  if (handoff.error) return `${handoff.error} 启动语已保留，可继续重试。`;
  return `${handoff.opened ? '已尝试打开对话' : '窗口未能打开，可再次打开原对话'}；${handoff.copied ? '启动语已复制，进入 Codex 后粘贴并提交' : '启动语尚未复制，请手动复制'}。`;
}
