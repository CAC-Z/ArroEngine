import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  AppFile,
  FileOperation,
  HistoryEntry,
  ProcessStep,
  StepResult,
  Workflow,
  WorkflowResult
} from '../../../shared/types';

export interface CreateHistoryEntryOptions {
  workflowResult: WorkflowResult;
  workflow: Workflow;
  originalFiles: AppFile[];
  source?: 'manual' | 'file_watch' | 'scheduled';
  monitorTaskId?: string;
  monitorTaskName?: string;
  createdDirectories?: string[];
  cleanedEmptyDirectories?: string[];
  createStepLevelEntries?: boolean;
}

/**
 * 根据工作流执行结果构建历史记录条目。
 */
export function createHistoryEntryFromWorkflowResult(options: CreateHistoryEntryOptions): HistoryEntry | HistoryEntry[] {
  const {
    workflowResult,
    workflow,
    originalFiles,
    source = 'manual',
    monitorTaskId,
    monitorTaskName,
    createdDirectories,
    cleanedEmptyDirectories,
    createStepLevelEntries = false
  } = options;

  void originalFiles;

  if (createStepLevelEntries && workflowResult.stepResults.length > 1) {
    return createStepLevelHistoryEntries(
      workflowResult,
      workflow,
      originalFiles,
      source,
      monitorTaskId,
      monitorTaskName,
      createdDirectories,
      cleanedEmptyDirectories
    );
  }

  const fileOperations: FileOperation[] = [];

  for (const stepResult of workflowResult.stepResults) {
    const workflowStep = workflow.steps.find(step => step.id === stepResult.stepId);
    const outputFileMap = new Map(stepResult.outputFiles.map(file => [file.id, file]));
    const inputFileIds = new Set(stepResult.inputFiles.map(file => file.id));

    for (const inputFile of stepResult.inputFiles) {
      const outputFile = outputFileMap.get(inputFile.id);

      if (!outputFile) {
        const deleteOperation: FileOperation = {
          id: `op-${uuidv4()}`,
          fileId: inputFile.id,
          originalPath: inputFile.path,
          originalName: inputFile.name,
          newPath: undefined,
          newName: undefined,
          operation: 'delete',
          status: 'success',
          error: undefined,
          fileType: inputFile.type || 'unknown',
          fileSize: inputFile.size || 0
        };
        fileOperations.push(deleteOperation);
        continue;
      }

      if (outputFile.skipped) {
        continue;
      }

      const resolvedOperation = resolveOperationType(inputFile, outputFile, workflowStep);
      if (!resolvedOperation) {
        continue;
      }

      const isDeleteOperation = resolvedOperation === 'delete';
      const targetPath = isDeleteOperation ? undefined : (outputFile.newPath || outputFile.path);

      console.log(`📝 操作记录: ${inputFile.path} -> ${targetPath || 'N/A'} (${resolvedOperation})`);
      console.log(`📝 撤销时将回到: ${inputFile.path}`);

      const fileOperation: FileOperation = {
        id: `op-${uuidv4()}`,
        fileId: inputFile.id,
        originalPath: inputFile.path,
        originalName: inputFile.name,
        newPath: targetPath,
        newName: isDeleteOperation ? undefined : outputFile.name,
        operation: resolvedOperation,
        status: outputFile.status === 'error' ? 'error' : 'success',
        error: outputFile.error,
        fileType: inputFile.type || 'unknown',
        fileSize: inputFile.size || 0
      };

      fileOperations.push(fileOperation);
    }

    for (const outputFile of stepResult.outputFiles) {
      if (inputFileIds.has(outputFile.id) || outputFile.skipped) {
        continue;
      }

      if (!outputFile.operationType) {
        continue;
      }

      if (outputFile.operationType !== 'copy' && outputFile.operationType !== 'createFolder') {
        continue;
      }

      const operation = outputFile.operationType as FileOperation['operation'];
      const sourcePath = outputFile.sourceFilePath || outputFile.originalDir || outputFile.path;

      const fileOperation: FileOperation = {
        id: `op-${uuidv4()}`,
        fileId: outputFile.id,
        originalPath: sourcePath,
        originalName: path.basename(sourcePath),
        newPath: outputFile.path,
        newName: outputFile.name,
        operation,
        status: outputFile.status === 'error' ? 'error' : 'success',
        error: outputFile.error,
        fileType: outputFile.type || 'unknown',
        fileSize: outputFile.size || 0
      };

      fileOperations.push(fileOperation);
    }
  }

  const allFileOperations = [...fileOperations];
  if (cleanedEmptyDirectories && cleanedEmptyDirectories.length > 0) {
    const emptyFolderOperations: FileOperation[] = cleanedEmptyDirectories.map(dirPath => ({
      id: `empty-folder-${uuidv4()}`,
      fileId: undefined,
      originalPath: dirPath,
      originalName: path.basename(dirPath),
      newPath: undefined,
      newName: undefined,
      operation: 'delete' as const,
      status: 'success' as const,
      fileType: 'folder',
      fileSize: 0,
      error: undefined
    }));
    allFileOperations.push(...emptyFolderOperations);
  }

  const undoFeasibility = assessUndoFeasibility(fileOperations, workflowResult);

  const historyEntry: HistoryEntry = {
    id: `history-${uuidv4()}`,
    timestamp: workflowResult.startTime,
    workflowId: workflow.id,
    workflowName: workflow.name,
    fileOperations: allFileOperations,
    status: workflowResult.errors.length === 0
      ? 'success'
      : workflowResult.errors.length === workflowResult.totalFiles
        ? 'error'
        : 'partial',
    duration: workflowResult.duration,
    totalFiles: workflowResult.totalFiles,
    processedFiles: workflowResult.processedFiles,
    errors: workflowResult.errors,
    canUndo: undoFeasibility.canUndo,
    isUndone: false,
    createdDirectories: createdDirectories || [],
    cleanedEmptyDirectories: cleanedEmptyDirectories || [],
    source,
    monitorTaskId,
    monitorTaskName
  };

  if (undoFeasibility.reason) {
    historyEntry.undoWarning = undoFeasibility.reason;
  }

  return historyEntry;
}

