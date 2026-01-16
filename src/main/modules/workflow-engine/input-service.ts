import path from 'path';
import crypto from 'crypto';
import fs from 'fs-extra';
import type {
  AppFile,
  DropGroup,
  ProcessStep,
  StepResult,
  Workflow
} from '../../../shared/types';

export interface WorkflowInputDependencies {
  validatePath: (inputPath: string) => boolean;
}

export class WorkflowInputService {
  private readonly dirScanCache = new Map<string, { files: AppFile[]; timestamp: number }>();
  private readonly CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5分钟
  private readonly MAX_CACHE_SIZE = 100; // 最大缓存条目数

  constructor(private readonly deps: WorkflowInputDependencies) {}

  clearCache(): void {
    this.dirScanCache.clear();
  }

  findMatchingProcessTargets(files: AppFile[], processTarget: 'files' | 'folders' | 'both'): AppFile[] {
    return this.filterFilesByProcessTarget(files, processTarget);
  }

  filterFilesByProcessTarget(
    files: AppFile[],
    processTarget: 'files' | 'folders' | 'both'
  ): AppFile[] {
    switch (processTarget) {
      case 'files':
        return files.filter(file => !file.isDirectory);
      case 'folders':
        return files.filter(file => file.isDirectory);
      case 'both':
        return files;
      default:
        return files.filter(file => !file.isDirectory);
    }
  }

  filterFilesByWorkflow(files: AppFile[], workflow: Workflow): AppFile[] {
    if (!workflow.steps || workflow.steps.length === 0) {
      return files;
    }

    const enabledSteps = workflow.steps.filter(step => step.enabled);
    if (enabledSteps.length === 0) {
      return files;
    }

    const processTargets = enabledSteps.map(step => step.processTarget || 'files');

    if (processTargets.includes('files') && processTargets.includes('folders')) {
      return files;
    }

    if (processTargets.includes('folders')) {
      return files.filter(file => file.isDirectory);
    }

    return files.filter(file => !file.isDirectory);
  }

  async getStepInputFiles(
    currentFiles: AppFile[],
    step: ProcessStep,
    stepResults: StepResult[],
    initialFiles?: AppFile[]
  ): Promise<AppFile[]> {
    let inputFiles: AppFile[] = [];

    switch (step.inputSource.type) {
      case 'original':
        inputFiles = initialFiles || currentFiles;
        break;

      case 'previous_step':
        if (step.inputSource.stepId) {
          const previousStep = stepResults.find(result => result.stepId === step.inputSource.stepId);
          inputFiles = previousStep ? previousStep.outputFiles : [];
        } else {
          inputFiles = stepResults.length > 0 ? stepResults[stepResults.length - 1].outputFiles : currentFiles;
        }
        break;

      case 'specific_path':
        if (step.inputSource.path) {
          const processSubfolders =
            step.actions.length > 0 ? (step.actions[0].config?.processSubfolders ?? true) : true;
          const maxDepth = step.actions.length > 0 ? (step.actions[0].config?.maxDepth ?? -1) : -1;

          const loadedItems = await this.loadItemsFromPath(
            step.inputSource.path,
            step.processTarget || 'files',
            processSubfolders,
            maxDepth
          );

          inputFiles = loadedItems.map(file => ({
            ...file,
            id: this.generateFileId(file.path)
          }));
        } else {
          console.warn('特定路径输入源未配置路径，使用当前文件');
          inputFiles = currentFiles;
        }
        break;

      default:
        inputFiles = currentFiles;
        break;
    }

    const filteredByTarget = this.filterFilesByProcessTarget(inputFiles, step.processTarget || 'files');
    return filteredByTarget.filter(file => !file.deleted);
  }

