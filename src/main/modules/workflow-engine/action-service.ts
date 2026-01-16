import path from 'path';
import fs from 'fs-extra';
import type { Action, ActionConfig, AppFile } from '../../../shared/types';
import { getFileTypeCategory } from './file-type';
import { NamingService } from './naming-service';
import { WorkflowFileSystemService } from './filesystem-service';
import { convertToBytes } from './utils';

export interface CreatedFileInfo {
  path: string;
}

export type ActionExecutionOutcome = {
  finalPath?: string;
  deleted: boolean;
  operationType?: Action['type'];
  createdFiles?: CreatedFileInfo[];
};

export interface WorkflowActionDependencies {
  validatePath: (inputPath: string) => boolean;
  validateOperation: (sourcePath: string, targetPath: string | undefined, operation: string) => Promise<void>;
  categorizeError: (error: Error, operation: string, path: string) => string;
}

export class WorkflowActionService {
  constructor(
    private readonly fileSystem: WorkflowFileSystemService,
    private readonly namingService: NamingService,
    private readonly deps: WorkflowActionDependencies
  ) {}

  async calculateNewPathForExecution(currentPath: string, action: Action): Promise<string | undefined> {
    if (action.type === 'delete') {
      return undefined;
    }

    if (action.type === 'rename') {
      const fileInfo = path.parse(currentPath);
      const newName = await this.namingService.generateFileName(fileInfo.base, action.config, action.id, currentPath);
      return path.join(fileInfo.dir, newName);
    }

    let targetPath: string;
    const pathType =
      action.config.targetPathType || (action.config.targetPath ? 'specific_path' : 'input_folder');

    if (pathType === 'input_folder') {
      targetPath = path.dirname(currentPath);
    } else {
      if (!action.config.targetPath) {
        return currentPath;
      }

      if (!this.deps.validatePath(action.config.targetPath)) {
        throw new Error(`Invalid or unsafe target path: ${action.config.targetPath}`);
      }

      targetPath = action.config.targetPath;
    }

    const classificationPath = await this.generateClassificationPath(currentPath, action.config);
    if (classificationPath) {
      targetPath = path.join(targetPath, classificationPath);
    }

    if (action.config.preserveFolderStructure) {
      const fileName = path.basename(currentPath);
      return path.join(targetPath, fileName);
    }

    const fileInfo = path.parse(currentPath);
    const newFileName = await this.namingService.generateFileName(fileInfo.base, action.config, action.id, currentPath);

    return path.join(targetPath, newFileName);
  }

  async calculateNewPath(
    currentPath: string,
    action: Action,
    fileIndex: number = 0,
    file?: AppFile
  ): Promise<string | undefined> {
    if (action.type === 'delete') {
      return undefined;
    }

    if (action.type === 'rename') {
      const fileInfo = path.parse(currentPath);
      const newName = await this.namingService.generateFileNameForPreview(
        fileInfo.base,
        action.config,
        fileIndex,
        file
      );
      return path.join(fileInfo.dir, newName);
    }

    const fileInfo = path.parse(currentPath);
    let targetPath: string;
    const pathType =
      action.config.targetPathType || (action.config.targetPath ? 'specific_path' : 'input_folder');

    if (pathType === 'input_folder') {
      targetPath = path.dirname(currentPath);
    } else {
      if (!action.config.targetPath) {
        return currentPath;
      }

      if (!this.deps.validatePath(action.config.targetPath)) {
        throw new Error(`Invalid or unsafe target path: ${action.config.targetPath}`);
      }

      targetPath = action.config.targetPath;
    }

    const classificationPath = await this.generateClassificationPathForPreview(currentPath, action.config, file);
    if (classificationPath) {
      targetPath = path.join(targetPath, classificationPath);
    }

    if (action.config.preserveFolderStructure) {
      const fileName = path.basename(currentPath);
      return path.join(targetPath, fileName);
    }

    const newFileName = await this.namingService.generateFileNameForPreview(
      fileInfo.base,
      action.config,
      fileIndex,
      file
    );

    return path.join(targetPath, newFileName);
  }