function assessUndoFeasibility(
  fileOperations: FileOperation[],
  workflowResult: WorkflowResult
): { canUndo: boolean; reason?: string } {
  const successfulOperations = fileOperations.filter(op => op.status === 'success');
  if (successfulOperations.length === 0) {
    return { canUndo: false, reason: '没有成功的操作可以撤销' };
  }

  const hasDeleteOperation = fileOperations.some(op => op.operation === 'delete');
  if (hasDeleteOperation) {
    return { canUndo: false, reason: '包含删除操作，无法完全撤销' };
  }

  const hasSystemErrors = workflowResult.errors.some(error =>
    error.error.includes('权限') ||
    error.error.includes('磁盘空间') ||
    error.error.includes('系统') ||
    error.error.includes('EACCES') ||
    error.error.includes('ENOSPC')
  );
  if (hasSystemErrors) {
    return { canUndo: false, reason: '存在系统级错误，撤销可能不安全' };
  }

  const failedOperations = fileOperations.filter(op => op.status === 'error');
  const successRate = successfulOperations.length / fileOperations.length;

  if (successRate < 0.5 && failedOperations.length > 0) {
    return { canUndo: false, reason: '成功率过低，撤销可能导致数据不一致' };
  }

  const complexOperations = detectComplexOperationSequence(successfulOperations);
  if (complexOperations.isComplex && complexOperations.riskLevel === 'high') {
    return { canUndo: false, reason: '包含复杂操作序列，建议使用连锁撤销' };
  }

  const operationTimeSpan = calculateOperationTimeSpan(workflowResult);
  if (operationTimeSpan > 3600000) {
    return { canUndo: false, reason: '操作时间跨度过长，文件状态可能已发生变化' };
  }

  return { canUndo: true };
}

