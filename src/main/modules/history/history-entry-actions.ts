import type { HistoryEntry } from '../../../shared/types';
import type { WorkflowEngine } from '../workflow-engine';
import type { HistoryStorage } from './history-storage';
import type { HistoryLockManager } from './history-locks';
import type { HistoryRollbackManager } from './history-rollback';
import type { HistoryOperationContext } from './history-operations';
import { preCheckUndoOperations, preCheckRedoOperations, analyzeChainDependencies } from './history-precheck';
import { normalizeOperationPaths } from './history-validation';
import { cleanupCreatedDirectories, restoreCleanedEmptyDirectories } from './history-cleanup';
import {
  performUndoOperations,
  performChainUndoOperations,
  performRedoOperations
} from './history-operations';
import type { UndoOperationOutcome } from './history-operations';

export interface HistoryEntryActionContext {
  storage: HistoryStorage;
  lockManager: HistoryLockManager;
  workflowEngine: WorkflowEngine;
  rollbackManager: HistoryRollbackManager;
  getOperationContext(): HistoryOperationContext;
  updateHistoryEntryStatus(
    entryId: string,
    updates: Partial<Pick<HistoryEntry, 'isUndone' | 'undoTimestamp' | 'canUndo'>>
  ): Promise<void>;
}

export interface UndoActionResult {
  success: boolean;
  message?: string;
  requiresChainUndo?: boolean;
  entryId?: string;
}

export interface ChainUndoActionResult {
  success: boolean;
  message?: string;
}

export interface RedoActionResult {
  success: boolean;
  message?: string;
}

const buildUndoSuccessMessage = (warnings: string[] = []): string => {
  if (!warnings.length) {
    return '撤销操作成功完成';
  }

  return `撤销操作成功完成，但存在以下提示：\n${warnings.join('\n')}`;
};

