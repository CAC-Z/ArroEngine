import path from 'path';
import { convertToBytes } from './utils';
import type {
  Action,
  AppFile,
  Condition,
  ConditionGroup,
  ProcessStep,
  Workflow
} from '../../../shared/types';
import { getFileTypeCategory } from './file-type';
import type { ValidationIssue } from './types';

export interface ValidationDependencies {
  translate: (key: string, params?: Record<string, any>) => string;
  filterFilesByProcessTarget: (
    files: AppFile[],
    target: 'files' | 'folders' | 'both'
  ) => AppFile[];
}

export class WorkflowValidationService {
  constructor(private readonly deps: ValidationDependencies) {}

  validateWorkflowConfiguration(workflow: Workflow): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    const enabledSteps = workflow.steps.filter(
      (step): step is ProcessStep => Boolean(step.enabled)
    );
    if (enabledSteps.length === 0) {
      errors.push('工作流没有启用的步骤');
    }

    for (const step of enabledSteps) {
      if (step.inputSource.type === 'specific_path' && !step.inputSource.path) {
        errors.push(`步骤"${step.name}"配置了特定路径输入源但未指定路径`);
      }

      if (step.inputSource.type === 'previous_step' && step.inputSource.stepId) {
        const referencedStep = workflow.steps.find(
          (candidate: ProcessStep) => candidate.id === step.inputSource.stepId
        );
        if (!referencedStep) {
          errors.push(`步骤"${step.name}"引用了不存在的步骤`);
        }
      }

      const enabledActions = step.actions.filter(
        (action): action is Action => Boolean(action.enabled)
      );
      if (enabledActions.length === 0) {
        errors.push(`步骤"${step.name}"没有启用的动作`);
      }

      for (const action of enabledActions) {
        if ((action.type === 'move' || action.type === 'copy') && !action.config.targetPath) {
          errors.push(
            `步骤"${step.name}"的${action.type === 'move' ? '移动' : '复制'}动作未配置目标路径`
          );
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  findInitiallyMatchingFiles(files: AppFile[], workflow: Workflow): AppFile[] {
    const enabledSteps = workflow.steps
      .filter((step): step is ProcessStep => Boolean(step.enabled))
      .sort((a: ProcessStep, b: ProcessStep) => a.order - b.order);

    if (enabledSteps.length === 0) {
      return [];
    }

    const validFileIds = new Set<string>();

    const firstStep = enabledSteps[0];
    const firstStepMatches = this.findMatchingFilesForStep(files, firstStep);
    firstStepMatches.forEach(file => validFileIds.add(file.id));

    console.log(`[智能验证] 第一个步骤 "${firstStep.name}" 匹配了 ${firstStepMatches.length} 个文件`);

    const originalInputSteps = enabledSteps.filter(step => step.inputSource.type === 'original');
    for (const step of originalInputSteps) {
      const stepMatches = this.findMatchingFilesForStep(files, step);
      stepMatches.forEach(file => validFileIds.add(file.id));
      console.log(`[智能验证] 原始输入步骤 "${step.name}" 匹配了 ${stepMatches.length} 个文件`);
    }

    const validFiles = files.filter(file => validFileIds.has(file.id));
    console.log(`[智能验证] 总计找到 ${validFiles.length} 个有效文件（来自 ${files.length} 个输入文件）`);

    return validFiles;
  }

  validateWorkflowInputs(files: AppFile[], workflow: Workflow): { isValid: boolean; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    const enabledSteps = workflow.steps
      .filter((step): step is ProcessStep => Boolean(step.enabled))
      .sort((a: ProcessStep, b: ProcessStep) => a.order - b.order);

    if (enabledSteps.length === 0) {
      return { isValid: true, issues: [] };
    }

    const validFiles = this.findInitiallyMatchingFiles(files, workflow);
    const hasAnyMatchingStep = validFiles.length > 0;

    if (!hasAnyMatchingStep) {
      const firstStep = enabledSteps[0];
      const originalInputSteps = enabledSteps.filter(step => step.inputSource.type === 'original');
      const entryPoints = [firstStep, ...originalInputSteps.filter(step => step.id !== firstStep.id)];

      const stepMatchInfo: Array<{
        step: ProcessStep;
        hasMatches: boolean;
        targetType: string;
        conditionMatches: number;
      }> = [];

      for (const step of entryPoints) {
        const targetFiles = this.deps.filterFilesByProcessTarget(files, step.processTarget || 'files');
        const targetType = this.deps.translate(
          step.processTarget === 'folders' ? 'targetType.folders' : 'targetType.files'
        );
        const conditionMatches = targetFiles.filter(file => this.matchesConditions(file, step.conditions)).length;
        const hasMatches = conditionMatches > 0;

        stepMatchInfo.push({ step, hasMatches, targetType, conditionMatches });
      }

      this.generateDetailedValidationError(files, stepMatchInfo, issues, entryPoints);
    }

    return { isValid: issues.length === 0, issues };
  }

  matchesConditions(file: AppFile, conditionGroup: ConditionGroup): boolean {
    if (!conditionGroup) {
      return true;
    }

    const conditionResults = (conditionGroup.conditions || [])
      .filter(condition => condition.enabled)
      .map(condition => this.matchesCondition(file, condition));

    const groupResults = (conditionGroup.groups || [])
      .map(group => this.matchesConditions(file, group));

    const allResults = [...conditionResults, ...groupResults];
    if (allResults.length === 0) {
      return true;
    }

    return conditionGroup.operator === 'AND'
      ? allResults.every(Boolean)
      : allResults.some(Boolean);
  }

  analyzeFileStepMatching(files: AppFile[], steps: ProcessStep[]): {
    totalFiles: number;
    totalFolders: number;
    stepAnalysis: Array<{
      stepName: string;
      targetType: string;
      targetFileCount: number;
      conditionMatchCount: number;
      sampleUnmatchedReasons: string[];
    }>;
  } {
    const totalFiles = files.filter(file => !file.isDirectory).length;
    const totalFolders = files.filter(file => file.isDirectory).length;
    const stepAnalysis = [];

    for (const step of steps) {
      const targetType = step.processTarget === 'folders' ? 'folders' : 'files';
      const targetFiles = this.deps.filterFilesByProcessTarget(files, step.processTarget || 'files');
      const conditionMatches = targetFiles.filter(file => this.matchesConditions(file, step.conditions));
      const unmatchedFiles = targetFiles.filter(file => !this.matchesConditions(file, step.conditions));

      const sampleUnmatchedReasons = unmatchedFiles.slice(0, 3).map(file =>
        this.analyzeWhyFileDoesNotMatch(file, step.conditions)
      );

      stepAnalysis.push({
        stepName: step.name,
        targetType: this.deps.translate(targetType === 'folders' ? 'targetType.folders' : 'targetType.files'),
        targetFileCount: targetFiles.length,
        conditionMatchCount: conditionMatches.length,
        sampleUnmatchedReasons
      });
    }

    return {
      totalFiles,
      totalFolders,
      stepAnalysis
    };
  }

  analyzeWhyFileDoesNotMatch(file: AppFile, conditionGroup: ConditionGroup): string {
    if (!conditionGroup || conditionGroup.conditions.length === 0) {
      return '无条件限制';
    }

    const failedConditions = conditionGroup.conditions
      .filter(condition => condition.enabled && !this.matchesCondition(file, condition))
      .map(condition => {
        const fileValue = this.getFileValue(file, condition.field);
        return `${condition.field}(${fileValue}) ${condition.operator} ${condition.value}`;
      });

    return failedConditions.length > 0 ? `不满足条件: ${failedConditions.join(', ')}` : '条件匹配失败';
  }

  private findMatchingFilesForStep(files: AppFile[], step: ProcessStep): AppFile[] {
    const targetFiles = this.deps.filterFilesByProcessTarget(files, step.processTarget || 'files');
    return targetFiles.filter(file => this.matchesConditions(file, step.conditions));
  }

  private generateDetailedValidationError(
    files: AppFile[],
    stepMatchInfo: Array<{ step: ProcessStep; hasMatches: boolean; targetType: string; conditionMatches: number }>,
    issues: ValidationIssue[],
    entryPoints: ProcessStep[]
  ): void {
    if (files.length === 0) {
      return;
    }

    const fileCount = files.filter(f => !f.isDirectory).length;
    const folderCount = files.filter(f => f.isDirectory).length;

    let message = this.deps.translate('workflow.cannotProcessFiles');
    let suggestion = this.deps.translate('workflow.checkStepConfig');

    const fileSteps = stepMatchInfo.filter(info => info.targetType === this.deps.translate('targetType.files'));
    const folderSteps = stepMatchInfo.filter(info => info.targetType === this.deps.translate('targetType.folders'));

    if (fileCount > 0 && folderCount === 0) {
      if (folderSteps.length === entryPoints.length) {
        message = `输入了 ${fileCount} 个文件，但工作流的所有入口点都需要文件夹`;
        suggestion = '请添加文件夹到输入中，或调整工作流步骤的处理目标';
      } else if (fileSteps.length > 0) {
        const unmatchedSteps = fileSteps.filter(info => info.conditionMatches === 0);
        if (unmatchedSteps.length > 0) {
          message = `输入的 ${fileCount} 个文件不满足入口点条件。未匹配的入口点：${unmatchedSteps
            .map(info => info.step.name)
            .join(', ')}`;
          suggestion = '请检查步骤的筛选条件设置，或选择符合条件的文件';
        }
      }
    } else if (folderCount > 0 && fileCount === 0) {
      if (fileSteps.length === entryPoints.length) {
        message = `输入了 ${folderCount} 个文件夹，但工作流的所有入口点都需要文件`;
        suggestion = '请添加文件到输入中，或调整工作流步骤的处理目标';
      } else if (folderSteps.length > 0) {
        const unmatchedSteps = folderSteps.filter(info => info.conditionMatches === 0);
        if (unmatchedSteps.length > 0) {
          message = `输入的 ${folderCount} 个文件夹不满足入口点条件。未匹配的入口点：${unmatchedSteps
            .map(info => info.step.name)
            .join(', ')}`;
          suggestion = '请检查步骤的筛选条件设置，或选择符合条件的文件夹';
        }
      }
    } else if (fileCount > 0 && folderCount > 0) {
      const unmatchedFileSteps = fileSteps.filter(info => info.conditionMatches === 0);
      const unmatchedFolderSteps = folderSteps.filter(info => info.conditionMatches === 0);

      if (unmatchedFileSteps.length > 0 || unmatchedFolderSteps.length > 0) {
        message = '输入的文件和文件夹不满足工作流入口点的条件要求';
        suggestion = '请检查步骤的筛选条件设置，或选择符合条件的文件和文件夹';
      } else {
        message = `输入了 ${fileCount} 个文件和 ${folderCount} 个文件夹，但没有入口点能够处理这些输入`;
        suggestion = '请检查工作流配置，确保至少有一个入口点能够处理您的输入类型';
      }
    }

    issues.push({
      type: 'no_matching_files',
      stepId: 'workflow',
      stepName: '整个工作流',
      processTarget: 'mixed',
      message,
      suggestion
    });
  }

  private matchesCondition(file: AppFile, condition: Condition): boolean {
    const fileValue = this.getFileValue(file, condition.field);
    let conditionValue = condition.value;

    const isDateField = condition.field === 'createdDate' || condition.field === 'modifiedDate';

    if (isDateField && condition.dateType === 'relative') {
      conditionValue = this.calculateRelativeDate(condition);
    }

    switch (condition.operator) {
      case 'equals':
        if (isDateField) {
          const fileDate = this.getDateOnly(String(fileValue));
          const conditionDate = this.getDateOnly(String(conditionValue));
          return fileDate === conditionDate;
        }
        if (condition.field === 'fileSize' || condition.field === 'folderSize') {
          const fileValueInBytes = Number(fileValue);
          const conditionValueInBytes = convertToBytes(Number(conditionValue), condition.sizeUnit || 'MB');
          return fileValueInBytes === conditionValueInBytes;
        }
        return fileValue === conditionValue;

      case 'is':
        return fileValue === conditionValue;

      case 'notEquals':
        if (isDateField) {
          const fileDate = this.getDateOnly(String(fileValue));
          const conditionDate = this.getDateOnly(String(conditionValue));
          return fileDate !== conditionDate;
        }
        if (condition.field === 'fileSize' || condition.field === 'folderSize') {
          const fileValueInBytes = Number(fileValue);
          const conditionValueInBytes = convertToBytes(Number(conditionValue), condition.sizeUnit || 'MB');
          return fileValueInBytes !== conditionValueInBytes;
        }
        return fileValue !== conditionValue;

      case 'contains':
        return String(fileValue).toLowerCase().includes(String(conditionValue).toLowerCase());

      case 'notContains':
        return !String(fileValue).toLowerCase().includes(String(conditionValue).toLowerCase());

      case 'startsWith':
        return String(fileValue).toLowerCase().startsWith(String(conditionValue).toLowerCase());

      case 'notStartsWith':
        return !String(fileValue).toLowerCase().startsWith(String(conditionValue).toLowerCase());

      case 'endsWith':
        return String(fileValue).toLowerCase().endsWith(String(conditionValue).toLowerCase());

      case 'notEndsWith':
        return !String(fileValue).toLowerCase().endsWith(String(conditionValue).toLowerCase());

      case 'greaterThan':
        if (isDateField) {
          if (condition.dateType === 'relative') {
            return this.matchesRelativeDate(String(fileValue), condition, 'greaterThan');
          }
          return this.compareDates(String(fileValue), String(conditionValue)) > 0;
        }
        if (condition.field === 'fileSize' || condition.field === 'folderSize') {
          const fileValueInBytes = Number(fileValue);
          const conditionValueInBytes = convertToBytes(Number(conditionValue), condition.sizeUnit || 'MB');
          return fileValueInBytes > conditionValueInBytes;
        }
        return Number(fileValue) > Number(conditionValue);

      case 'lessThan':
        if (isDateField) {
          if (condition.dateType === 'relative') {
            return this.matchesRelativeDate(String(fileValue), condition, 'lessThan');
          }
          return this.compareDates(String(fileValue), String(conditionValue)) < 0;
        }
        if (condition.field === 'fileSize' || condition.field === 'folderSize') {
          const fileValueInBytes = Number(fileValue);
          const conditionValueInBytes = convertToBytes(Number(conditionValue), condition.sizeUnit || 'MB');
          return fileValueInBytes < conditionValueInBytes;
        }
        return Number(fileValue) < Number(conditionValue);

      case 'greaterThanOrEqual':
        if (isDateField) {
          if (condition.dateType === 'relative') {
            return this.matchesRelativeDate(String(fileValue), condition, 'greaterThanOrEqual');
          }
          return this.compareDates(String(fileValue), String(conditionValue)) >= 0;
        }
        if (condition.field === 'fileSize' || condition.field === 'folderSize') {
          const fileValueInBytes = Number(fileValue);
          const conditionValueInBytes = convertToBytes(Number(conditionValue), condition.sizeUnit || 'MB');
          return fileValueInBytes >= conditionValueInBytes;
        }
        return Number(fileValue) >= Number(conditionValue);

      case 'lessThanOrEqual':
        if (isDateField) {
          if (condition.dateType === 'relative') {
            return this.matchesRelativeDate(String(fileValue), condition, 'lessThanOrEqual');
          }
          return this.compareDates(String(fileValue), String(conditionValue)) <= 0;
        }
        if (condition.field === 'fileSize' || condition.field === 'folderSize') {
          const fileValueInBytes = Number(fileValue);
          const conditionValueInBytes = convertToBytes(Number(conditionValue), condition.sizeUnit || 'MB');
          return fileValueInBytes <= conditionValueInBytes;
        }
        return Number(fileValue) <= Number(conditionValue);

      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(String(fileValue));

      case 'notIn':
        return Array.isArray(conditionValue) && !conditionValue.includes(String(fileValue));

      case 'regex':
        try {
          const regex = new RegExp(String(conditionValue), 'i');
          return regex.test(String(fileValue));
        } catch {
          return false;
        }

      default:
        return false;
    }
  }

  private compareDates(dateStr1: string, dateStr2: string): number {
    try {
      const date1 = new Date(dateStr1);
      const date2 = new Date(dateStr2);

      if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
        console.warn(`无效的日期格式: ${dateStr1} 或 ${dateStr2}`);
        return 0;
      }

      const dateOnly1 = new Date(Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate()));
      const dateOnly2 = new Date(Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate()));

      const time1 = dateOnly1.getTime();
      const time2 = dateOnly2.getTime();

      if (time1 > time2) return 1;
      if (time1 < time2) return -1;
      return 0;
    } catch (error) {
      console.warn(`日期比较失败: ${dateStr1} vs ${dateStr2}`, error);
      return 0;
    }
  }