  async previewActions(
    currentPath: string,
    actions: Action[],
    fileIndex: number = 0,
    file?: AppFile
  ): Promise<ActionExecutionOutcome> {
    let simulatedPath = currentPath;
    let fileExists = true;
    let lastOperation: Action['type'] | undefined;
    const createdFiles: CreatedFileInfo[] = [];

    for (const action of actions) {
      if (!action.enabled) {
        continue;
      }

      if (!fileExists) {
        break;
      }

      if (action.type === 'delete') {
        lastOperation = 'delete';
        fileExists = false;
        break;
      }

      const previewPath = await this.calculateNewPath(simulatedPath, action, fileIndex, file);

      switch (action.type) {
        case 'copy':
          if (previewPath) {
            createdFiles.push({ path: previewPath });
          }
          lastOperation = 'copy';
          break;

        case 'move':
        case 'rename':
          if (previewPath) {
            simulatedPath = previewPath;
          }
          lastOperation = action.type;
          break;

        case 'createFolder':
          if (previewPath) {
            createdFiles.push({ path: previewPath });
          }
          lastOperation = 'createFolder';
          break;

        default:
          if (previewPath) {
            simulatedPath = previewPath;
          }
          lastOperation = action.type;
          break;
      }
    }

    return {
      finalPath: fileExists ? simulatedPath : undefined,
      deleted: !fileExists,
      operationType: lastOperation,
      createdFiles: createdFiles.length > 0 ? createdFiles : undefined
    };
  }

  async executeActions(currentPath: string, actions: Action[]): Promise<ActionExecutionOutcome> {
    let resultPath = currentPath;
    let fileExists = true;
    let lastOperation: Action['type'] | undefined;
    const createdFiles: CreatedFileInfo[] = [];

    for (const action of actions) {
      if (!fileExists && action.type !== 'delete') {
        console.warn(`跳过动作 ${action.type}，因为文件已被删除: ${resultPath}`);
        continue;
      }

      const outcome = await this.executeAction(resultPath, action);

      if (outcome.operationType) {
        lastOperation = outcome.operationType;
      }

      if (outcome.deleted) {
        fileExists = false;
        resultPath = currentPath;
      } else if (outcome.finalPath && action.type !== 'copy') {
        resultPath = outcome.finalPath;
      }

      if (outcome.createdFiles?.length) {
        createdFiles.push(...outcome.createdFiles);
      }
    }

    return {
      finalPath: fileExists ? resultPath : undefined,
      deleted: !fileExists,
      operationType: lastOperation,
      createdFiles: createdFiles.length > 0 ? createdFiles : undefined
    };
  }

  private async executeAction(currentPath: string, action: Action): Promise<ActionExecutionOutcome> {
    if (!action.enabled) {
      return {
        finalPath: currentPath,
        deleted: false,
        operationType: undefined
      };
    }

    try {
      const newPath = await this.calculateNewPathForExecution(currentPath, action);

      await this.deps.validateOperation(currentPath, newPath, action.type);

      if (action.type === 'delete') {
        await this.executeDelete(currentPath, action.config);
        return {
          finalPath: undefined,
          deleted: true,
          operationType: 'delete'
        };
      }

      if (!newPath) {
        throw new Error(`无法为动作 ${action.type} 计算目标路径`);
      }

      if (action.config.createSubfolders !== false) {
        const targetDir = path.dirname(newPath);
        await this.fileSystem.ensureDirWithTracking(targetDir);
      }

      switch (action.type) {
        case 'move':
          await this.executeMove(currentPath, newPath);
          return {
            finalPath: newPath,
            deleted: false,
            operationType: 'move'
          };

        case 'copy':
          await this.executeCopy(currentPath, newPath, action.config);
          return {
            finalPath: currentPath,
            deleted: false,
            operationType: 'copy',
            createdFiles: [{ path: newPath }]
          };

        case 'rename':
          await this.executeMove(currentPath, newPath);
          return {
            finalPath: newPath,
            deleted: false,
            operationType: 'rename'
          };

        case 'createFolder':
          await this.fileSystem.ensureDirWithTracking(newPath);
          console.log(`创建文件夹: ${newPath}`);
          return {
            finalPath: newPath,
            deleted: false,
            operationType: 'createFolder'
          };

        default:
          return {
            finalPath: currentPath,
            deleted: false,
            operationType: action.type
          };
      }
    } catch (error) {
      console.error(`执行动作失败: ${action.type}`, error);
      const categorizedError = error instanceof Error
        ? this.deps.categorizeError(error, action.type, currentPath)
        : `${action.type}失败: ${currentPath} - ${String(error)}`;
      throw new Error(categorizedError);
    }
  }