export async function performUndoEntryAction(
  context: HistoryEntryActionContext,
  entryId: string
): Promise<UndoActionResult> {
  try {
    console.log('开始撤销操作，entryId:', entryId);

    await context.lockManager.acquireHistoryLock();
    let history: HistoryEntry[];
    try {
      history = await context.storage.readHistoryFile();
      console.log('当前历史记录数量:', history.length);
    } finally {
      context.lockManager.releaseHistoryLock();
    }

    const entryIndex = history.findIndex((entry: HistoryEntry) => entry.id === entryId);

    if (entryIndex === -1) {
      return { success: false, message: '历史记录不存在，可能已被删除' };
    }

    const entry = history[entryIndex];
    console.log('找到要撤销的记录:', entry.workflowName);

    if (entry.canUndo === false) {
      return { success: false, message: '此操作被标记为不可撤销' };
    }

    if (entry.isUndone) {
      return { success: false, message: '此操作已经被撤销过了' };
    }

    const entryTime = new Date(entry.timestamp).getTime();
    const now = Date.now();
    const hoursDiff = (now - entryTime) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      const hoursAgo = Math.floor(hoursDiff);
      return {
        success: false,
        message: `操作已过去 ${hoursAgo} 小时，超过24小时时间限制，无法撤销。请手动恢复文件。`
      };
    }

    const preCheckResult = await preCheckUndoOperations(entry.fileOperations, context.workflowEngine);
    if (!preCheckResult.canUndo) {
      const hasChainConflict = preCheckResult.issues.some(issue => issue.includes('[连锁冲突]'));

      if (hasChainConflict) {
        return {
          success: false,
          message: `检测到连锁重命名冲突:\n${preCheckResult.issues.join('\n')}\n\n解决方案：\n1. 使用连锁撤回功能自动处理依赖关系\n2. 手动逐个撤回相关操作\n3. 手动恢复文件位置`,
          requiresChainUndo: true,
          entryId
        };
      }

      const hasPermissionIssues = preCheckResult.issues.some(issue => issue.includes('权限不足'));
      const hasSpaceIssues = preCheckResult.issues.some(issue => issue.includes('磁盘空间'));
      const hasFileIssues = preCheckResult.issues.some(issue => issue.includes('不存在') || issue.includes('已被占用'));

      let suggestion = '';
      if (hasPermissionIssues) {
        suggestion = '\n💡 解决方案：请以管理员身份运行程序，或检查文件权限设置';
      } else if (hasSpaceIssues) {
        suggestion = '\n💡 解决方案：请清理磁盘空间或等待其他操作完成';
      } else if (hasFileIssues) {
        suggestion = '\n💡 解决方案：请检查文件是否被手动移动或删除，考虑手动恢复';
      } else {
        suggestion = '\n💡 解决方案：请检查系统状态，必要时手动恢复文件';
      }

      return {
        success: false,
        message: `撤销预检查失败:\n${preCheckResult.issues.join('\n')}${suggestion}`
      };
    }

    console.log('开始执行文件撤销操作');
    const operationId = `undo-${entryId}-${Date.now()}`;
    let undoOutcome: UndoOperationOutcome = { warnings: [] };

    try {
      for (const operation of entry.fileOperations) {
        if (operation.status !== 'success') continue;

        const pathValidation = normalizeOperationPaths(operation);
        if (!pathValidation.isValid) {
          throw new Error(`路径安全验证失败: ${pathValidation.error}`);
        }
      }

      undoOutcome = await performUndoOperations(context.getOperationContext(), entry.fileOperations, operationId);
      console.log('文件撤销操作完成');

      console.log('🔍 检查文件夹清理条件:', {
        hasCreatedDirectories: !!entry.createdDirectories,
        createdDirectoriesLength: entry.createdDirectories?.length || 0,
        createdDirectories: entry.createdDirectories
      });

      if (entry.createdDirectories && entry.createdDirectories.length > 0) {
        console.log('开始清理工作流创建的文件夹');
        await cleanupCreatedDirectories(entry.createdDirectories);
        console.log('文件夹清理完成');
      } else {
        console.log('⚠️ 没有需要清理的文件夹或文件夹列表为空');
      }

      console.log('🔍 检查空文件夹恢复条件:', {
        hasCleanedEmptyDirectories: !!entry.cleanedEmptyDirectories,
        cleanedEmptyDirectoriesLength: entry.cleanedEmptyDirectories?.length || 0,
        cleanedEmptyDirectories: entry.cleanedEmptyDirectories
      });

      if (entry.cleanedEmptyDirectories && entry.cleanedEmptyDirectories.length > 0) {
        console.log('开始恢复被清理的空文件夹');
        await restoreCleanedEmptyDirectories(entry.cleanedEmptyDirectories);
        console.log('空文件夹恢复完成');
      } else {
        console.log('⚠️ 没有需要恢复的空文件夹或文件夹列表为空');
      }

      context.rollbackManager.logStep(operationId, {
        id: `history-update-${Date.now()}`,
        type: 'history_update',
        metadata: { originalEntry: { ...entry } },
        timestamp: Date.now(),
        completed: false
      });

      await context.updateHistoryEntryStatus(entryId, {
        isUndone: true,
        undoTimestamp: new Date().toISOString(),
        canUndo: false
      });

      context.rollbackManager.markLatestStepCompleted(operationId);
      console.log('撤销操作完成，历史记录已更新');
      context.rollbackManager.clearOperation(operationId);
    } catch (undoError) {
      console.error('撤销操作失败，开始回滚操作');

      try {
        await context.rollbackManager.rollbackOperation(operationId);
        console.log('回滚操作完成');
      } catch (rollbackError) {
        console.error('回滚操作也失败了:', rollbackError);
      }

      throw undoError;
    }

    return { success: true, message: buildUndoSuccessMessage(undoOutcome.warnings) };
  } catch (error) {
    console.error('撤销操作失败:', error);

    let errorMessage = '撤销操作失败';
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        errorMessage = '撤销失败：相关文件或文件夹不存在，可能已被手动删除或移动';
      } else if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
        errorMessage = '撤销失败：权限不足，请以管理员身份运行或检查文件权限';
      } else if (error.message.includes('EBUSY')) {
        errorMessage = '撤销失败：文件正在被其他程序使用，请关闭相关程序后重试';
      } else if (error.message.includes('EEXIST')) {
        errorMessage = '撤销失败：目标位置已存在同名文件或文件夹';
      } else {
        errorMessage = `撤销失败：${error.message}`;
      }
    }

    return { success: false, message: errorMessage };
  }
}

