import { useEffect, useMemo } from 'react';
import { usePersistentState } from '../../../shared/hooks/usePersistentState.js';
import { createResearchTask, migrateLegacyResearchTasks } from '../../../shared/constants/researchTasks.js';
import { createTaskRecord, TASK_RECORD_FIELDS, TASK_RECORD_LIMIT } from '../../../shared/utils/taskRecords.js';
import { retainThreadLinks } from '../../../shared/utils/taskHandoff.js';

/** Owns the workbench's local task cards and their legacy-draft migration. */
export function useResearchTasks({
  drafts,
  filesByWorkflow,
  selectedPptTemplate,
  selectedPptLogo,
  pptPromptChoices,
  mechanismBrief,
  lastCheckpoint,
}) {
  const [tasks, setTasks] = usePersistentState('researchTasks', []);
  const [migrated, setMigrated] = usePersistentState('researchTasksMigratedV1', false);
  const [activeTaskId, setActiveTaskId] = usePersistentState('activeResearchTaskId', '');

  useEffect(() => {
    if (migrated) return;
    if (!tasks.length) {
      const legacyTasks = migrateLegacyResearchTasks({
        drafts,
        filesByWorkflow,
        selectedPptTemplate,
        selectedPptLogo,
        pptPromptChoices,
        mechanismBrief,
        lastCheckpoint,
      });
      if (legacyTasks.length) {
        setTasks(legacyTasks);
        if (!activeTaskId) setActiveTaskId(legacyTasks[0].id);
      }
    }
    setMigrated(true);
  }, [
    migrated, tasks.length, drafts, filesByWorkflow, selectedPptTemplate,
    selectedPptLogo, pptPromptChoices, mechanismBrief, lastCheckpoint,
    activeTaskId, setTasks, setActiveTaskId, setMigrated,
  ]);

  const activeTask = useMemo(() => tasks.find(task => task.id === activeTaskId) || null, [tasks, activeTaskId]);
  const recentTasks = useMemo(() => [...tasks].sort((a, b) => b.updatedAt - a.updatedAt), [tasks]);

  function createTask(workflow, overrides = {}) {
    const task = createResearchTask(workflow, overrides);
    setMigrated(true);
    setTasks(current => [task, ...current]);
    setActiveTaskId(task.id);
    return task;
  }

  function updateTask(taskId, field, value) {
    if (!taskId) return;
    setTasks(current => current.map(task => task.id === taskId
      ? { ...task, [field]: value, updatedAt: Date.now() }
      : task));
  }

  function patchTask(taskId, patch) {
    if (!taskId) return;
    setTasks(current => {
      let changed = false;
      const next = current.map(task => {
        if (task.id !== taskId) return task;
        const update = typeof patch === 'function' ? patch(task) : patch;
        if (!update) return task;
        changed = true;
        return { ...task, ...update, updatedAt: Date.now() };
      });
      return changed ? next : current;
    });
  }

  function addTaskFiles(taskId, fileNames) {
    if (!taskId || !fileNames.length) return;
    setTasks(current => current.map(task => task.id === taskId
      ? { ...task, files: [...new Set([...(task.files || []), ...fileNames])], updatedAt: Date.now() }
      : task));
  }

  function removeTaskFile(taskId, fileName) {
    if (!taskId) return;
    setTasks(current => current.map(task => task.id === taskId
      ? { ...task, files: (task.files || []).filter(file => file !== fileName), updatedAt: Date.now() }
      : task));
  }

  function linkCodexThread(taskId, threadId) {
    if (!taskId || !threadId) return;
    setTasks(current => current.map(task => task.id === taskId ? retainThreadLinks(task, threadId) : task));
  }

  function addTaskRecord(taskId) {
    const record = createTaskRecord();
    setTasks(current => current.map(task => task.id === taskId && (task.records || []).length < TASK_RECORD_LIMIT
      ? { ...task, records: [...(task.records || []), record], updatedAt: Date.now() }
      : task));
  }

  function updateTaskRecord(taskId, recordId, field, value) {
    if (!TASK_RECORD_FIELDS.includes(field)) return;
    setTasks(current => current.map(task => task.id === taskId
      ? { ...task, records: (task.records || []).map(record => record.id === recordId ? { ...record, [field]: value, updatedAt: Date.now() } : record), updatedAt: Date.now() }
      : task));
  }

  function removeTaskRecord(taskId, recordId) {
    setTasks(current => current.map(task => task.id === taskId
      ? { ...task, records: (task.records || []).filter(record => record.id !== recordId), updatedAt: Date.now() }
      : task));
  }

  function recordTaskArchive(taskId, archive) {
    setTasks(current => current.map(task => task.id === taskId
      ? { ...task, archiveLinks: [...(task.archiveLinks || []), archive], updatedAt: Date.now() }
      : task));
  }

  function mergeTaskCards(importedTasks) {
    setMigrated(true);
    setTasks(current => {
      const existing = new Set(current.map(task => task.id));
      return [...current, ...importedTasks.filter(task => !existing.has(task.id))];
    });
  }

  return {
    tasks,
    recentTasks,
    activeTask,
    activeTaskId,
    setActiveTaskId,
    createTask,
    updateTask,
    patchTask,
    addTaskFiles,
    removeTaskFile,
    linkCodexThread,
    addTaskRecord,
    updateTaskRecord,
    removeTaskRecord,
    recordTaskArchive,
    mergeTaskCards,
  };
}
