import { validResearchSteps } from './researchSteps.js';
import { validLiteratureCards, validLiteratureLinks } from './literatureCards.js';

const BACKUP_KIND = 'danta-research-task-backup';
const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 12 * 1024 * 1024;

export function makeTaskBackup({ tasks = [], activeTaskId = '', pendingKickoff = null, homeThought = '', literatureCards = [], selectedLiteratureId = '' }) {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tasks,
    activeTaskId,
    pendingKickoff,
    homeThought,
    literatureCards,
    selectedLiteratureId,
  };
}

export function parseTaskBackup(text) {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('备份超过 12 MB，请检查所选文件。');
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error('文件不是有效的 JSON 备份。'); }
  if (backup?.kind !== BACKUP_KIND || backup.version !== BACKUP_VERSION || !Array.isArray(backup.tasks)) {
    throw new Error('这不是当前工作台支持的任务备份。');
  }
  if (backup.tasks.length > 500) throw new Error('备份中的任务数量异常，请检查文件。');
  if (!validLiteratureCards(backup.literatureCards === undefined ? [] : backup.literatureCards)) throw new Error('备份中的阅读卡格式无效，未导入任何内容。');
  const ids = new Set();
  for (const task of backup.tasks) {
    if (!task || typeof task !== 'object' || task.schemaVersion !== 1 ||
      typeof task.id !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(task.id) ||
      typeof task.workflowId !== 'string' || typeof task.title !== 'string' ||
      typeof task.content !== 'string' || !Array.isArray(task.files) ||
      !Array.isArray(task.records) || !Array.isArray(task.archiveLinks) || !validResearchSteps(task) || !validLiteratureLinks(task) || ids.has(task.id)) {
      throw new Error('备份中的任务格式不完整或编号重复，未导入任何内容。');
    }
    ids.add(task.id);
  }
  return {
    tasks: backup.tasks,
    activeTaskId: typeof backup.activeTaskId === 'string' ? backup.activeTaskId : '',
    pendingKickoff: backup.pendingKickoff && typeof backup.pendingKickoff === 'object' ? backup.pendingKickoff : null,
    homeThought: typeof backup.homeThought === 'string' ? backup.homeThought : '',
    literatureCards: backup.literatureCards === undefined ? [] : backup.literatureCards,
    selectedLiteratureId: typeof backup.selectedLiteratureId === 'string' ? backup.selectedLiteratureId : '',
  };
}
