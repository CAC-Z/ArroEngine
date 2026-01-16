import type { HistoryEntry, FileOperation, WorkflowResult, Workflow, AppFile, StepResult, ProcessStep } from '../../shared/types';
import { WorkflowEngine } from './workflow-engine';
import { HISTORY_CONFIG } from './history/history-config';
import { HistoryStorage } from './history/history-storage';
import { generateUserFeedback as buildUserFeedback } from './history/history-feedback';
import type { UserFeedback, FeedbackResult, FeedbackContext } from './history/history-feedback';
import {
  generateExecutionHash as buildExecutionHash,
  isDuplicateExecution as checkDuplicateExecution,
  hasDuplicateEntry
} from './history/history-dedup';
import { createHistoryEntryFromWorkflowResult } from './history/history-entry-builder';
import type { HistoryOperationContext } from './history/history-operations';
import { HistoryLockManager } from './history/history-locks';
import { HistoryRollbackManager } from './history/history-rollback';
import {
  performUndoEntryAction,
  chainUndoEntryAction,
  redoEntryAction,
  type HistoryEntryActionContext
} from './history/history-entry-actions';

export class HistoryManager {
  private workflowEngine: WorkflowEngine;
  private storage: HistoryStorage;
  private lockManager: HistoryLockManager;
  private rollbackManager: HistoryRollbackManager;
  private recentExecutions: Map<string, number> = new Map(); // 最近执行记录，用于重复检测

  constructor(options?: { enableLockCleanup?: boolean }) {
    this.workflowEngine = new WorkflowEngine();
    this.storage = new HistoryStorage();
    this.lockManager = new HistoryLockManager();
    if (options?.enableLockCleanup !== false) {
      this.lockManager.start();
    }
    this.rollbackManager = new HistoryRollbackManager(this.storage, this.lockManager);
  }

  /**
   * 批量添加历史记录条目（用于步骤级别记录）
   */
  async addEntries(entries: HistoryEntry[]): Promise<void> {
    if (entries.length === 0) return;

    await this.lockManager.acquireHistoryLock();
    try {
      const history = await this.storage.readHistoryFile();

      // 逐个检查重复并添加
      for (const entry of entries) {
        const isDuplicate = hasDuplicateEntry(entry, history);
        if (!isDuplicate) {
          history.unshift(entry);
        } else {
          console.warn(`[重复检测] 跳过重复的步骤历史记录: ${entry.stepName} (${entry.timestamp})`);
        }
      }

      // 执行清理策略
      const cleanedHistory = this.storage.performCleanup(history);

      await this.storage.writeHistoryFile(cleanedHistory);
    } finally {
      this.lockManager.releaseHistoryLock();
    }
  }

  /**
   * 添加历史记录条目（带重复检测）
   */
  async addEntry(entry: HistoryEntry): Promise<void> {
    await this.lockManager.acquireHistoryLock();
    try {
      const history = await this.storage.readHistoryFile();

      // 检查是否为重复记录
      const isDuplicate = hasDuplicateEntry(entry, history);
      if (isDuplicate) {
        console.warn(`[重复检测] 跳过重复的历史记录: ${entry.workflowName} (${entry.timestamp})`);
        return;
      }

      history.unshift(entry); // 添加到开头，最新的在前面

      // 执行清理策略
      const cleanedHistory = this.storage.performCleanup(history);

      await this.storage.writeHistoryFile(cleanedHistory);
    } finally {
      this.lockManager.releaseHistoryLock();
    }
  }

  /**
   * 从工作流结果创建历史记录条目
   */
  createEntryFromWorkflowResult(
    workflowResult: WorkflowResult,
    workflow: Workflow,
    originalFiles: AppFile[],
    source: 'manual' | 'file_watch' | 'scheduled' = 'manual',
    monitorTaskId?: string,
    monitorTaskName?: string,
    createdDirectories?: string[],
    cleanedEmptyDirectories?: string[],
    createStepLevelEntries: boolean = false
  ): HistoryEntry | HistoryEntry[] {
    return createHistoryEntryFromWorkflowResult({
      workflowResult,
      workflow,
      originalFiles,
      source,
      monitorTaskId,
      monitorTaskName,
      createdDirectories,
      cleanedEmptyDirectories,
      createStepLevelEntries
    });
  }

  /**
   * 获取历史记录（带内存缓存优化）
   */
  async getEntries(limit?: number, offset?: number): Promise<HistoryEntry[]> {
    return this.storage.getEntries(limit, offset);
  }

  /**
   * 清除内存缓存
   */
  clearMemoryCache(): void {
    this.storage.clearCache();
  }

  /**
   * 检查工作流执行是否可能重复（在执行前调用）
   */
  async checkPotentialDuplicate(workflow: Workflow, files: AppFile[]): Promise<{ isDuplicate: boolean; message?: string }> {
    const executionHash = buildExecutionHash({
      workflowId: workflow.id,
      stepResults: workflow.steps.map(step => ({
        stepId: step.id,
        stepName: step.name,
        inputFiles: [],
        outputFiles: [],
        processedCount: 0,
        errors: [],
        duration: 0
      })),
      totalFiles: files.length,
      processedFiles: 0,
      errors: [],
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 0,
      changes: []
    }, workflow, files);

    const isDuplicate = checkDuplicateExecution(executionHash, new Date().toISOString(), this.recentExecutions);

    if (isDuplicate) {
      return {
        isDuplicate: true,
        message: `检测到可能的重复执行：工作流"${workflow.name}"在短时间内重复执行相同的文件集合。请确认是否继续执行。`
      };
    }

    return { isDuplicate: false };
  }