  private async executeDelete(targetPath: string, config: ActionConfig): Promise<void> {
    try {
      const stat = await fs.stat(targetPath);

      const { default: trash } = await import('trash');

      if (stat.isDirectory()) {
        const items = await fs.readdir(targetPath);

        if (items.length > 0 && !config.deleteNonEmptyFolders) {
          throw new Error(`文件夹不为空，无法删除: ${targetPath}`);
        }

        await trash([targetPath]);
      } else {
        await trash([targetPath]);
      }

      console.log(`删除成功: ${targetPath}`);
    } catch (error) {
      console.error(`删除操作失败: ${targetPath}`, error);
      throw error;
    }
  }

  private async executeMove(sourcePath: string, targetPath: string): Promise<void> {
    try {
      const sourceDir = path.dirname(sourcePath);
      this.fileSystem.trackProcessedDirectory(sourceDir);

      const targetDir = path.dirname(targetPath);
      await this.fileSystem.ensureDirWithTracking(targetDir);

      const normalizedSource = path.normalize(sourcePath);
      const normalizedTarget = path.normalize(targetPath);

      if (normalizedSource !== normalizedTarget && await fs.pathExists(targetPath)) {
        const [sourceRealPath, targetRealPath] = await Promise.all([
          fs.realpath(sourcePath).catch(() => normalizedSource),
          fs.realpath(targetPath).catch(() => normalizedTarget)
        ]);

        if (sourceRealPath !== targetRealPath) {
          throw new Error(`目标已存在: ${targetPath}`);
        }
      }

      await fs.move(sourcePath, targetPath);
    } catch (error) {
      console.error(`移动操作失败: ${sourcePath} -> ${targetPath}`, error);
      throw error;
    }
  }

  private async executeCopy(sourcePath: string, targetPath: string, config: ActionConfig): Promise<void> {
    try {
      if (config.preserveFolderStructure) {
        const targetDir = path.dirname(targetPath);
        await this.fileSystem.ensureDirWithTracking(targetDir);
        await fs.copy(sourcePath, targetPath, { overwrite: true });
      } else {
        await fs.copy(sourcePath, targetPath, { overwrite: true });
      }
    } catch (error) {
      console.error(`复制操作失败: ${sourcePath} -> ${targetPath}`, error);
      throw error;
    }
  }

  private async generateClassificationPath(filePath: string, config: any): Promise<string> {
    const classifyBy =
      config.classifyBy ||
      (config.createSubfolders ? 'fileType' : null) ||
      (config.preserveFolderStructure ? 'preserveStructure' : null);

    if (!classifyBy || classifyBy === 'none') {
      return '';
    }

    const fileInfo = path.parse(filePath);

    switch (classifyBy) {
      case 'fileType':
        return getFileTypeCategory(fileInfo.ext.slice(1));

      case 'createdDate':
      case 'modifiedDate': {
        try {
          const stat = await fs.stat(filePath);
          const date = classifyBy === 'createdDate' ? stat.birthtime : stat.mtime;
          return this.generateDateFolderPath(date, config.dateGrouping || 'yearMonth');
        } catch (error) {
          console.warn(`无法获取文件日期: ${filePath}`, error);
          return '未知日期';
        }
      }

      case 'fileSize': {
        try {
          const stat = await fs.stat(filePath);
          return this.generateSizeFolderPath(stat.size, config);
        } catch (error) {
          console.warn(`无法获取文件大小: ${filePath}`, error);
          return '未知大小';
        }
      }

      case 'extension': {
        const ext = fileInfo.ext.slice(1).toLowerCase();
        return ext || '无扩展名';
      }

      case 'preserveStructure':
        return '';

      default:
        return '';
    }
  }

