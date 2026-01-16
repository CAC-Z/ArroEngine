import fs from 'fs-extra';
import type { HistoryEntry } from '../../../shared/types';
import type { HistoryStorage } from './history-storage';
import type { HistoryLockManager } from './history-locks';
import type { OperationStep } from './history-cleanup';
import { cleanupPartialStep, cleanupUnstartedStep, abortInProgressStep } from './history-cleanup';

export class HistoryRollbackManager {
  private operationLog: Map<string, OperationStep[]> = new Map();

  constructor(
    private storage: HistoryStorage,
    private lockManager: HistoryLockManager
  ) {}

  logStep(operationId: string, step: OperationStep): void {
    if (!this.operationLog.has(operationId)) {
      this.operationLog.set(operationId, []);
    }
    this.operationLog.get(operationId)!.push(step);
  }

  markLatestStepCompleted(operationId: string): void {
    const steps = this.operationLog.get(operationId);
    if (!steps || steps.length === 0) return;
    const lastStep = steps[steps.length - 1];
    lastStep.completed = true;
  }

  clearOperation(operationId: string): void {
    this.operationLog.delete(operationId);
  }

  async rollbackOperation(operationId: string): Promise<void> {
    const steps = this.operationLog.get(operationId);
    if (!steps) return;

    console.log(`🔄 开始回滚操作 ${operationId}，共 ${steps.length} 个步骤`);

    let rollbackSuccessCount = 0;
    let rollbackFailureCount = 0;
    const rollbackErrors: string[] = [];

    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];

      try {
        if (step.completed) {
          await this.rollbackSingleStep(step);
          console.log(`✅ 回滚已完成步骤: ${step.type} - ${step.id}`);
          rollbackSuccessCount++;
        } else if (step.partiallyCompleted) {
          await cleanupPartialStep(step);
          console.log(`🧹 清理部分完成步骤: ${step.type} - ${step.id}`);
          rollbackSuccessCount++;
        } else if (step.inProgress) {
          await abortInProgressStep(step);
          console.log(`⏹️ 中止进行中步骤: ${step.type} - ${step.id}`);
          rollbackSuccessCount++;
        } else {
          await cleanupUnstartedStep(step);
          console.log(`🗑️ 清理未开始步骤: ${step.type} - ${step.id}`);
          rollbackSuccessCount++;
        }
      } catch (error) {
        const errorMsg = `回滚步骤失败: ${step.type} - ${step.id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`, error);
        rollbackErrors.push(errorMsg);
        rollbackFailureCount++;
      }
    }

    console.log(`🔄 回滚操作完成: ${operationId}`);
    console.log(`   ✅ 成功: ${rollbackSuccessCount} 个步骤`);
    console.log(`   ❌ 失败: ${rollbackFailureCount} 个步骤`);

    if (rollbackErrors.length > 0) {
      console.warn(`⚠️ 回滚过程中的错误:`, rollbackErrors);
    }

    this.operationLog.delete(operationId);
  }

  private async rollbackSingleStep(step: OperationStep): Promise<void> {
    switch (step.type) {
      case 'file_move':
        if (step.targetPath && step.sourcePath && await fs.pathExists(step.targetPath)) {
          await fs.move(step.targetPath, step.sourcePath);
        }
        break;
      case 'file_copy':
        if (step.targetPath && await fs.pathExists(step.targetPath)) {
          await fs.remove(step.targetPath);
        }
        break;
      case 'file_delete':
        if (step.backupPath && step.sourcePath && await fs.pathExists(step.backupPath)) {
          await fs.move(step.backupPath, step.sourcePath);
        }
        break;
      case 'folder_create':
        if (step.targetPath && await fs.pathExists(step.targetPath)) {
          const items = await fs.readdir(step.targetPath);
          if (items.length === 0) {
            await fs.rmdir(step.targetPath);
          }
        }
        break;
      case 'history_update':
        if (step.metadata && step.metadata.originalEntry) {
          await this.restoreHistoryEntry(step.metadata.originalEntry);
        }
        break;
    }
  }

  private async restoreHistoryEntry(originalEntry: HistoryEntry): Promise<void> {
    await this.lockManager.acquireHistoryLock();
    try {
      const history = await this.storage.readHistoryFile();
      const entryIndex = history.findIndex(entry => entry.id === originalEntry.id);
      if (entryIndex !== -1) {
        history[entryIndex] = originalEntry;
        await this.storage.writeHistoryFile(history, { updateCache: true });
      }
    } finally {
      this.lockManager.releaseHistoryLock();
    }
  }
}
