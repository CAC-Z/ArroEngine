import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { AppFile, ProcessError, ProcessStep } from '../../../shared/types';
import type { WorkflowValidationService } from './validation-service';
import type { WorkflowActionService } from './action-service';
import type { WorkflowFileSystemService } from './filesystem-service';

interface WorkflowStepProcessorDependencies {
  validationService: WorkflowValidationService;
  actionService: WorkflowActionService;
  fileSystem: WorkflowFileSystemService;
  translateError(errorMessage: string): string;
}

export class WorkflowStepProcessor {
  constructor(private readonly deps: WorkflowStepProcessorDependencies) {}

  async preview(
    files: AppFile[],
    step: ProcessStep
  ): Promise<{ outputFiles: AppFile[]; stepErrors: ProcessError[]; hasMatches: boolean }> {
    const outputFiles: AppFile[] = [];
    const stepErrors: ProcessError[] = [];
    let fileIndex = 0;
    let hasMatches = false;

    for (const file of files) {
      try {
        if (file.type === 'folder' && await this.deps.fileSystem.isEmptyDirectory(file.path)) {
          outputFiles.push({
            ...file,
            status: file.status ?? 'pending',
            id: file.id,
            newPath: file.path,
            skipped: true
          });
          continue;
        }

        if (this.deps.validationService.matchesConditions(file, step.conditions)) {
          hasMatches = true;
          const actionOutcome = await this.deps.actionService.previewActions(
            file.path,
            step.actions,
            fileIndex,
            file
          );
          fileIndex++;

          const previewFile: AppFile = {
            ...file,
            status: 'pending',
            id: file.id
          };

          if (actionOutcome.operationType) {
            previewFile.operationType = actionOutcome.operationType;
          }

          if (actionOutcome.deleted) {
            previewFile.deleted = true;
            previewFile.newPath = undefined;
          } else if (actionOutcome.operationType === 'copy') {
            previewFile.newPath = undefined;
          } else if (actionOutcome.finalPath && actionOutcome.finalPath !== file.path) {
            previewFile.newPath = actionOutcome.finalPath;
            previewFile.path = actionOutcome.finalPath;
            previewFile.name = path.basename(actionOutcome.finalPath);
            previewFile.originalDir = path.dirname(actionOutcome.finalPath);
          }

          outputFiles.push(previewFile);

          if (actionOutcome.createdFiles?.length) {
            actionOutcome.createdFiles.forEach(created => {
              outputFiles.push({
                ...file,
                id: uuidv4(),
                path: created.path,
                newPath: created.path,
                name: path.basename(created.path),
                originalDir: path.dirname(created.path),
                status: 'pending',
                operationType: 'copy',
                sourceFileId: file.id,
                sourceFilePath: file.path,
                deleted: false,
                skipped: false
              });
            });
          }
        } else {
          outputFiles.push({
            ...file,
            id: file.id
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const translatedError = this.deps.translateError(errorMessage);

        stepErrors.push({
          file: file.path,
          error: translatedError,
          step: step.id
        });

        outputFiles.push({
          ...file,
          status: 'error',
          error: translatedError,
          id: file.id
        });
      }
    }

    return { outputFiles, stepErrors, hasMatches };
  }

  async execute(
    files: AppFile[],
    step: ProcessStep
  ): Promise<{ outputFiles: AppFile[]; stepErrors: ProcessError[] }> {
    const outputFiles: AppFile[] = [];
    const stepErrors: ProcessError[] = [];

    for (const file of files) {
      try {
        if (file.status === 'error') {
          outputFiles.push({
            ...file,
            id: file.id
          });
          continue;
        }

        if (file.type === 'folder' && await this.deps.fileSystem.isEmptyDirectory(file.path)) {
          this.deps.fileSystem.trackProcessedDirectory(file.path);
          console.log(`跳过空文件夹: ${file.path}`);
          outputFiles.push({
            ...file,
            status: file.status ?? 'pending',
            id: file.id,
            newPath: file.path,
            skipped: true
          });
          continue;
        }

        if (this.deps.validationService.matchesConditions(file, step.conditions)) {
          const actionOutcome = await this.deps.actionService.executeActions(file.path, step.actions);
          const finalPath = actionOutcome.finalPath ?? file.path;

          const updatedFile: AppFile = {
            ...file,
            path: actionOutcome.deleted ? file.path : finalPath,
            status: 'success',
            id: file.id
          };

          if (actionOutcome.operationType) {
            updatedFile.operationType = actionOutcome.operationType;
          }

          if (actionOutcome.deleted) {
            updatedFile.deleted = true;
            updatedFile.newPath = undefined;
          } else if (actionOutcome.operationType === 'copy') {
            updatedFile.newPath = undefined;
          } else if (actionOutcome.finalPath && actionOutcome.finalPath !== file.path) {
            updatedFile.path = actionOutcome.finalPath;
            updatedFile.newPath = actionOutcome.finalPath;
            updatedFile.name = path.basename(actionOutcome.finalPath);
            updatedFile.originalDir = path.dirname(actionOutcome.finalPath);
          } else {
            updatedFile.newPath = actionOutcome.finalPath;
          }

          outputFiles.push(updatedFile);

          if (actionOutcome.createdFiles?.length) {
            actionOutcome.createdFiles.forEach(created => {
              outputFiles.push({
                ...file,
                id: uuidv4(),
                path: created.path,
                newPath: created.path,
                name: path.basename(created.path),
                originalDir: path.dirname(created.path),
                status: 'success',
                operationType: 'copy',
                sourceFileId: file.id,
                sourceFilePath: file.path,
                deleted: false,
                skipped: false
              });
            });
          }
        } else {
          outputFiles.push({
            ...file,
            id: file.id
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const translatedError = this.deps.translateError(errorMessage);

        stepErrors.push({
          file: file.path,
          error: translatedError,
          step: step.id
        });

        outputFiles.push({
          ...file,
          status: 'error',
          error: translatedError,
          id: file.id
        });
      }
    }

    return { outputFiles, stepErrors };
  }
}