  async createDropGroupsFromPaths(paths: string[], workflow: Workflow): Promise<DropGroup[]> {
    const dropGroups: DropGroup[] = [];

    for (const rootPath of paths) {
      try {
        if (!this.deps.validatePath(rootPath)) {
          console.warn(`跳过不安全的路径: ${rootPath}`);
          continue;
        }

        if (!await fs.pathExists(rootPath)) {
          console.warn(`跳过不存在的路径: ${rootPath}`);
          continue;
        }

        const stat = await fs.stat(rootPath);
        const dropGroup: DropGroup = {
          rootPath,
          files: []
        };

        if (stat.isDirectory()) {
          try {
            const contentFiles = await this.loadItemsFromPath(rootPath, 'both', true, -1);
            dropGroup.files = contentFiles;
          } catch (contentError) {
            console.warn(`扫描文件夹内容失败: ${rootPath}`, contentError);
          }
        } else {
          const fileAppFile = await this.getItemInfo(rootPath);
          dropGroup.files = [fileAppFile];
        }

        dropGroup.files = this.filterFilesByWorkflow(dropGroup.files, workflow);

        dropGroups.push(dropGroup);
      } catch (error) {
        console.warn(`处理路径失败，跳过: ${rootPath}`, error);
        continue;
      }
    }

    return dropGroups;
  }

  async createAppFilesFromPaths(paths: string[]): Promise<AppFile[]> {
    const allAppFiles: AppFile[] = [];

    for (const targetPath of paths) {
      try {
        if (!this.deps.validatePath(targetPath)) {
          console.warn(`跳过不安全的路径: ${targetPath}`);
          continue;
        }

        if (!await fs.pathExists(targetPath)) {
          console.warn(`跳过不存在的路径: ${targetPath}`);
          continue;
        }

        const stat = await fs.stat(targetPath);

        if (stat.isDirectory()) {
          const dirAppFile = await this.getItemInfo(targetPath);
          allAppFiles.push(dirAppFile);

          try {
            const contentFiles = await this.loadItemsFromPath(targetPath, 'both', true, -1);
            allAppFiles.push(...contentFiles);
          } catch (contentError) {
            console.warn(`扫描目录内容失败，但目录本身已添加: ${targetPath}`, contentError);
          }
        } else {
          const fileAppFile = await this.getItemInfo(targetPath);
          allAppFiles.push(fileAppFile);
        }
      } catch (error) {
        console.warn(`处理路径失败，跳过: ${targetPath}`, error);
        continue;
      }
    }

    return allAppFiles;
  }

  async loadItemsFromPath(
    targetPath: string,
    processTarget: 'files' | 'folders' | 'both' = 'files',
    processSubfolders: boolean = true,
    maxDepth: number = -1
  ): Promise<AppFile[]> {
    if (!this.deps.validatePath(targetPath)) {
      throw new Error(`路径不安全或无效: ${targetPath}`);
    }

    if (!await fs.pathExists(targetPath)) {
      throw new Error(`路径不存在: ${targetPath}`);
    }

    const stat = await fs.stat(targetPath);
    const items: AppFile[] = [];

    if (stat.isDirectory()) {
      try {
        await fs.access(targetPath, fs.constants.R_OK);
      } catch (error) {
        throw new Error(`没有读取目录的权限: ${targetPath}`);
      }

      const itemPaths = await this.getAllItemsInDirectory(
        targetPath,
        undefined,
        processTarget,
        processSubfolders,
        maxDepth
      );

      for (const itemPath of itemPaths) {
        try {
          const itemInfo = await this.getItemInfo(itemPath);
          items.push(itemInfo);
        } catch (itemError) {
          console.warn(`跳过无法读取的项目: ${itemPath}`, itemError);
        }
      }
    } else {
      if (processTarget === 'files' || processTarget === 'both') {
        items.push(await this.getItemInfo(targetPath));
      }
    }

    return items;
  }

  async rescanOriginalDirectories(
    currentFiles: AppFile[],
    processTarget: 'files' | 'folders' | 'both' = 'files',
    processSubfolders: boolean = true,
    maxDepth: number = -1
  ): Promise<AppFile[]> {
    const originalDirGroups = new Map<string, AppFile[]>();

    for (const file of currentFiles) {
      const originalDir = file.originalDir || (file.isDirectory ? file.path : path.dirname(file.path));
      if (!originalDirGroups.has(originalDir)) {
        originalDirGroups.set(originalDir, []);
      }
      originalDirGroups.get(originalDir)!.push(file);
    }

    const scanPromises = Array.from(originalDirGroups.keys()).map(async originalDir => {
      try {
        return await this.loadItemsFromPathWithCache(
          originalDir,
          processTarget,
          processSubfolders,
          maxDepth
        );
      } catch (error) {
        console.warn(`重新扫描目录失败: ${originalDir}`, error);
        return [];
      }
    });

    const results = await Promise.all(scanPromises);
    return results.flat();
  }

