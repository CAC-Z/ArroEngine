import fs from 'fs-extra';
import path from 'path';
import type { FileOperation } from '../../../shared/types';
import type { WorkflowEngine } from '../workflow-engine';
import { generateErrorSuggestion } from './history-feedback';
import type { OperationStep } from './history-cleanup';

export interface HistoryOperationContext {
  workflowEngine: WorkflowEngine;
  categorizeError: (error: Error, operation: string, filePath: string) => string;
  logOperationStep?: (operationId: string, step: OperationStep) => void;
}

export interface ChainAnalysis {
  conflicts: Array<{ operation: FileOperation; blockingOperation: FileOperation }>;
  executionOrder: FileOperation[];
}

export interface UndoOperationOutcome {
  warnings: string[];
}

export async function performUndoOperations(
  context: HistoryOperationContext,
  operations: FileOperation[],
  operationId?: string
): Promise<UndoOperationOutcome> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const successfulOperations = operations.filter(op => op.status === 'success');
  console.log(`开始撤销 ${successfulOperations.length} 个成功的操作（跳过 ${operations.length - successfulOperations.length} 个失败的操作）`);

  if (operationId && context.logOperationStep) {
    context.logOperationStep(operationId, {
      id: `history-backup-${Date.now()}`,
      type: 'history_update',
      metadata: { operationType: 'undo_start' },
      timestamp: Date.now(),
      completed: false
    });
  }

  for (const operation of successfulOperations) {
    try {
      if (operation.operation !== 'delete') {
        if (!operation.newPath) {
          warnings.push(`跳过撤销：记录缺少目标路径 (${operation.originalPath})`);
          continue;
        }

        const targetExists = await fs.pathExists(operation.newPath);
        if (!targetExists) {
          warnings.push(`跳过撤销：记录的目标不存在 (${operation.originalPath}) -> ${operation.newPath}`);
          continue;
        }

        if (!operation.fileId) {
          warnings.push(`缺少文件ID，基于路径执行撤销: ${operation.newPath}`);
        }
      }

      switch (operation.operation) {
        case 'move':
        case 'rename':
          await undoMoveOrRename(operation, errors, warnings);
          break;

        case 'copy':
          await undoCopy(operation, errors, warnings);
          break;

        case 'delete':
          warnings.push(`删除操作无法撤销，请从回收站手动恢复: ${operation.originalPath}`);
          break;

        case 'createFolder':
          await undoCreateFolder(operation, errors, warnings);
          break;
      }
    } catch (error) {
      const categorizedError = error instanceof Error
        ? context.categorizeError(error, '撤销', operation.originalPath ?? '')
        : `撤销操作失败 ${operation.originalPath}: ${String(error)}`;

      const suggestion = generateErrorSuggestion(categorizedError, {
        operation: '撤销',
        filePath: operation.originalPath,
        retryCount: 0
      });
      const fullErrorMsg = `${categorizedError}\n${suggestion}`;

      console.error(fullErrorMsg);
      errors.push(fullErrorMsg);
    }
  }

  if (errors.length > 0) {
    let errorMessage = `撤销过程中发生错误:\n${errors.join('\n')}`;
    if (warnings.length > 0) {
      errorMessage += `\n\n警告:\n${warnings.join('\n')}`;
    }
    throw new Error(errorMessage);
  } else if (warnings.length > 0) {
    console.warn(`撤销完成，但有警告:\n${warnings.join('\n')}`);
  }

  return { warnings };
}