export async function chainUndoEntryAction(
  context: HistoryEntryActionContext,
  entryId: string
): Promise<ChainUndoActionResult> {
  try {
    console.log('开始连锁撤回操作，entryId:', entryId);
    const history = await context.storage.readHistoryFile();

    const entryIndex = history.findIndex((entry: HistoryEntry) => entry.id === entryId);
    if (entryIndex === -1) {
      return { success: false, message: '历史记录不存在，可能已被删除' };
    }

    const entry = history[entryIndex];
    console.log('找到要连锁撤回的记录:', entry.workflowName);

    if (entry.canUndo === false) {
      return { success: false, message: '此操作被标记为不可撤销' };
    }

    if (entry.isUndone) {
      return { success: false, message: '此操作已经被撤销过了' };
    }

    const entryTime = new Date(entry.timestamp).getTime();
    const now = Date.now();
    const hoursDiff = (now - entryTime) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      const hoursAgo = Math.floor(hoursDiff);
      return {
        success: false,
        message: `操作已过去 ${hoursAgo} 小时，超过24小时时间限制，无法撤销。`
      };
    }

    const chainAnalysis = await analyzeChainDependencies(entry.fileOperations);
    console.log('连锁依赖分析结果:', chainAnalysis);

    if (chainAnalysis.conflicts.length === 0) {
      console.log('开始执行普通撤回操作');
      const undoOutcome = await performUndoOperations(context.getOperationContext(), entry.fileOperations);
      console.log('普通撤回操作完成');

      if (entry.createdDirectories && entry.createdDirectories.length > 0) {
        console.log('开始清理工作流创建的文件夹');
        await cleanupCreatedDirectories(entry.createdDirectories);
        console.log('文件夹清理完成');
      }

      if (entry.cleanedEmptyDirectories && entry.cleanedEmptyDirectories.length > 0) {
        console.log('开始恢复被清理的空文件夹');
        await restoreCleanedEmptyDirectories(entry.cleanedEmptyDirectories);
        console.log('空文件夹恢复完成');
      }

      await context.updateHistoryEntryStatus(entryId, {
        isUndone: true,
        undoTimestamp: new Date().toISOString(),
        canUndo: false
      });

      return { success: true, message: buildUndoSuccessMessage(undoOutcome.warnings) };
    }

    console.log('开始执行连锁撤回操作');
    const chainOutcome = await performChainUndoOperations(context.getOperationContext(), entry.fileOperations, chainAnalysis);
    console.log('连锁撤回操作完成');

    if (entry.createdDirectories && entry.createdDirectories.length > 0) {
      console.log('开始清理工作流创建的文件夹');
      await cleanupCreatedDirectories(entry.createdDirectories);
      console.log('文件夹清理完成');
    }

    if (entry.cleanedEmptyDirectories && entry.cleanedEmptyDirectories.length > 0) {
      console.log('开始恢复被清理的空文件夹');
      await restoreCleanedEmptyDirectories(entry.cleanedEmptyDirectories);
      console.log('空文件夹恢复完成');
    }

    await context.updateHistoryEntryStatus(entryId, {
      isUndone: true,
      undoTimestamp: new Date().toISOString(),
      canUndo: false
    });

    return { success: true, message: buildUndoSuccessMessage(chainOutcome.warnings) };
  } catch (error) {
    console.error('连锁撤回操作失败:', error);

    let errorMessage = '连锁撤回操作失败';
    if (error instanceof Error) {
      errorMessage = `连锁撤回失败：${error.message}`;
    }

    return { success: false, message: errorMessage };
  }
}

export async function redoEntryAction(
  context: HistoryEntryActionContext,
  entryId: string
): Promise<RedoActionResult> {
  try {
    const history = await context.storage.readHistoryFile();
    const entryIndex = history.findIndex((entry: HistoryEntry) => entry.id === entryId);

    if (entryIndex === -1) {
      return { success: false, message: '历史记录不存在' };
    }

    const entry = history[entryIndex];

    if (!entry.isUndone) {
      return { success: false, message: '此操作无法重做' };
    }

    const preCheckResult = await preCheckRedoOperations(entry.fileOperations, context.workflowEngine);
    if (!preCheckResult.canRedo) {
      const hasPermissionIssues = preCheckResult.issues.some(issue => issue.includes('权限不足'));
      const hasSpaceIssues = preCheckResult.issues.some(issue => issue.includes('磁盘空间'));
      const hasConflictIssues = preCheckResult.issues.some(issue => issue.includes('已被占用') || issue.includes('冲突'));

      let suggestion = '';
      if (hasPermissionIssues) {
        suggestion = '\n💡 解决方案：请以管理员身份运行程序，或检查文件权限设置';
      } else if (hasSpaceIssues) {
        suggestion = '\n💡 解决方案：请清理磁盘空间后重试';
      } else if (hasConflictIssues) {
        suggestion = '\n💡 解决方案：请检查目标位置是否有同名文件，考虑手动处理冲突';
      } else {
        suggestion = '\n💡 解决方案：请检查系统状态，确保文件系统处于稳定状态';
      }

      return {
        success: false,
        message: `重做预检查失败:\n${preCheckResult.issues.join('\n')}${suggestion}`
      };
    }

    await performRedoOperations(context.getOperationContext(), entry.fileOperations);

    history[entryIndex] = {
      ...entry,
      isUndone: false,
      canUndo: true,
      undoTimestamp: undefined
    };

    await context.storage.writeHistoryFile(history, { updateCache: true });

    return { success: true };
  } catch (error) {
    console.error('重做操作失败:', error);
    return { success: false, message: `重做操作失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
