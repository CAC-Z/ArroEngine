import path from 'path';
import fs from 'fs-extra';
import type { FileOperation } from '../../../shared/types';
import type { WorkflowEngine } from '../workflow-engine';

export function validatePathSecurity(filePath: string, basePath?: string): { isValid: boolean; error?: string } {
  try {
    const normalizedPath = path.resolve(filePath);

    if (filePath.includes('..') || filePath.includes('~')) {
      return { isValid: false, error: '路径包含不安全字符' };
    }

    if (basePath) {
      const normalizedBasePath = path.resolve(basePath);
      if (!normalizedPath.startsWith(normalizedBasePath)) {
        return { isValid: false, error: '路径超出允许范围' };
      }
    }

    if (normalizedPath.length > 260) {
      return { isValid: false, error: '路径过长' };
    }

    const systemPaths = [
      'C:\\Windows',
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      '/System',
      '/usr/bin',
      '/bin',
      '/sbin'
    ];

    for (const systemPath of systemPaths) {
      if (normalizedPath.toLowerCase().startsWith(systemPath.toLowerCase())) {
        return { isValid: false, error: '不能操作系统关键目录' };
      }
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `路径验证失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function normalizeOperationPaths(
  operation: FileOperation
): { isValid: boolean; error?: string; normalizedOperation?: FileOperation } {
  try {
    const normalizedOperation = { ...operation };

    if (operation.originalPath) {
      const validation = validatePathSecurity(operation.originalPath);
      if (!validation.isValid) {
        return { isValid: false, error: `原始路径不安全: ${validation.error}` };
      }
      normalizedOperation.originalPath = path.resolve(operation.originalPath);
    }

    if (operation.newPath) {
      const validation = validatePathSecurity(operation.newPath);
      if (!validation.isValid) {
        return { isValid: false, error: `目标路径不安全: ${validation.error}` };
      }
      normalizedOperation.newPath = path.resolve(operation.newPath);
    }

    return { isValid: true, normalizedOperation };
  } catch (error) {
    return {
      isValid: false,
      error: `路径规范化失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function checkPermissions(
  workflowEngine: WorkflowEngine,
  filePath: string,
  operation: 'read' | 'write'
): Promise<{ hasPermission: boolean; error?: string }> {
  try {
    const hasPermission = await workflowEngine.checkPermissions(filePath, operation);
    if (hasPermission) {
      return { hasPermission: true };
    }

    return {
      hasPermission: false,
      error: `${operation === 'read' ? '读取' : '写入'}权限不足`
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      hasPermission: false,
      error: `权限检查失败: ${errorMsg}`
    };
  }
}

export async function checkDirectoryPermissions(
  workflowEngine: WorkflowEngine,
  dirPath: string
): Promise<{ hasPermission: boolean; error?: string }> {
  try {
    if (await fs.pathExists(dirPath)) {
      return await checkPermissions(workflowEngine, dirPath, 'write');
    }

    const parentDir = path.dirname(dirPath);
    if (parentDir === dirPath) {
      return { hasPermission: false, error: '无法访问根目录' };
    }

    return await checkDirectoryPermissions(workflowEngine, parentDir);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { hasPermission: false, error: `目录权限检查失败: ${errorMsg}` };
  }
}

export async function checkDiskSpace(
  workflowEngine: WorkflowEngine,
  targetPath: string,
  requiredSize: number
): Promise<{ hasSpace: boolean; error?: string }> {
  return workflowEngine.checkDiskSpace(targetPath, requiredSize);
}

export function calculateRequiredSpace(operations: FileOperation[]): number {
  let totalSize = 0;

  for (const operation of operations) {
    if (operation.status === 'success') {
      if (operation.operation === 'move' || operation.operation === 'rename') {
        totalSize += operation.fileSize;
      }
    }
  }

  return totalSize;
}