export async function performChainUndoOperations(
  context: HistoryOperationContext,
  operations: FileOperation[],
  chainAnalysis: ChainAnalysis
): Promise<UndoOperationOutcome> {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log(`开始执行连锁撤回，共 ${chainAnalysis.executionOrder.length} 个操作`);
  console.log('执行顺序:', chainAnalysis.executionOrder.map(op => `${op.originalName} (${op.originalPath} -> ${op.newPath})`));

  const tempMappings = new Map<string, string>();

  for (const operation of chainAnalysis.executionOrder) {
    if (!operation.newPath || !operation.originalPath) continue;

    try {
      const hasConflict = chainAnalysis.conflicts.some(c => c.operation.id === operation.id);

      if (hasConflict && await fs.pathExists(operation.originalPath)) {
        const tempName = `chain-undo-temp-${operation.id}-${Date.now()}`;
        const tempPath = path.join(path.dirname(operation.originalPath), tempName);

        console.log(`🔄 临时移动冲突文件: ${operation.originalPath} -> ${tempPath}`);
        await fs.move(operation.originalPath, tempPath);
        tempMappings.set(operation.originalPath, tempPath);
      }
    } catch (error) {
      const errorMsg = `临时移动文件失败 ${operation.originalPath}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  for (const operation of chainAnalysis.executionOrder) {
    try {
      switch (operation.operation) {
        case 'move':
        case 'rename':
          await undoMoveOrRename(operation, errors, warnings);
          break;

        case 'copy':
          await undoCopy(operation, errors, warnings);
          break;

        case 'delete':
          warnings.push(`删除操作无法撤销，请从回收站手动恢复: ${operation.originalPath}`);
          break;

        case 'createFolder':
          await undoCreateFolder(operation, errors, warnings);
          break;
      }
    } catch (error) {
      const categorizedError = error instanceof Error
        ? context.categorizeError(error, '连锁撤回', operation.originalPath ?? '')
        : `连锁撤回操作失败 ${operation.originalPath}: ${String(error)}`;

      const suggestion = generateErrorSuggestion(categorizedError, {
        operation: '连锁撤回',
        filePath: operation.originalPath,
        retryCount: 0
      });
      const fullErrorMsg = `${categorizedError}\n${suggestion}`;

      console.error(fullErrorMsg);
      errors.push(fullErrorMsg);
    }
  }

  for (const [originalPath, tempPath] of tempMappings) {
    try {
      if (await fs.pathExists(tempPath)) {
        console.log(`🧹 清理临时文件: ${tempPath}`);
        await fs.remove(tempPath);
      }
    } catch (error) {
      console.warn(`清理临时文件失败 ${tempPath}:`, error);
    }
  }

  if (errors.length > 0) {
    let errorMessage = `连锁撤回过程中发生错误:\n${errors.join('\n')}`;
    if (warnings.length > 0) {
      errorMessage += `\n\n警告:\n${warnings.join('\n')}`;
    }
    throw new Error(errorMessage);
  } else if (warnings.length > 0) {
    console.warn(`连锁撤回完成，但有警告:\n${warnings.join('\n')}`);
  }

  return { warnings };
}

export async function performRedoOperations(
  context: HistoryOperationContext,
  operations: FileOperation[]
): Promise<void> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const successfulOperations = operations.filter(op => op.status === 'success');

  for (const operation of successfulOperations) {
    const sourcePath = operation.originalPath;
    const finalDestPath = operation.newPath;
    let tempPath: string | undefined;

    try {
      switch (operation.operation) {
        case 'move':
        case 'rename':
          console.log(`[防御性重做] 准备执行: ${sourcePath} -> ${finalDestPath}`);
          if (!sourcePath || !finalDestPath) {
            errors.push(`重做失败：操作记录无效，路径缺失。`);
            continue;
          }
          if (!await fs.pathExists(sourcePath)) {
            errors.push(`重做失败：源文件/夹不存在: ${sourcePath}`);
            continue;
          }
          if (await fs.pathExists(finalDestPath)) {
            errors.push(`重做失败：目标位置已被占用: ${finalDestPath}`);
            continue;
          }

          const destParentDir = path.dirname(finalDestPath);
          await fs.ensureDir(destParentDir);

          const tempName = `redo-temp-${operation.id}-${Date.now()}`;
          tempPath = path.join(destParentDir, tempName);

          await fs.move(sourcePath, tempPath);
          await fs.rename(tempPath, finalDestPath);

          console.log(`✅ 成功重做移动/重命名: ${sourcePath} -> ${finalDestPath}`);
          break;

        case 'copy':
          if (!sourcePath || !finalDestPath) {
            errors.push(`重做失败：复制操作记录无效: ${operation.originalName}`);
            continue;
          }
          await fs.copy(sourcePath, finalDestPath);
          console.log(`✅ 成功重做复制: ${sourcePath} -> ${finalDestPath}`);
          break;

        case 'delete':
          warnings.push(`删除操作无法自动重做: ${sourcePath}`);
          break;
      }
    } catch (err) {
      const errorMsg = `重做操作失败 ${operation.originalPath}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(errorMsg, err);
      errors.push(errorMsg);

      if (tempPath && await fs.pathExists(tempPath)) {
        await fs.remove(tempPath).catch(cleanupErr => {
          console.error(`!!! 清理临时文件中转失败: ${tempPath}`, cleanupErr);
        });
      }
    }
  }

  if (errors.length > 0) {
    let errorMessage = `重做过程中发生错误:\n${errors.join('\n')}`;
    if (warnings.length > 0) {
      errorMessage += `\n\n警告:\n${warnings.join('\n')}`;
    }
    throw new Error(errorMessage);
  } else if (warnings.length > 0) {
    console.warn(`重做完成，但有警告:\n${warnings.join('\n')}`);
  }
}

