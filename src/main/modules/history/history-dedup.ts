import crypto from 'crypto';
import type {
  AppFile,
  FileOperation,
  HistoryEntry,
  Workflow,
  WorkflowResult
} from '../../../shared/types';
import { HISTORY_CONFIG } from './history-config';

export type RecentExecutionMap = Map<string, number>;

/**
 * 生成工作流执行的内容哈希，用于重复检测。
 */
export function generateExecutionHash(
  workflowResult: WorkflowResult,
  workflow: Workflow,
  originalFiles: AppFile[]
): string {
  const content = {
    workflowId: workflow.id,
    workflowName: workflow.name,
    fileCount: originalFiles.length,
    filePaths: originalFiles.map(f => f.path).sort(),
    stepCount: workflowResult.stepResults.length,
    stepIds: workflowResult.stepResults.map(s => s.stepId).sort()
  };

  return crypto.createHash('md5').update(JSON.stringify(content)).digest('hex');
}

/**
 * 检查工作流执行是否重复，并更新最近执行记录。
 */
export function isDuplicateExecution(
  executionHash: string,
  timestamp: string,
  recentExecutions: RecentExecutionMap
): boolean {
  const now = Date.now();
  const executionTime = new Date(timestamp).getTime();

  for (const [hash, time] of recentExecutions.entries()) {
    if (now - time > HISTORY_CONFIG.DUPLICATE_CHECK_WINDOW) {
      recentExecutions.delete(hash);
    }
  }

  const lastExecution = recentExecutions.get(executionHash);
  if (lastExecution && executionTime - lastExecution < HISTORY_CONFIG.MIN_EXECUTION_INTERVAL) {
    console.warn(`[重复检测] 检测到重复执行，哈希: ${executionHash}, 间隔: ${executionTime - lastExecution}ms`);
    return true;
  }

  recentExecutions.set(executionHash, executionTime);
  return false;
}

/**
 * 检查历史记录中是否存在重复条目。
 */
export function hasDuplicateEntry(newEntry: HistoryEntry, existingHistory: HistoryEntry[]): boolean {
  const newTime = new Date(newEntry.timestamp).getTime();
  const recentEntries = existingHistory.slice(0, 50);

  for (const existingEntry of recentEntries) {
    const existingTime = new Date(existingEntry.timestamp).getTime();

    if (newTime - existingTime > HISTORY_CONFIG.DUPLICATE_CHECK_WINDOW) {
      break;
    }

    if (isSameExecution(newEntry, existingEntry)) {
      return true;
    }
  }

  return false;
}

/**
 * 判断两条历史记录是否为相同执行。
 */
export function isSameExecution(entry1: HistoryEntry, entry2: HistoryEntry): boolean {
  if (
    entry1.workflowId !== entry2.workflowId ||
    entry1.totalFiles !== entry2.totalFiles ||
    entry1.processedFiles !== entry2.processedFiles
  ) {
    return false;
  }

  const time1 = new Date(entry1.timestamp).getTime();
  const time2 = new Date(entry2.timestamp).getTime();
  if (Math.abs(time1 - time2) > HISTORY_CONFIG.MIN_EXECUTION_INTERVAL) {
    return false;
  }

  if (entry1.fileOperations.length !== entry2.fileOperations.length) {
    return false;
  }

  const hash1 = generateFileOperationsHash(entry1.fileOperations);
  const hash2 = generateFileOperationsHash(entry2.fileOperations);

  return hash1 === hash2;
}

/**
 * 生成文件操作的哈希值。
 */
export function generateFileOperationsHash(operations: FileOperation[]): string {
  const content = operations
    .map(op => ({
      operation: op.operation,
      originalPath: op.originalPath,
      newPath: op.newPath,
      status: op.status
    }))
    .sort((a, b) => (a.originalPath || '').localeCompare(b.originalPath || ''));

  return crypto.createHash('md5').update(JSON.stringify(content)).digest('hex');
}
