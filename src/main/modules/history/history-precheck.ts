import fs from 'fs-extra';
import path from 'path';
import type { FileOperation } from '../../../shared/types';
import type { WorkflowEngine } from '../workflow-engine';
import {
  calculateRequiredSpace,
  checkDiskSpace,
  checkPermissions,
  checkDirectoryPermissions
} from './history-validation';

export async function preCheckRedoOperations(
  operations: FileOperation[],
  workflowEngine: WorkflowEngine
): Promise<{ canRedo: boolean; issues: string[] }> {
  const issues: string[] = [];
  const successfulOperations = operations.filter(op => op.status === 'success');

  const requiredSpace = calculateRequiredSpace(successfulOperations);
  if (requiredSpace > 0) {
    const moveOperations = successfulOperations.filter(op =>
      (op.operation === 'move' || op.operation === 'rename' || op.operation === 'copy') && op.newPath
    );

    for (const operation of moveOperations.slice(0, 3)) {
      if (!operation.newPath) continue;
      const spaceCheck = await checkDiskSpace(workflowEngine, operation.newPath, requiredSpace);
      if (!spaceCheck.hasSpace) {
        issues.push(`[重做预检警告] ${spaceCheck.error}`);
        break;
      }
    }
  }

  for (const operation of successfulOperations) {
    const sourcePath = operation.originalPath;
    const targetPath = operation.newPath;

    try {
      switch (operation.operation) {
        case 'move':
        case 'rename':
          if (!sourcePath || !targetPath) {
            issues.push(`[重做预检失败] 操作记录无效: ${operation.originalName}`);
            continue;
          }

          if (!await fs.pathExists(sourcePath)) {
            issues.push(`[重做预检失败] 源文件/文件夹不存在: ${sourcePath}`);
            continue;
          }

          if (await fs.pathExists(targetPath)) {
            issues.push(`[重做预检失败] 目标位置已被占用: ${targetPath}`);
            continue;
          }

          const sourcePermCheck = await checkPermissions(workflowEngine, sourcePath, 'read');
          if (!sourcePermCheck.hasPermission) {
            issues.push(`[重做预检失败] 源文件/文件夹权限不足: ${sourcePath} - ${sourcePermCheck.error}`);
            continue;
          }

          const targetDir = path.dirname(targetPath);
          const targetPermCheck = await checkDirectoryPermissions(workflowEngine, targetDir);
          if (!targetPermCheck.hasPermission) {
            issues.push(`[重做预检失败] 目标目录权限不足: ${targetDir} - ${targetPermCheck.error}`);
            continue;
          }

          const normalizedSource = path.normalize(sourcePath);
          const normalizedTarget = path.normalize(targetPath);
          if (normalizedTarget.startsWith(normalizedSource + path.sep)) {
            issues.push(`[重做预检失败] 不能将文件夹移动到自己内部: ${sourcePath} -> ${targetPath}`);
            continue;
          }
          break;

        case 'copy':
          if (!sourcePath || !targetPath) {
            issues.push(`[重做预检失败] 复制操作记录无效: ${operation.originalName}`);
            continue;
          }

          if (!await fs.pathExists(sourcePath)) {
            issues.push(`[重做预检失败] 源文件/文件夹不存在: ${sourcePath}`);
            continue;
          }

          if (await fs.pathExists(targetPath)) {
            issues.push(`[重做预检失败] 目标位置已被占用: ${targetPath}`);
            continue;
          }

          const copySourcePermCheck = await checkPermissions(workflowEngine, sourcePath, 'read');
          if (!copySourcePermCheck.hasPermission) {
            issues.push(`[重做预检失败] 源文件/文件夹权限不足: ${sourcePath} - ${copySourcePermCheck.error}`);
            continue;
          }

          const copyTargetDir = path.dirname(targetPath);
          const copyTargetPermCheck = await checkDirectoryPermissions(workflowEngine, copyTargetDir);
          if (!copyTargetPermCheck.hasPermission) {
            issues.push(`[重做预检失败] 目标目录权限不足: ${copyTargetDir} - ${copyTargetPermCheck.error}`);
            continue;
          }
          break;

        case 'delete':
          issues.push(`[重做预检警告] 删除操作无法重做: ${sourcePath}`);
          break;

        case 'createFolder':
          const folderPath = targetPath || sourcePath;
          if (!folderPath) {
            issues.push(`[重做预检失败] 创建文件夹记录无效: ${operation.originalName}`);
            continue;
          }

          if (await fs.pathExists(folderPath)) {
            issues.push(`[重做预检失败] 文件夹已存在: ${folderPath}`);
            continue;
          }

          const parentDir = path.dirname(folderPath);
          const parentPermCheck = await checkDirectoryPermissions(workflowEngine, parentDir);
          if (!parentPermCheck.hasPermission) {
            issues.push(`[重做预检失败] 父目录权限不足: ${parentDir} - ${parentPermCheck.error}`);
            continue;
          }
          break;
      }
    } catch (error) {
      issues.push(`重做预检查操作 ${operation.originalName} 时出错: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    canRedo: issues.length === 0,
    issues
  };
}

export async function preCheckUndoOperations(
  operations: FileOperation[],
  workflowEngine: WorkflowEngine
): Promise<{ canUndo: boolean; issues: string[] }> {
  const issues: string[] = [];
  const successfulOperations = operations.filter(op => op.status === 'success');

  const chainConflicts = await detectChainRenameConflicts(successfulOperations);
  if (chainConflicts.length > 0) {
    issues.push(...chainConflicts);
  }

  const requiredSpace = calculateRequiredSpace(successfulOperations);
  if (requiredSpace > 0) {
    const moveOperations = successfulOperations.filter(op =>
      (op.operation === 'move' || op.operation === 'rename') && op.originalPath
    );

    for (const operation of moveOperations.slice(0, 3)) {
      if (!operation.originalPath) continue;
      const spaceCheck = await checkDiskSpace(workflowEngine, operation.originalPath, requiredSpace);
      if (!spaceCheck.hasSpace) {
        issues.push(`[预检警告] ${spaceCheck.error}`);
        break;
      }
    }
  }

  for (const operation of successfulOperations) {
    const sourcePath = operation.newPath;
    const finalDestPath = operation.originalPath;

    try {
      switch (operation.operation) {
        case 'move':
        case 'rename':
          if (!sourcePath || !finalDestPath) {
            issues.push(`[预检失败] 操作记录无效: ${operation.originalName}`);
            continue;
          }
          if (!await fs.pathExists(sourcePath)) {
            issues.push(`[预检失败] 源文件/夹不存在: ${sourcePath}`);
            continue;
          }
          if (await fs.pathExists(finalDestPath) && chainConflicts.length === 0) {
            issues.push(`[预检失败] 目标位置已被占用: ${finalDestPath}`);
            continue;
          }

          const sourcePermCheck = await checkPermissions(workflowEngine, sourcePath, 'read');
          if (!sourcePermCheck.hasPermission) {
            issues.push(`[预检失败] 源文件权限不足: ${sourcePath} - ${sourcePermCheck.error}`);
            continue;
          }

          const targetDir = path.dirname(finalDestPath);
          const targetPermCheck = await checkDirectoryPermissions(workflowEngine, targetDir);
          if (!targetPermCheck.hasPermission) {
            issues.push(`[预检失败] 目标目录权限不足: ${targetDir} - ${targetPermCheck.error}`);
            continue;
          }
          break;

        case 'copy':
          if (!sourcePath) {
            issues.push(`[预检失败] 复制记录无效: ${operation.originalName}`);
            continue;
          }

          if (await fs.pathExists(sourcePath)) {
            const deletePermCheck = await checkPermissions(workflowEngine, sourcePath, 'write');
            if (!deletePermCheck.hasPermission) {
              issues.push(`[预检失败] 复制的文件/夹不可删除: ${sourcePath} - ${deletePermCheck.error}`);
            }
          }
          break;

        case 'delete':
          issues.push(`[预检警告] 删除操作无法自动撤销: ${operation.originalPath}`);
          break;

        case 'createFolder':
          const folderPath = operation.newPath || operation.originalPath;
          if (!folderPath) {
            issues.push(`[预检失败] 创建文件夹记录无效: ${operation.originalName}`);
            continue;
          }

          if (await fs.pathExists(folderPath)) {
            try {
              const items = await fs.readdir(folderPath);
              if (items.length > 0) {
                issues.push(`[预检警告] 创建的文件夹不为空，无法撤销: ${folderPath}`);
              }
            } catch {
              issues.push(`[预检失败] 无法读取创建的文件夹: ${folderPath}`);
            }
          }
          break;
      }
    } catch (error) {
      issues.push(`检查操作 ${operation.originalName} 时出错: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    canUndo: issues.length === 0,
    issues
  };
}

export async function detectChainRenameConflicts(operations: FileOperation[]): Promise<string[]> {
  const conflicts: string[] = [];
  const renameOps = operations.filter(op => op.operation === 'rename' || op.operation === 'move');

  if (renameOps.length === 0) {
    return conflicts;
  }

  console.log(`🔍 检测连锁重命名冲突，共 ${renameOps.length} 个重命名操作`);

  const undoTargets = new Map<string, FileOperation>();
  for (const op of renameOps) {
    if (op.originalPath) {
      undoTargets.set(op.originalPath, op);
    }
  }

  for (const operation of renameOps) {
    const sourcePath = operation.newPath;
    const targetPath = operation.originalPath;

    if (!sourcePath || !targetPath) continue;

    if (await fs.pathExists(targetPath)) {
      const occupyingOp = renameOps.find(op => op.newPath === targetPath);

      if (occupyingOp) {
        console.log(`⚠️ 检测到连锁重命名冲突:`);
        console.log(`  - 操作1: ${occupyingOp.originalPath} -> ${occupyingOp.newPath}`);
        console.log(`  - 操作2: ${operation.originalPath} -> ${operation.newPath}`);
        console.log(`  - 冲突: 操作2想要撤回到 ${targetPath}，但该位置被操作1的结果占用`);

        conflicts.push(`[连锁冲突] 无法撤回 ${operation.originalName}，因为目标位置 ${targetPath} 被同批次操作的文件占用。建议使用连锁撤回功能。`);
      } else {
        conflicts.push(`[预检失败] 目标位置已被其他文件占用: ${targetPath}`);
      }
    }
  }

  return conflicts;
}

export async function analyzeChainDependencies(operations: FileOperation[]): Promise<{
  conflicts: Array<{ operation: FileOperation; blockingOperation: FileOperation }>;
  executionOrder: FileOperation[];
}> {
  const conflicts: Array<{ operation: FileOperation; blockingOperation: FileOperation }> = [];
  const renameOps = operations.filter(op =>
    (op.operation === 'rename' || op.operation === 'move') && op.status === 'success'
  );

  for (const operation of renameOps) {
    const targetPath = operation.originalPath;
    if (!targetPath) continue;

    const blockingOp = renameOps.find(op => op.newPath === targetPath);
    if (blockingOp && blockingOp !== operation) {
      conflicts.push({ operation, blockingOperation: blockingOp });
    }
  }

  const executionOrder = calculateUndoOrder(renameOps, conflicts);

  return { conflicts, executionOrder };
}

function calculateUndoOrder(
  operations: FileOperation[],
  conflicts: Array<{ operation: FileOperation; blockingOperation: FileOperation }>
): FileOperation[] {
  const order: FileOperation[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const dependencies = new Map<string, string[]>();

  for (const conflict of conflicts) {
    if (!conflict.operation.id || !conflict.blockingOperation.id) continue;
    if (!dependencies.has(conflict.operation.id)) {
      dependencies.set(conflict.operation.id, []);
    }
    dependencies.get(conflict.operation.id)!.push(conflict.blockingOperation.id);
  }

  const operationMap = new Map(operations.map(op => [op.id, op]));

  const visit = (operationId: string | undefined, stack: string[] = []) => {
    if (!operationId || visited.has(operationId)) {
      return;
    }

    if (visiting.has(operationId)) {
      const cycleStartIndex = stack.indexOf(operationId);
      const cycle = stack.slice(cycleStartIndex).map(id => operationMap.get(id)?.originalName || id);
      console.warn(`⚠️ 检测到循环依赖: ${cycle.join(' -> ')}`);
      return;
    }

    visiting.add(operationId);
    stack.push(operationId);

    const deps = dependencies.get(operationId) || [];
    for (const depId of deps) {
      visit(depId, stack);
    }

    visiting.delete(operationId);
    stack.pop();
    visited.add(operationId);

    const operation = operationMap.get(operationId);
    if (operation) {
      order.push(operation);
    }
  };

  for (const operation of operations) {
    visit(operation.id);
  }

  return order;
}