  private async generateClassificationPathForPreview(
    filePath: string,
    config: any,
    file?: AppFile
  ): Promise<string> {
    const classifyBy =
      config.classifyBy ||
      (config.createSubfolders ? 'fileType' : null) ||
      (config.preserveFolderStructure ? 'preserveStructure' : null);

    if (!classifyBy || classifyBy === 'none') {
      return '';
    }

    const fileInfo = path.parse(filePath);

    switch (classifyBy) {
      case 'fileType':
        return getFileTypeCategory(fileInfo.ext.slice(1));

      case 'createdDate':
        if (file?.createdDate) {
          const date = new Date(file.createdDate);
          return this.generateDateFolderPath(date, config.dateGrouping || 'yearMonth');
        }
        try {
          const stat = await fs.stat(filePath);
          return this.generateDateFolderPath(stat.birthtime, config.dateGrouping || 'yearMonth');
        } catch (error) {
          return '未知日期';
        }

      case 'modifiedDate':
        if (file?.modifiedDate) {
          const date = new Date(file.modifiedDate);
          return this.generateDateFolderPath(date, config.dateGrouping || 'yearMonth');
        }
        try {
          const stat = await fs.stat(filePath);
          return this.generateDateFolderPath(stat.mtime, config.dateGrouping || 'yearMonth');
        } catch (error) {
          return '未知日期';
        }

      case 'fileSize': {
        const size = file?.size;
        if (size !== undefined) {
          return this.generateSizeFolderPath(size, config);
        }
        try {
          const stat = await fs.stat(filePath);
          return this.generateSizeFolderPath(stat.size, config);
        } catch (error) {
          return '未知大小';
        }
      }

      case 'extension': {
        const ext = fileInfo.ext.slice(1).toLowerCase();
        return ext || '无扩展名';
      }

      case 'preserveStructure':
        return '';

      default:
        return '';
    }
  }

  private generateDateFolderPath(date: Date, grouping: string): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];

    switch (grouping) {
      case 'year':
        return year.toString();
      case 'yearMonth':
        return path.join(year.toString(), month);
      case 'yearMonthDay':
        return path.join(year.toString(), month, day);
      case 'quarter':
        return path.join(year.toString(), `Q${quarter}`);
      case 'monthName':
        return path.join(year.toString(), monthNames[date.getMonth()]);
      default:
        return path.join(year.toString(), month);
    }
  }

  private generateSizeFolderPath(sizeBytes: number, config: any): string {
    const sizeMB = sizeBytes / (1024 * 1024);
    const sizeGB = sizeMB / 1024;

    if (config.sizeClassifyMode === 'custom' && config.customSizeRanges) {
      for (const range of config.customSizeRanges) {
        const minBytes = convertToBytes(range.minSize, range.unit);
        const maxBytes = range.maxSize === -1 ? Infinity : convertToBytes(range.maxSize, range.unit);
        if (sizeBytes >= minBytes && sizeBytes <= maxBytes) {
          return range.folderName;
        }
      }
      return '其他大小';
    }

    const preset = config.sizePreset || 'general';

    switch (preset) {
      case 'general':
        if (sizeMB < 1) return '小文件';
        if (sizeMB < 100) return '中等文件';
        if (sizeGB < 1) return '大文件';
        return '超大文件';

      case 'photo':
        if (sizeBytes < 100 * 1024) return '缩略图';
        if (sizeMB < 5) return '普通照片';
        if (sizeMB < 50) return '高清照片';
        return 'RAW文件';

      case 'video':
        if (sizeMB < 50) return '短视频';
        if (sizeMB < 500) return '标清视频';
        if (sizeGB < 2) return '高清视频';
        return '4K视频';

      default:
        return '未分类';
    }
  }

}