function detectComplexOperationSequence(
  operations: FileOperation[]
): { isComplex: boolean; riskLevel: 'low' | 'medium' | 'high' } {
  const pathMap = new Map<string, string>();
  let hasCircularDependency = false;

  for (const op of operations) {
    if ((op.operation === 'move' || op.operation === 'rename') && op.originalPath && op.newPath) {
      if (pathMap.has(op.newPath) && pathMap.get(op.newPath) === op.originalPath) {
        hasCircularDependency = true;
        break;
      }
      pathMap.set(op.originalPath, op.newPath);
    }
  }

  const renameChainLength = calculateRenameChainLength(operations);

  if (hasCircularDependency || renameChainLength > 5) {
    return { isComplex: true, riskLevel: 'high' };
  } else if (renameChainLength > 2) {
    return { isComplex: true, riskLevel: 'medium' };
  }

  return { isComplex: false, riskLevel: 'low' };
}

function calculateRenameChainLength(operations: FileOperation[]): number {
  const dependencies = new Map<string, string>();

  for (const op of operations) {
    if ((op.operation === 'move' || op.operation === 'rename') && op.originalPath && op.newPath) {
      dependencies.set(op.originalPath, op.newPath);
    }
  }

  let maxChainLength = 0;
  const visited = new Set<string>();

  for (const [start] of dependencies) {
    if (visited.has(start)) continue;

    let current = start;
    let chainLength = 0;
    const chainVisited = new Set<string>();

    while (dependencies.has(current) && !chainVisited.has(current)) {
      chainVisited.add(current);
      visited.add(current);
      current = dependencies.get(current)!;
      chainLength++;
    }

    maxChainLength = Math.max(maxChainLength, chainLength);
  }

  return maxChainLength;
}

function calculateOperationTimeSpan(workflowResult: WorkflowResult): number {
  const startTime = new Date(workflowResult.startTime).getTime();
  const endTime = new Date(workflowResult.endTime).getTime();
  return endTime - startTime;
}

function createStepLevelHistoryEntries(
  workflowResult: WorkflowResult,
  workflow: Workflow,
  originalFiles: AppFile[],
  source: 'manual' | 'file_watch' | 'scheduled' = 'manual',
  monitorTaskId?: string,
  monitorTaskName?: string,
  createdDirectories?: string[],
  cleanedEmptyDirectories?: string[]
): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  void originalFiles;

  for (const stepResult of workflowResult.stepResults) {
    const stepFileOperations = extractStepFileOperations(stepResult, workflow);
    if (stepFileOperations.length === 0) {
      continue;
    }

    const hasDeleteOperation = stepFileOperations.some(op => op.operation === 'delete');
    const hasSuccessfulOperations = stepFileOperations.some(op => op.status === 'success');

    const stepStatus = stepResult.errors.length === 0
      ? 'success'
      : stepResult.errors.length === stepFileOperations.length
        ? 'error'
        : 'partial';

    const stepEntry: HistoryEntry = {
      id: `history-step-${uuidv4()}`,
      timestamp: workflowResult.startTime,
      workflowId: workflow.id,
      workflowName: workflow.name,
      stepId: stepResult.stepId,
      stepName: stepResult.stepName,
      fileOperations: stepFileOperations,
      status: stepStatus,
      duration: stepResult.duration,
      totalFiles: stepResult.inputFiles.length,
      processedFiles: stepResult.processedCount,
      errors: stepResult.errors,
      canUndo: hasSuccessfulOperations && !hasDeleteOperation,
      isUndone: false,
      createdDirectories: createdDirectories || [],
      cleanedEmptyDirectories: cleanedEmptyDirectories || [],
      source,
      monitorTaskId,
      monitorTaskName
    };

    if (hasDeleteOperation) {
      stepEntry.undoWarning = '包含删除操作，无法完全撤销';
    }

    entries.push(stepEntry);
  }

  return entries;
}

