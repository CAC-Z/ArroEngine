import fs from 'fs-extra';
import path from 'path';

export interface OperationStep {
  id: string;
  type: 'file_move' | 'file_copy' | 'file_delete' | 'folder_create' | 'folder_delete' | 'history_update';
  sourcePath?: string;
  targetPath?: string;
  backupPath?: string;
  metadata?: any;
  timestamp: number;
  completed: boolean;
  partiallyCompleted?: boolean;
  inProgress?: boolean;
  tempFiles?: string[];
  rollbackData?: any;
}

export async function cleanupCreatedDirectories(createdDirectories: string[]): Promise<void> {
  if (!createdDirectories || createdDirectories.length === 0) {
    console.log('没有需要清理的工作流创建文件夹');
    return;
  }

  console.log(`开始清理 ${createdDirectories.length} 个工作流创建的文件夹...`);
  console.log('待清理的文件夹列表:', createdDirectories);

  const sortedDirs = [...createdDirectories].sort((a, b) => {
    const depthA = a.split(path.sep).length;
    const depthB = b.split(path.sep).length;
    return depthB - depthA;
  });

  let cleanedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const dirPath of sortedDirs) {
    try {
      if (!await fs.pathExists(dirPath)) {
        console.log(`📂 文件夹已不存在，跳过: ${dirPath}`);
        continue;
      }

      const items = await fs.readdir(dirPath);
      if (items.length === 0) {
        await fs.rmdir(dirPath);
        cleanedCount++;
        console.log(`✅ 已清理空文件夹: ${dirPath}`);
      } else {
        skippedCount++;
        console.log(`⚠️ 文件夹不为空，跳过清理: ${dirPath} (包含 ${items.length} 个项目: ${items.slice(0, 3).join(', ')}${items.length > 3 ? '...' : ''})`);

        const onlyContainsCreatedDirs = items.every(item => {
          const itemPath = path.join(dirPath, item);
          return createdDirectories.includes(itemPath);
        });

        if (onlyContainsCreatedDirs) {
          console.log(`🔍 文件夹 ${dirPath} 只包含工作流创建的子文件夹，将在子文件夹清理后重新检查`);
        }
      }
    } catch (error) {
      const errorMsg = `清理文件夹失败 ${dirPath}: ${error instanceof Error ? error.message : String(error)}`;
      console.warn(errorMsg);
      errors.push(errorMsg);
    }
  }

  console.log(`🔄 开始第二轮清理，检查是否有文件夹在第一轮清理后变为空...`);
  let secondRoundCleaned = 0;

  for (const dirPath of sortedDirs) {
    try {
      if (await fs.pathExists(dirPath)) {
        const items = await fs.readdir(dirPath);
        if (items.length === 0) {
          await fs.rmdir(dirPath);
          secondRoundCleaned++;
          cleanedCount++;
          console.log(`✅ 第二轮清理空文件夹: ${dirPath}`);
        }
      }
    } catch (error) {
      const errorMsg = `第二轮清理文件夹失败 ${dirPath}: ${error instanceof Error ? error.message : String(error)}`;
      console.warn(errorMsg);
      errors.push(errorMsg);
    }
  }

  if (secondRoundCleaned > 0) {
    console.log(`🎯 第二轮清理了 ${secondRoundCleaned} 个文件夹`);
  }

  console.log(`📊 文件夹清理完成:`);
  console.log(`  - 成功清理: ${cleanedCount} 个空文件夹`);
  console.log(`  - 跳过清理: ${skippedCount} 个非空文件夹`);
  console.log(`  - 清理错误: ${errors.length} 个`);

  if (cleanedCount > 0) {
    console.log(`✅ 成功清理了 ${cleanedCount} 个工作流创建的空文件夹`);
  } else {
    console.log(`ℹ️ 没有发现需要清理的空文件夹`);
  }

  if (errors.length > 0) {
    console.warn(`清理过程中发生 ${errors.length} 个错误，但不影响撤销操作:`);
    errors.forEach(error => console.warn(`  - ${error}`));
  }
}