async function undoMoveOrRename(operation: FileOperation, errors: string[], warnings: string[]): Promise<void> {
  const sourcePath = operation.newPath;
  const finalDestPath = operation.originalPath;

  console.log(`[防御性撤销] 准备执行: ${sourcePath} -> ${finalDestPath}`);

  if (!sourcePath || !finalDestPath) {
    errors.push(`撤销失败：操作记录无效，源或目标路径缺失。`);
    return;
  }

  if (!await fs.pathExists(sourcePath)) {
    errors.push(`撤销失败：源文件/文件夹已不存在于 ${sourcePath}`);
    return;
  }

  const destParentDir = path.dirname(finalDestPath);
  try {
    await fs.ensureDir(destParentDir);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(`撤销失败：无法创建父目录 ${destParentDir}。错误: ${errorMsg}`);
    return;
  }

  const tempName = `undo-temp-${operation.id}-${Date.now()}`;
  const tempPath = path.join(destParentDir, tempName);
  let conflictBackupPath: string | undefined;

  if (await fs.pathExists(finalDestPath)) {
    const conflictBaseName = `${path.basename(finalDestPath)}.undo-conflict-${Date.now()}`;
    let candidatePath = path.join(destParentDir, conflictBaseName);
    let attempt = 0;

    while (await fs.pathExists(candidatePath)) {
      attempt += 1;
      candidatePath = path.join(destParentDir, `${conflictBaseName}-${attempt}`);
    }

    try {
      await fs.move(finalDestPath, candidatePath);
      conflictBackupPath = candidatePath;
      warnings.push(`目标路径 ${finalDestPath} 已存在同名项目，已临时重命名为 ${path.basename(candidatePath)}，请在确认无误后手动处理。`);
    } catch (conflictError) {
      const errorMsg = conflictError instanceof Error ? conflictError.message : String(conflictError);
      errors.push(`撤销失败：无法移动冲突文件 ${finalDestPath}。错误: ${errorMsg}`);
      return;
    }
  }

  try {
    await fs.move(sourcePath, tempPath);
    await fs.rename(tempPath, finalDestPath);
    console.log(`✅ 成功撤销: ${sourcePath} -> ${finalDestPath}`);
  } catch (err) {
    const errorMsg = `撤销失败：在移动/重命名过程中发生错误。目标: ${finalDestPath}. 错误: ${err instanceof Error ? err.message : String(err)}`;
    console.error(errorMsg, err);
    errors.push(errorMsg);

    if (await fs.pathExists(tempPath)) {
      await fs.remove(tempPath).catch(cleanupErr => {
        console.error(`!!! 清理临时文件中转失败: ${tempPath}`, cleanupErr);
      });
    }

    if (conflictBackupPath && await fs.pathExists(conflictBackupPath)) {
      await fs.move(conflictBackupPath, finalDestPath).catch(resumeErr => {
        console.error(`!!! 回滚冲突文件失败: ${conflictBackupPath} -> ${finalDestPath}`, resumeErr);
      });
    }
    return;
  }

  if (conflictBackupPath && await fs.pathExists(conflictBackupPath)) {
    warnings.push(`原位置已恢复，但检测到备用冲突文件 ${conflictBackupPath}，请确认后手动处理。`);
  }
}

async function undoCreateFolder(operation: FileOperation, errors: string[], warnings: string[]): Promise<void> {
  const folderPath = operation.newPath || operation.originalPath;

  if (!folderPath) {
    errors.push(`操作记录不完整，缺少文件夹路径: ${operation.originalName}`);
    return;
  }

  if (!await fs.pathExists(folderPath)) {
    warnings.push(`要删除的文件夹不存在（可能已被手动删除）: ${folderPath}`);
    return;
  }

  try {
    const items = await fs.readdir(folderPath);
    if (items.length > 0) {
      warnings.push(`文件夹不为空，无法撤销创建操作: ${folderPath} (包含 ${items.length} 个项目)`);
      return;
    }

    await fs.rmdir(folderPath);
    console.log(`✅ 成功撤销文件夹创建，已删除: ${folderPath}`);
  } catch (removeError) {
    const errorMsg = `删除创建的文件夹失败: ${folderPath}`;
    console.error(errorMsg, removeError);
    errors.push(`${errorMsg}: ${removeError instanceof Error ? removeError.message : String(removeError)}`);
  }
}

async function undoCopy(operation: FileOperation, errors: string[], warnings: string[]): Promise<void> {
  if (!operation.newPath) {
    errors.push(`操作记录不完整，缺少新路径: ${operation.originalPath}`);
    return;
  }

  if (!await fs.pathExists(operation.newPath)) {
    warnings.push(`要删除的复制文件/文件夹不存在（可能已被手动删除）: ${operation.newPath}`);
    return;
  }

  try {
    const stat = await fs.stat(operation.newPath);
    const isDirectory = stat.isDirectory();
    await fs.remove(operation.newPath);
    console.log(`✅ 成功撤销${isDirectory ? '文件夹' : '文件'}复制，已删除: ${operation.newPath}`);
  } catch (removeError) {
    const errorMsg = `删除复制的文件/文件夹失败: ${operation.newPath}`;
    console.error(errorMsg, removeError);
    errors.push(`${errorMsg}: ${removeError instanceof Error ? removeError.message : String(removeError)}`);
  }
}
