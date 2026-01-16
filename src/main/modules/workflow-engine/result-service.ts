import path from 'path';
import type {
  AppFile,
  FileChange,
  ProcessError,
  StepResult,
  WorkflowResult
} from '../../../shared/types';
import { FileChangeType } from '../../../shared/types';

export interface WorkflowExecutionState {
  workflowId: string;
  startTime: string;
  stepResults: StepResult[];
  processedFiles: number;
  totalFiles: number;
  errors: ProcessError[];
}

export class WorkflowResultService {
  createPartialResult(
    execution: WorkflowExecutionState,
    initialFiles: AppFile[] = []
  ): WorkflowResult {
    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(execution.startTime).getTime();

    const changes = this.generateFileChanges(execution.stepResults, initialFiles);

    const partialResult: WorkflowResult = {
      workflowId: execution.workflowId,
      startTime: execution.startTime,
      endTime,
      duration,
      totalFiles: execution.totalFiles,
      processedFiles: execution.processedFiles,
      stepResults: execution.stepResults,
      errors: [
        ...execution.errors,
        {
          file: '',
          error: '工作流执行被中断',
          step: 'system'
        }
      ],
      changes
    };

    console.warn('[工作流引擎] 保存部分执行结果:', {
      workflowId: partialResult.workflowId,
      processedFiles: partialResult.processedFiles,
      totalFiles: partialResult.totalFiles,
      stepCount: partialResult.stepResults.length
    });

    return partialResult;
  }

  generateFileChanges(stepResults: StepResult[], initialFiles: AppFile[]): FileChange[] {
    const changes: FileChange[] = [];
    const initialFileMap = new Map(initialFiles.map(file => [file.id, file]));

    for (const stepResult of stepResults) {
      const inputFileMap = new Map(stepResult.inputFiles.map(file => [file.id, file]));
      const outputFileMap = new Map(stepResult.outputFiles.map(file => [file.id, file]));

      for (const inputFile of stepResult.inputFiles) {
        const outputFile = outputFileMap.get(inputFile.id);
        const originalFile = initialFileMap.get(inputFile.id) || inputFile;

        if (!outputFile || outputFile.deleted) {
          changes.push({
            type: FileChangeType.DELETED,
            file: null,
            originalFile,
            stepId: stepResult.stepId
          });
        } else if (outputFile.newPath && outputFile.newPath !== inputFile.path) {
          const inputDir = path.dirname(inputFile.path);
          const outputDir = path.dirname(outputFile.newPath);
          const inputName = path.basename(inputFile.path);
          const outputName = path.basename(outputFile.newPath);

          if (inputDir !== outputDir && inputName !== outputName) {
            changes.push({
              type: FileChangeType.MOVED,
              file: { ...outputFile, path: outputFile.newPath },
              originalFile,
              stepId: stepResult.stepId
            });
          } else if (inputDir !== outputDir) {
            changes.push({
              type: FileChangeType.MOVED,
              file: { ...outputFile, path: outputFile.newPath },
              originalFile,
              stepId: stepResult.stepId
            });
          } else if (inputName !== outputName) {
            changes.push({
              type: FileChangeType.RENAMED,
              file: { ...outputFile, path: outputFile.newPath },
              originalFile,
              stepId: stepResult.stepId
            });
          }
        } else if (outputFile.status === 'success' && outputFile.newPath) {
          changes.push({
            type: FileChangeType.MODIFIED,
            file: outputFile,
            originalFile,
            stepId: stepResult.stepId
          });
        }
      }

      for (const outputFile of stepResult.outputFiles) {
        if (!inputFileMap.has(outputFile.id) && !initialFileMap.has(outputFile.id)) {
          const possibleOriginal =
            (outputFile.sourceFileId && (inputFileMap.get(outputFile.sourceFileId) || initialFileMap.get(outputFile.sourceFileId))) ||
            (outputFile.sourceFilePath &&
              Array.from(initialFileMap.values()).find(original => original.path === outputFile.sourceFilePath)) ||
            Array.from(initialFileMap.values()).find(
              original => original.path === outputFile.path && original.id !== outputFile.id
            );

          if (possibleOriginal) {
            changes.push({
              type: FileChangeType.COPIED,
              file: outputFile,
              originalFile: possibleOriginal,
              stepId: stepResult.stepId
            });
          } else {
            changes.push({
              type: FileChangeType.CREATED,
              file: outputFile,
              originalFile: null,
              stepId: stepResult.stepId
            });
          }
        }
      }
    }

    return changes;
  }
}
