import path from 'path';
import fs from 'fs-extra';

export interface WorkflowSafetyDependencies {
  translate: (key: string, params?: Record<string, any>) => string;
}

export class WorkflowSafetyService {
  constructor(private readonly deps: WorkflowSafetyDependencies) {}

  validatePath(inputPath: string): boolean {
    try {
      const normalizedPath = path.normalize(inputPath);

      if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
        console.warn(`Potentially unsafe path detected: ${inputPath}`);
        return false;
      }

      if (!path.isAbsolute(normalizedPath)) {
        console.warn(`Relative path not allowed: ${inputPath}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Path validation error: ${error}`);
      return false;
    }
  }

  async checkPermissions(itemPath: string, operation: 'read' | 'write' | 'both' = 'both'): Promise<boolean> {
    try {
      let mode = fs.constants.F_OK;

      if (operation === 'read' || operation === 'both') {
        mode |= fs.constants.R_OK;
      }

      if (operation === 'write' || operation === 'both') {
        mode |= fs.constants.W_OK;
      }

      await fs.access(itemPath, mode);
      return true;
    } catch (error) {
      console.warn(`Permission denied for ${operation} operation on: ${itemPath}`);
      return false;
    }
  }

  async validateOperation(sourcePath: string, targetPath: string | undefined, operation: string): Promise<void> {
    if (!(await fs.pathExists(sourcePath))) {
      throw new Error(`源路径不存在: ${sourcePath}`);
    }

    if (!(await this.checkPermissions(sourcePath, 'read'))) {
      throw new Error(`没有读取权限: ${sourcePath}`);
    }

    if ((operation === 'move' || operation === 'copy' || operation === 'rename') && !targetPath) {
      throw new Error(`无法确定目标路径，操作类型: ${operation}`);
    }

    if ((operation === 'move' || operation === 'copy' || operation === 'rename') && targetPath) {
      const targetDir = path.dirname(targetPath);

      if (await fs.pathExists(targetDir)) {
        if (!(await this.checkPermissions(targetDir, 'write'))) {
          throw new Error(`目标目录没有写入权限: ${targetDir}`);
        }
      }

      const normalizedSource = path.normalize(sourcePath);
      const normalizedTarget = path.normalize(targetPath);

      if (operation === 'move' && normalizedTarget.startsWith(normalizedSource + path.sep)) {
        throw new Error(`不能将文件夹移动到自己内部: ${sourcePath} -> ${targetPath}`);
      }

      if (normalizedSource !== normalizedTarget && await fs.pathExists(targetPath)) {
        throw new Error(`目标已存在: ${targetPath}`);
      }
    }

    if (operation === 'delete') {
      const parentDir = path.dirname(sourcePath);
      if (!(await this.checkPermissions(parentDir, 'write'))) {
        throw new Error(`没有删除权限: ${sourcePath}`);
      }
    }
  }

  async checkDiskSpace(targetPath: string, requiredSize: number): Promise<{ hasSpace: boolean; error?: string }> {
    try {
      if (requiredSize > 0) {
        const maxSafeSize = 10 * 1024 * 1024 * 1024;
        if (requiredSize > maxSafeSize) {
          return {
            hasSpace: false,
            error: `文件过大 (${Math.round(requiredSize / 1024 / 1024)}MB)，可能导致磁盘空间不足`
          };
        }
      }

      return { hasSpace: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { hasSpace: false, error: `磁盘空间检查失败: ${errorMsg}` };
    }
  }

  categorizeError(error: Error, operation: string, targetPath: string): string {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('permission') || errorMessage.includes('access') || error.message.includes('EACCES')) {
      return this.deps.translate('error.permissionDenied', { operation, path: targetPath });
    }

    if (errorMessage.includes('not found') || errorMessage.includes('enoent')) {
      return this.deps.translate('error.pathNotFound', { path: targetPath });
    }

    if (errorMessage.includes('directory not empty') || errorMessage.includes('enotempty')) {
      return this.deps.translate('error.directoryNotEmpty', { path: targetPath });
    }

    if (errorMessage.includes('file exists') || errorMessage.includes('eexist')) {
      return this.deps.translate('error.targetExists', { path: targetPath });
    }

    if (errorMessage.includes('cross-device') || errorMessage.includes('exdev')) {
      return this.deps.translate('error.crossDevice', { path: targetPath });
    }

    if (errorMessage.includes('name too long') || errorMessage.includes('enametoolong')) {
      return this.deps.translate('error.pathTooLong', { path: targetPath });
    }

    if (errorMessage.includes('no space') || errorMessage.includes('enospc')) {
      return this.deps.translate('error.diskFull', { path: targetPath });
    }

    return this.deps.translate('error.generic', { path: targetPath, error: error.message });
  }
}