  /**
   * 搜索历史记录（使用内存缓存）
   */
  async searchEntries(query: string, limit?: number): Promise<HistoryEntry[]> {
    const history = await this.getEntries(); // 使用缓存的获取方法
    const lowerQuery = query.toLowerCase();

    const filtered = history.filter((entry: HistoryEntry) =>
      entry.workflowName.toLowerCase().includes(lowerQuery) ||
      entry.stepName?.toLowerCase().includes(lowerQuery) ||
      entry.monitorTaskName?.toLowerCase().includes(lowerQuery) ||
      entry.fileOperations.some((op: FileOperation) =>
        op.originalName.toLowerCase().includes(lowerQuery) ||
        op.newName?.toLowerCase().includes(lowerQuery)
      )
    );

    return limit ? filtered.slice(0, limit) : filtered;
  }

  /**
   * 清空历史记录
   */
  async clearHistory(): Promise<void> {
    await this.storage.clearHistory();
  }

  /**
   * 删除单条历史记录
   */
  async deleteEntry(entryId: string): Promise<boolean> {
    return this.storage.deleteEntry(entryId);
  }

  /**
   * 分类和格式化错误信息（复用工作流引擎的错误分类）
   */
  private categorizeError(error: Error, operation: string, filePath: string): string {
    return this.workflowEngine.categorizeError(error, operation, filePath);
  }

  /**
   * 事务性更新历史记录条目状态
   */
  private async updateHistoryEntryStatus(
    entryId: string,
    updates: Partial<Pick<HistoryEntry, 'isUndone' | 'undoTimestamp' | 'canUndo'>>
  ): Promise<void> {
    try {
      // 重新加载最新的历史记录，避免并发修改冲突
      const history = await this.storage.readHistoryFile();
      const entryIndex = history.findIndex((entry: HistoryEntry) => entry.id === entryId);

      if (entryIndex === -1) {
        throw new Error(`历史记录条目不存在: ${entryId}`);
      }

      // 更新条目状态
      history[entryIndex] = {
        ...history[entryIndex],
        ...updates
      };

      // 原子性保存
      await this.storage.writeHistoryFile(history, { updateCache: true });

      console.log(`✅ 历史记录状态已更新: ${entryId}`, updates);
    } catch (error) {
      console.error(`❌ 更新历史记录状态失败: ${entryId}`, error);
      throw new Error(`更新历史记录状态失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 手动触发清理
   */
  async manualCleanup(): Promise<{ deletedCount: number; message: string }> {
    return this.storage.manualCleanup();
  }

  /**
   * 撤销历史记录操作
   */
  async undoEntry(entryId: string): Promise<{
    success: boolean;
    message?: string;
    requiresChainUndo?: boolean;
    entryId?: string
  }> {
    // 获取操作锁，防止并发撤回同一条记录
    await this.lockManager.acquireOperationLock(entryId);

    const operationPromise = performUndoEntryAction(this.getActionContext(), entryId);
    this.lockManager.registerOperation(entryId, operationPromise);

    try {
      const result = await operationPromise;
      return result;
    } finally {
      this.lockManager.releaseOperationLock(entryId);
    }
  }

  /**
   * 连锁撤回操作 - 处理连锁重命名冲突
   */
  async chainUndoEntry(entryId: string): Promise<{ success: boolean; message?: string }> {
    return chainUndoEntryAction(this.getActionContext(), entryId);
  }

  /**
   * 重做已撤销的操作
   */
  async redoEntry(entryId: string): Promise<{ success: boolean; message?: string }> {
    return redoEntryAction(this.getActionContext(), entryId);
  }
  /**
   * 增强的用户反馈机制
   */
  private generateUserFeedback(
    operation: string,
    result: FeedbackResult,
    context?: FeedbackContext
  ): UserFeedback {
    return buildUserFeedback(operation, result, context);
  }

  private getActionContext(): HistoryEntryActionContext {
    return {
      storage: this.storage,
      lockManager: this.lockManager,
      workflowEngine: this.workflowEngine,
      rollbackManager: this.rollbackManager,
      getOperationContext: this.getOperationContext.bind(this),
      updateHistoryEntryStatus: this.updateHistoryEntryStatus.bind(this)
    };
  }

  private getOperationContext(): HistoryOperationContext {
    return {
      workflowEngine: this.workflowEngine,
      categorizeError: this.categorizeError.bind(this),
      logOperationStep: this.rollbackManager.logStep.bind(this.rollbackManager)
    };
  }

  private stopLockCleanupMonitor(): void {
    this.lockManager.stop();
  }
}

// 导出单例实例
const historyManager = new HistoryManager({
  enableLockCleanup: process.env.NODE_ENV !== 'test'
});

module.exports = { HistoryManager, historyManager };