  private getDateOnly(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return dateStr;
      }

      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');

      return `${year}-${month}-${day}`;
    } catch (error) {
      console.warn(`获取日期部分失败: ${dateStr}`, error);
      return dateStr;
    }
  }

  private calculateRelativeDate(condition: Condition): string {
    const now = new Date();
    const value = condition.relativeDateValue || 7;
    const unit = condition.relativeDateUnit || 'days';
    const direction = condition.relativeDateDirection || 'ago';

    const targetDate = new Date(now);

    switch (unit) {
      case 'days':
        targetDate.setDate(now.getDate() + (direction === 'ago' ? -value : value));
        break;
      case 'weeks':
        targetDate.setDate(now.getDate() + (direction === 'ago' ? -value * 7 : value * 7));
        break;
      case 'months':
        targetDate.setMonth(now.getMonth() + (direction === 'ago' ? -value : value));
        break;
      case 'years':
        targetDate.setFullYear(now.getFullYear() + (direction === 'ago' ? -value : value));
        break;
      default:
        break;
    }

    return targetDate.toISOString().split('T')[0];
  }

  private matchesRelativeDate(fileValue: string, condition: Condition, operator: string): boolean {
    const now = new Date();
    const fileDate = new Date(fileValue);
    const value = condition.relativeDateValue || 7;
    const unit = condition.relativeDateUnit || 'days';
    const direction = condition.relativeDateDirection || 'ago';

    if (isNaN(fileDate.getTime())) {
      return false;
    }

    const timeDiff = now.getTime() - fileDate.getTime();

    let unitInMs: number;
    switch (unit) {
      case 'days':
        unitInMs = 24 * 60 * 60 * 1000;
        break;
      case 'weeks':
        unitInMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case 'months':
        unitInMs = 30 * 24 * 60 * 60 * 1000;
        break;
      case 'years':
        unitInMs = 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        unitInMs = 24 * 60 * 60 * 1000;
    }

    const targetTimeInMs = value * unitInMs;

    if (direction === 'ago') {
      switch (operator) {
        case 'greaterThan':
          return timeDiff > targetTimeInMs;
        case 'lessThan':
          return timeDiff < targetTimeInMs;
        case 'greaterThanOrEqual':
          return timeDiff >= targetTimeInMs;
        case 'lessThanOrEqual':
          return timeDiff <= targetTimeInMs;
        default:
          return false;
      }
    }

    switch (operator) {
      case 'greaterThan':
        return timeDiff < targetTimeInMs;
      case 'lessThan':
        return timeDiff > targetTimeInMs;
      case 'greaterThanOrEqual':
        return timeDiff <= targetTimeInMs;
      case 'lessThanOrEqual':
        return timeDiff >= targetTimeInMs;
      default:
        return false;
    }
  }

  private getFileValue(file: AppFile, field: string): string | number | boolean {
    switch (field) {
      case 'fileName':
        return file.isDirectory ? '' : file.name;
      case 'fileExtension':
        return file.isDirectory ? '' : path.extname(file.name).slice(1).toLowerCase();
      case 'fileSize':
        return file.isDirectory ? 0 : file.size;
      case 'fileType':
        return file.isDirectory ? '' : getFileTypeCategory(path.extname(file.name).slice(1));
      case 'filePath':
        return file.isDirectory ? '' : file.path;
      case 'folderName':
        return file.isDirectory ? file.name : '';
      case 'folderSize':
        return file.isDirectory ? (file.totalSize || 0) : 0;
      case 'folderFileCount':
        return file.isDirectory ? (file.fileCount || 0) : 0;
      case 'folderSubfolderCount':
        return file.isDirectory ? (file.folderCount || 0) : 0;
      case 'folderIsEmpty':
        return file.isDirectory ? (file.isEmpty || false) : false;
      case 'createdDate':
        return file.createdDate || '';
      case 'modifiedDate':
        return file.modifiedDate || file.createdDate || '';
      case 'itemType':
        return file.isDirectory ? 'folder' : 'file';
      default:
        return '';
    }
  }
}
