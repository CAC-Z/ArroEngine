import path from 'path';
import fs from 'fs-extra';
export class WorkflowFileSystemService {
  private readonly createdDirectories = new Set<string>();
  private readonly processedDirectories = new Set<string>();
  private readonly cleanedEmptyDirectories = new Set<string>();

  trackProcessedDirectory(dirPath: string): void {
    this.processedDirectories.add(dirPath);
  }

  async ensureDirWithTracking(dirPath: string): Promise<void> {
    const exists = await fs.pathExists(dirPath);

    if (!exists) {
      const dirsToCreate: string[] = [];
      let currentPath = dirPath;

      while (currentPath && currentPath !== path.dirname(currentPath)) {
        if (!await fs.pathExists(currentPath)) {
          dirsToCreate.unshift(currentPath);
        } else {
          break;
        }
        currentPath = path.dirname(currentPath);
      }

      await fs.ensureDir(dirPath);

      for (const dir of dirsToCreate) {
        this.createdDirectories.add(dir);
        console.log(`📁 跟踪创建的目录: ${dir}`);
      }
    }
  }

  async cleanupCreatedEmptyDirectories(): Promise<void> {
    if (this.createdDirectories.size === 0) {
      return;
    }

    console.log(`开始清理 ${this.createdDirectories.size} 个可能的空文件夹...`);

    const sortedDirs = Array.from(this.createdDirectories).sort((a, b) => {
      const depthA = a.split(path.sep).length;
      const depthB = b.split(path.sep).length;
      return depthB - depthA;
    });

    let cleanedCount = 0;

    for (const dirPath of sortedDirs) {
      try {
        if (!await fs.pathExists(dirPath)) {
          continue;
        }

        const items = await fs.readdir(dirPath);
        if (items.length === 0) {
          await fs.rmdir(dirPath);
          cleanedCount++;
          console.log(`已清理空文件夹: ${dirPath}`);
        }
      } catch (error) {
        console.warn(`清理文件夹失败 ${dirPath}:`, error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`✅ 成功清理了 ${cleanedCount} 个空文件夹`);
    } else {
      console.log('ℹ️ 没有发现需要清理的空文件夹');
    }
  }

  async cleanupAllProcessedEmptyDirectories(): Promise<void> {
    if (this.processedDirectories.size === 0) {
      console.log('ℹ️ 没有处理过程中的目录需要检查');
      return;
    }

    console.log(`开始检查 ${this.processedDirectories.size} 个处理过程中的目录...`);

    const sortedDirs = Array.from(this.processedDirectories).sort((a, b) => {
      const depthA = a.split(path.sep).length;
      const depthB = b.split(path.sep).length;
      return depthB - depthA;
    });

    let cleanedCount = 0;

    for (const dirPath of sortedDirs) {
      try {
        if (!await fs.pathExists(dirPath)) {
          continue;
        }

        const items = await fs.readdir(dirPath);
        if (items.length === 0) {
          await fs.rmdir(dirPath);
          cleanedCount++;
          this.cleanedEmptyDirectories.add(dirPath);
          console.log(`已清理空文件夹: ${dirPath}`);

          await this.checkAndCleanupParentDirectory(dirPath, true);
        }
      } catch (error) {
        console.warn(`清理文件夹失败 ${dirPath}:`, error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`✅ 成功清理了 ${cleanedCount} 个处理过程中的空文件夹`);
    } else {
      console.log('ℹ️ 处理过程中的目录都不为空，无需清理');
    }
  }

  private async checkAndCleanupParentDirectory(childPath: string, trackCleaned: boolean = false): Promise<void> {
    const parentPath = path.dirname(childPath);

    if (parentPath === childPath || parentPath === '/' || parentPath.match(/^[A-Z]:\\?$/)) {
      return;
    }

    try {
      if (await fs.pathExists(parentPath)) {
        const items = await fs.readdir(parentPath);
        if (items.length === 0) {
          await fs.rmdir(parentPath);
          console.log(`已清理空的父文件夹: ${parentPath}`);

          if (trackCleaned) {
            this.cleanedEmptyDirectories.add(parentPath);
          }

          await this.checkAndCleanupParentDirectory(parentPath, trackCleaned);
        }
      }
    } catch (error) {
      console.warn(`清理父文件夹失败 ${parentPath}:`, error);
    }
  }

  async isEmptyDirectory(dirPath: string): Promise<boolean> {
    try {
      if (!await fs.pathExists(dirPath)) {
        return false;
      }

      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) {
        return false;
      }

      const items = await fs.readdir(dirPath);
      return items.length === 0;
    } catch (error) {
      console.warn(`检查目录是否为空时出错 ${dirPath}:`, error);
      return false;
    }
  }

  getCreatedDirectories(): string[] {
    return Array.from(this.createdDirectories);
  }

  getAndPreserveCreatedDirectories(): string[] {
    const directories = Array.from(this.createdDirectories);
    console.log('🔒 保存创建的文件夹列表用于历史记录:', directories);
    return directories;
  }

  clearCreatedDirectories(): void {
    console.log('🧹 清空创建的文件夹跟踪列表');
    this.createdDirectories.clear();
  }

  getCleanedEmptyDirectories(): string[] {
    return Array.from(this.cleanedEmptyDirectories);
  }

  getAndPreserveCleanedEmptyDirectories(): string[] {
    const directories = Array.from(this.cleanedEmptyDirectories);
    console.log('🔒 保存被清理的空文件夹列表用于历史记录:', directories);
    console.log('🔒 这些文件夹将在撤销时被恢复');
    return directories;
  }

  clearCleanedEmptyDirectories(): void {
    console.log('🧹 清空被清理空文件夹的跟踪列表');
    this.cleanedEmptyDirectories.clear();
  }

  clearProcessedDirectories(): void {
    this.processedDirectories.clear();
  }

  clearTrackingData(): void {
    this.createdDirectories.clear();
    this.processedDirectories.clear();
    this.cleanedEmptyDirectories.clear();
  }
}