function extractStepFileOperations(stepResult: StepResult, workflow: Workflow): FileOperation[] {
  const fileOperations: FileOperation[] = [];

  const workflowStep = workflow.steps.find(step => step.id === stepResult.stepId);
  const outputFileMap = new Map(stepResult.outputFiles.map(file => [file.id, file]));
  const inputFileIds = new Set(stepResult.inputFiles.map(file => file.id));

  for (const inputFile of stepResult.inputFiles) {
    const outputFile = outputFileMap.get(inputFile.id);

    if (!outputFile || outputFile.skipped) {
      continue;
    }

    const resolvedOperation = resolveOperationType(inputFile, outputFile, workflowStep);
    if (!resolvedOperation) {
      continue;
    }

    const isDeleteOperation = resolvedOperation === 'delete';

    const fileOperation: FileOperation = {
      id: `op-step-${uuidv4()}`,
      fileId: inputFile.id,
      originalPath: inputFile.path,
      originalName: inputFile.name,
      newPath: isDeleteOperation ? undefined : outputFile.newPath || outputFile.path,
      newName: isDeleteOperation ? undefined : outputFile.name,
      operation: resolvedOperation,
      status: outputFile.status === 'error' ? 'error' : 'success',
      error: outputFile.error,
      fileType: inputFile.type || 'unknown',
      fileSize: inputFile.size || 0,
      stepId: stepResult.stepId,
      stepName: stepResult.stepName
    };

    fileOperations.push(fileOperation);
  }

  for (const outputFile of stepResult.outputFiles) {
    if (inputFileIds.has(outputFile.id) || outputFile.skipped) {
      continue;
    }

    if (!outputFile.operationType) {
      continue;
    }

    if (outputFile.operationType !== 'copy' && outputFile.operationType !== 'createFolder') {
      continue;
    }

    const operation = outputFile.operationType as FileOperation['operation'];
    const sourcePath = outputFile.sourceFilePath || outputFile.originalDir || outputFile.path;

    fileOperations.push({
      id: `op-step-${uuidv4()}`,
      fileId: outputFile.id,
      originalPath: sourcePath,
      originalName: path.basename(sourcePath),
      newPath: outputFile.path,
      newName: outputFile.name,
      operation,
      status: outputFile.status === 'error' ? 'error' : 'success',
      error: outputFile.error,
      fileType: outputFile.type || 'unknown',
      fileSize: outputFile.size || 0,
      stepId: stepResult.stepId,
      stepName: stepResult.stepName
    });
  }

  return fileOperations;
}

function resolveOperationType(
  inputFile: AppFile,
  outputFile: AppFile,
  workflowStep?: ProcessStep
): FileOperation['operation'] | null {
  if (outputFile.deleted || outputFile.operationType === 'delete') {
    return 'delete';
  }

  const targetPath = outputFile.newPath || outputFile.path;
  let resolvedOperation = outputFile.operationType as FileOperation['operation'] | undefined;

  if (!resolvedOperation && workflowStep && workflowStep.actions.length > 0) {
    const firstEnabledAction = workflowStep.actions.find(action => action.enabled);
    if (firstEnabledAction) {
      resolvedOperation = firstEnabledAction.type as FileOperation['operation'];
    }
  }

  if (!resolvedOperation && targetPath && targetPath !== inputFile.path) {
    const inputDir = path.dirname(inputFile.path);
    const outputDir = path.dirname(targetPath);
    resolvedOperation = inputDir === outputDir ? 'rename' : 'move';
  }

  if (!resolvedOperation) {
    return null;
  }

  if ((resolvedOperation === 'move' || resolvedOperation === 'rename') && targetPath) {
    const inputDir = path.dirname(inputFile.path);
    const outputDir = path.dirname(targetPath);
    return inputDir === outputDir ? 'rename' : 'move';
  }

  return resolvedOperation;
}