  private async loadItemsFromPathWithCache(
    targetPath: string,
    processTarget: 'files' | 'folders' | 'both',
    processSubfolders: boolean,
    maxDepth: number
  ): Promise<AppFile[]> {
    const cacheKey = `${targetPath}:${processTarget}:${processSubfolders}:${maxDepth}`;
    const cached = this.dirScanCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < 5000) {
      return cached.files;
    }

    const files = await this.loadItemsFromPath(targetPath, processTarget, processSubfolders, maxDepth);

    this.cleanupCache();

    this.dirScanCache.set(cacheKey, { files, timestamp: now });
    return files;
  }

  private cleanupCache(): void {
    const now = Date.now();

    for (const [key, value] of this.dirScanCache.entries()) {
      if (now - value.timestamp > this.CACHE_EXPIRY_TIME) {
        this.dirScanCache.delete(key);
      }
    }

    if (this.dirScanCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.dirScanCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, this.dirScanCache.size - this.MAX_CACHE_SIZE);
      toDelete.forEach(([key]) => this.dirScanCache.delete(key));
    }
  }

  private async getAllItemsInDirectory(
    dirPath: string,
    maxItems: number | undefined,
    processTarget: 'files' | 'folders' | 'both',
    processSubfolders: boolean,
    maxDepth: number
  ): Promise<string[]> {
    const items: string[] = [];

    const processDirectory = async (currentPath: string, currentDepth: number = 0): Promise<void> => {
      if (maxItems && items.length >= maxItems) {
        return;
      }

      if (maxDepth !== -1 && currentDepth >= maxDepth) {
        return;
      }

      try {
        const dirItems = await fs.readdir(currentPath);
        const sortedItems = dirItems.sort((a, b) =>
          a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: 'base'
          })
        );

        for (const item of sortedItems) {
          if (maxItems && items.length >= maxItems) {
            break;
          }

          const fullPath = path.join(currentPath, item);

          try {
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
              if (processTarget === 'folders' || processTarget === 'both') {
                items.push(fullPath);
              }

              if (processSubfolders) {
                await processDirectory(fullPath, currentDepth + 1);
              }
            } else if (processTarget === 'files' || processTarget === 'both') {
              items.push(fullPath);
            }
          } catch (error) {
            console.warn(`Error processing ${fullPath}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${currentPath}:`, error);
      }
    };

    await processDirectory(dirPath, 0);

    if (processTarget === 'folders' && items.length > 1) {
      return items.sort((a, b) => {
        const depthA = a.split(path.sep).length;
        const depthB = b.split(path.sep).length;
        if (depthA !== depthB) {
          return depthB - depthA;
        }
        return a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });
    }

    return items.sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    );
  }

  private async isLogicallyEmpty(
    folderPath: string,
    visitedPaths: Set<string> = new Set()
  ): Promise<boolean> {
    const realPath = await fs.realpath(folderPath).catch(() => folderPath);
    if (visitedPaths.has(realPath)) {
      return true;
    }

    visitedPaths.add(realPath);

    try {
      const items = await fs.readdir(folderPath);

      for (const item of items) {
        const itemPath = path.join(folderPath, item);
        try {
          const itemStat = await fs.lstat(itemPath);

          if (itemStat.isSymbolicLink()) {
            continue;
          }

          if (!itemStat.isDirectory()) {
            visitedPaths.delete(realPath);
            return false;
          }

          if (!(await this.isLogicallyEmpty(itemPath, visitedPaths))) {
            visitedPaths.delete(realPath);
            return false;
          }
        } catch (error) {
          console.warn(`Error checking item ${itemPath}:`, error);
          visitedPaths.delete(realPath);
          return false;
        }
      }

      visitedPaths.delete(realPath);
      return true;
    } catch (error) {
      console.warn(`Error reading directory ${folderPath}:`, error);
      visitedPaths.delete(realPath);
      return false;
    }
  }

  private async calculateFolderSize(
    folderPath: string,
    visitedPaths: Set<string> = new Set()
  ): Promise<{ size: number; fileCount: number; folderCount: number }> {
    const realPath = await fs.realpath(folderPath).catch(() => folderPath);
    if (visitedPaths.has(realPath)) {
      console.warn(`Circular reference detected: ${folderPath}`);
      return { size: 0, fileCount: 0, folderCount: 0 };
    }

    visitedPaths.add(realPath);

    let totalSize = 0;
    let totalFileCount = 0;
    let totalFolderCount = 0;

    try {
      const items = await fs.readdir(folderPath);

      for (const item of items) {
        const itemPath = path.join(folderPath, item);
        try {
          const itemStat = await fs.lstat(itemPath);

          if (itemStat.isSymbolicLink()) {
            continue;
          }

          if (itemStat.isDirectory()) {
            totalFolderCount++;
            const subResult = await this.calculateFolderSize(itemPath, visitedPaths);
            totalSize += subResult.size;
            totalFileCount += subResult.fileCount;
            totalFolderCount += subResult.folderCount;
          } else {
            totalFileCount++;
            totalSize += itemStat.size;
          }
        } catch (error) {
          console.warn(`Error processing item ${itemPath}:`, error);
        }
      }
    } catch (error) {
      console.warn(`Error reading directory ${folderPath}:`, error);
    }

    visitedPaths.delete(realPath);
    return { size: totalSize, fileCount: totalFileCount, folderCount: totalFolderCount };
  }

  private calculateDepth(itemPath: string, basePath?: string): number {
    if (!basePath) {
      basePath = path.parse(itemPath).root;
    }

    const relativePath = path.relative(basePath, itemPath);
    if (!relativePath || relativePath === '') {
      return 0;
    }

    return relativePath.split(path.sep).length;
  }

  private generateFileId(filePath: string): string {
    const hash = crypto.createHash('md5').update(filePath).digest('hex');
    return `file_${hash.substring(0, 16)}`;
  }

  private async getItemInfo(itemPath: string, originalDir?: string): Promise<AppFile> {
    try {
      const stat = await fs.lstat(itemPath);
      const isDirectory = stat.isDirectory();
      const parsedPath = path.parse(itemPath);

      let fileCount = 0;
      let folderCount = 0;
      let totalSize = stat.size;
      let isEmpty = false;

      if (isDirectory) {
        const items = await fs.readdir(itemPath);
        const physicallyEmpty = items.length === 0;

        if (physicallyEmpty) {
          isEmpty = true;
        } else {
          const folderStats = await this.calculateFolderSize(itemPath);
          totalSize = folderStats.size;
          fileCount = folderStats.fileCount;
          folderCount = folderStats.folderCount;
          isEmpty = await this.isLogicallyEmpty(itemPath);
        }
      }

      return {
        id: this.generateFileId(itemPath),
        name: parsedPath.base,
        path: itemPath,
        type: parsedPath.ext.slice(1).toLowerCase() || (isDirectory ? 'folder' : 'unknown'),
        status: 'pending',
        createdDate: stat.birthtime.toISOString(),
        modifiedDate: stat.mtime.toISOString(),
        size: totalSize,
        isDirectory,
        isEmpty,
        fileCount,
        folderCount,
        originalDir: originalDir || parsedPath.dir,
        depth: this.calculateDepth(itemPath)
      };
    } catch (error) {
      console.error(`Error getting item info for ${itemPath}:`, error);
      const parsedPath = path.parse(itemPath);

      return {
        id: this.generateFileId(itemPath),
        name: parsedPath.base,
        path: itemPath,
        size: 0,
        type: parsedPath.ext.slice(1).toLowerCase() || 'unknown',
        status: 'error',
        error: 'Failed to get item info',
        createdDate: new Date().toISOString(),
        isDirectory: false,
        originalDir: originalDir || path.dirname(itemPath)
      };
    }
  }
}
