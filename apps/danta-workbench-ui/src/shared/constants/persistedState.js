import { validResearchSteps } from '../utils/researchSteps.js';
import { validLiteratureCards, validLiteratureLinks } from '../utils/literatureCards.js';

export const STORAGE_PREFIX = 'danta-workbench:v2:';
export const MAX_STATE_BYTES = 12 * 1024 * 1024;
// Application state only. Vault grants and credentials have separate stores.
export const PERSISTED_STATE_KEYS = [
  'activePage', 'pageHistory', 'homeThought', 'workflowDrafts', 'taskFocus',
  'mechanismBrief', 'selectedPptTemplate', 'selectedPptLogo', 'pptPromptChoices',
  'filesByWorkflow', 'pendingKickoff', 'defaultCodexProjectId', 'lastCheckpoint',
  'showMechanismProcess', 'kickoffModalOpen', 'settingsSection', 'researchTasks',
  'researchTasksMigratedV1', 'activeResearchTaskId', 'archiveDraft',
  'selectedDailyBriefId', 'dailyBriefAutomationTime', 'literatureFilter',
  'literatureSearch', 'linkedDiscoveriesPmid',
  'literatureCards', 'selectedLiteratureId', 'literatureView', 'literatureTargetTaskId',
  'literatureDraft', 'readingSearch',
];

export function validateStateValues(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('工作台状态格式无效。');
  const allowed = new Set(PERSISTED_STATE_KEYS);
  const checked = {};
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key) || typeof value !== 'string') throw new Error('工作台状态包含不支持的字段。');
    let parsed;
    try { parsed = JSON.parse(value); } catch { throw new Error('工作台状态包含无法读取的内容。'); }
    const arrayKeys = ['researchTasks', 'pageHistory', 'literatureCards'];
    const booleanKeys = ['researchTasksMigratedV1', 'showMechanismProcess', 'kickoffModalOpen'];
    const objectKeys = ['workflowDrafts', 'pptPromptChoices', 'filesByWorkflow', 'archiveDraft', 'literatureDraft'];
    const nullableKeys = ['selectedPptTemplate', 'selectedPptLogo', 'pendingKickoff', 'lastCheckpoint'];
    const isObject = item => item !== null && typeof item === 'object' && !Array.isArray(item);
    const valid = arrayKeys.includes(key) ? Array.isArray(parsed)
      : booleanKeys.includes(key) ? typeof parsed === 'boolean'
        : objectKeys.includes(key) ? isObject(parsed)
          : nullableKeys.includes(key) ? parsed === null || isObject(parsed) : typeof parsed === 'string';
    if (!valid) throw new Error('工作台状态的字段类型不匹配。');
    if (key === 'literatureCards' && !validLiteratureCards(parsed)) throw new Error('阅读卡状态无法读取，原备份已保留。');
    if (key === 'literatureDraft' && (typeof parsed.title !== 'string' || parsed.title.length > 300 || typeof parsed.identifier !== 'string' || parsed.identifier.length > 1600)) throw new Error('文献线索草稿格式无效。');
    if (key === 'researchTasks' && parsed.some(task => !isObject(task) || typeof task.id !== 'string' || typeof task.workflowId !== 'string' || typeof task.content !== 'string' || typeof task.title !== 'string' || !validResearchSteps(task) || !validLiteratureLinks(task)
      || ['files', 'records', 'archiveLinks', 'codexThreadIds'].some(field => task[field] !== undefined && !Array.isArray(task[field])))) throw new Error('任务卡状态无法读取。');
    checked[key] = value;
  }
  if (new TextEncoder().encode(JSON.stringify(checked)).length > MAX_STATE_BYTES) throw new Error('工作台状态超过 12 MB，请导出并整理任务。');
  return checked;
}