export async function restoreCleanedEmptyDirectories(cleanedEmptyDirectories: string[]): Promise<void> {
  if (!cleanedEmptyDirectories || cleanedEmptyDirectories.length === 0) {
    console.log('没有需要恢复的空文件夹');
    return;
  }

  console.log(`开始恢复 ${cleanedEmptyDirectories.length} 个被清理的空文件夹...`);
  console.log('待恢复的文件夹列表:', cleanedEmptyDirectories);

  const sortedDirs = [...cleanedEmptyDirectories].sort((a, b) => {
    const depthA = a.split(path.sep).length;
    const depthB = b.split(path.sep).length;
    return depthA - depthB;
  });

  let restoredCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const dirPath of sortedDirs) {
    try {
      if (await fs.pathExists(dirPath)) {
        console.log(`📂 文件夹已存在，跳过恢复: ${dirPath}`);
        skippedCount++;
        continue;
      }

      await fs.ensureDir(dirPath);
      restoredCount++;
      console.log(`✅ 已恢复空文件夹: ${dirPath}`);
    } catch (error) {
      const errorMsg = `恢复空文件夹失败 ${dirPath}: ${error instanceof Error ? error.message : String(error)}`;
      console.warn(errorMsg);
      errors.push(errorMsg);
    }
  }

  console.log(`📊 空文件夹恢复完成:`);
  console.log(`  - 成功恢复: ${restoredCount} 个空文件夹`);
  console.log(`  - 跳过恢复: ${skippedCount} 个已存在的文件夹`);
  console.log(`  - 恢复错误: ${errors.length} 个`);

  if (restoredCount > 0) {
    console.log(`✅ 成功恢复了 ${restoredCount} 个被清理的空文件夹`);
  } else {
    console.log(`ℹ️ 没有需要恢复的空文件夹或文件夹已存在`);
  }

  if (errors.length > 0) {
    console.warn(`恢复过程中发生 ${errors.length} 个错误，但不影响撤销操作:`);
    errors.forEach(error => console.warn(`  - ${error}`));
  }
}

export async function cleanupPartialStep(step: OperationStep): Promise<void> {
  console.log(`🧹 清理部分完成的步骤: ${step.type} - ${step.id}`);

  if (step.tempFiles && step.tempFiles.length > 0) {
    for (const tempFile of step.tempFiles) {
      try {
        if (await fs.pathExists(tempFile)) {
          await fs.remove(tempFile);
          console.log(`   🗑️ 清理临时文件: ${tempFile}`);
        }
      } catch (error) {
        console.warn(`   ⚠️ 清理临时文件失败: ${tempFile}`, error);
      }
    }
  }

  switch (step.type) {
    case 'file_move':
      if (step.targetPath && step.sourcePath) {
        if (await fs.pathExists(step.targetPath) && !await fs.pathExists(step.sourcePath)) {
          try {
            await fs.move(step.targetPath, step.sourcePath);
            console.log(`   ↩️ 恢复部分移动的文件: ${step.targetPath} -> ${step.sourcePath}`);
          } catch (error) {
            console.warn(`   ⚠️ 恢复部分移动失败`, error);
          }
        }
      }
      break;

    case 'file_copy':
      if (step.targetPath && await fs.pathExists(step.targetPath)) {
        try {
          await fs.remove(step.targetPath);
          console.log(`   🗑️ 删除部分复制的文件: ${step.targetPath}`);
        } catch (error) {
          console.warn(`   ⚠️ 删除部分复制失败`, error);
        }
      }
      break;

    case 'folder_create':
      if (step.targetPath && await fs.pathExists(step.targetPath)) {
        try {
          const items = await fs.readdir(step.targetPath);
          if (items.length === 0) {
            await fs.rmdir(step.targetPath);
            console.log(`   🗑️ 删除部分创建的空文件夹: ${step.targetPath}`);
          }
        } catch (error) {
          console.warn(`   ⚠️ 删除部分创建的文件夹失败`, error);
        }
      }
      break;
  }
}

export async function abortInProgressStep(step: OperationStep): Promise<void> {
  console.log(`⏹️ 中止正在进行的步骤: ${step.type} - ${step.id}`);
  step.inProgress = false;
  step.partiallyCompleted = true;
  await cleanupPartialStep(step);
}

export async function cleanupUnstartedStep(step: OperationStep): Promise<void> {
  console.log(`🗑️ 清理未开始的步骤: ${step.type} - ${step.id}`);

  if (step.tempFiles && step.tempFiles.length > 0) {
    for (const tempFile of step.tempFiles) {
      try {
        if (await fs.pathExists(tempFile)) {
          await fs.remove(tempFile);
          console.log(`   🗑️ 清理预分配的临时文件: ${tempFile}`);
        }
      } catch (error) {
        console.warn(`   ⚠️ 清理预分配文件失败: ${tempFile}`, error);
      }
    }
  }

  if (step.metadata) {
    console.log(`   📋 清理步骤元数据: ${JSON.stringify(step.metadata)}`);
  }
}
