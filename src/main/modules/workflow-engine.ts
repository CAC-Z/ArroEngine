import { v4 as uuidv4 } from 'uuid';
import type {
  Workflow,
  ProcessStep,
  AppFile,
  Condition,
  ConditionGroup,
  WorkflowResult,
  StepResult,
  ProcessError,
  FileChange,
  DropGroup
} from '../../shared/types';
import { FileChangeType } from '../../shared/types';
import type { SupportedLanguage } from './workflow-engine/translations';
import { translate, translateError } from './workflow-engine/translations';
import { NamingService } from './workflow-engine/naming-service';
import { WorkflowValidationService } from './workflow-engine/validation-service';
import { WorkflowFileSystemService } from './workflow-engine/filesystem-service';
import { WorkflowInputService } from './workflow-engine/input-service';
import { WorkflowActionService } from './workflow-engine/action-service';
import { WorkflowResultService } from './workflow-engine/result-service';
import type { WorkflowExecutionState } from './workflow-engine/result-service';
import { WorkflowSafetyService } from './workflow-engine/safety-service';
import { WorkflowStepProcessor } from './workflow-engine/step-processor';

// 扩展ProcessError类型以支持建议
interface ExtendedProcessError extends ProcessError {
  suggestion?: string;
}

export class WorkflowEngine {
  private readonly validationService: WorkflowValidationService;
  private readonly fileSystem = new WorkflowFileSystemService();
  private readonly inputService: WorkflowInputService;
  private readonly actionService: WorkflowActionService;
  private readonly resultService: WorkflowResultService;
  private readonly safetyService: WorkflowSafetyService;
  private readonly stepProcessor: WorkflowStepProcessor;
  private currentLanguage: SupportedLanguage = 'zh-CN'; // 当前语言设置
  private store: any; // electron-store实例
  private isInterrupted: boolean = false; // 中断标志
  private currentExecution: WorkflowExecutionState | null = null; // 当前执行状态
  private readonly namingService = new NamingService();

  constructor(language: SupportedLanguage = 'zh-CN', store?: any) {
    this.currentLanguage = language;
    this.store = store;
    this.safetyService = new WorkflowSafetyService({
      translate: this.t.bind(this)
    });
    this.inputService = new WorkflowInputService({
      validatePath: this.safetyService.validatePath.bind(this.safetyService)
    });
    this.actionService = new WorkflowActionService(
      this.fileSystem,
      this.namingService,
      {
        validatePath: this.safetyService.validatePath.bind(this.safetyService),
        validateOperation: this.safetyService.validateOperation.bind(this.safetyService),
        categorizeError: this.safetyService.categorizeError.bind(this.safetyService)
      }
    );
    this.resultService = new WorkflowResultService();
    this.validationService = new WorkflowValidationService({
      translate: this.t.bind(this),
      filterFilesByProcessTarget: this.inputService.filterFilesByProcessTarget.bind(this.inputService)
    });
    this.stepProcessor = new WorkflowStepProcessor({
      validationService: this.validationService,
      actionService: this.actionService,
      fileSystem: this.fileSystem,
      translateError: this.translateError.bind(this)
    });
  }

  /**
   * 设置当前语言
   */
  setLanguage(language: SupportedLanguage) {
    this.currentLanguage = language;
  }

  /**
   * 翻译文本
   */
  private t(key: string, params?: Record<string, any>): string {
    return translate(this.currentLanguage, key, params ?? {});
  }

  /**
   * 中断当前执行
   */
  interrupt(): void {
    this.isInterrupted = true;
    console.warn('[工作流引擎] 收到中断信号，将在当前步骤完成后停止');
  }

  /**
   * 重置中断状态
   */
  resetInterrupt(): void {
    this.isInterrupted = false;
  }

  /**
   * 获取当前执行状态（用于异常恢复）
   */
  getCurrentExecutionState(): typeof this.currentExecution {
    return this.currentExecution;
  }

  /**
   * 清理所有缓存
   */
  clearCache() {
    this.inputService.clearCache();
    this.fileSystem.clearTrackingData();
    this.namingService.resetCounters();
  }

  /**
   * 翻译错误信息
   */
  private translateError(errorMessage: string): string {
    return translateError(this.currentLanguage, errorMessage);
  }

  /**
   * 智能查找在工作流中至少有一个步骤能够处理的文件
   * 这个函数识别所有潜在的"入口点"，包括第一个步骤和所有使用'original'输入源的步骤
   *
   * @param files 原始用户输入的文件列表
   * @param workflow 完整的工作流配置
   * @returns 在该工作流中至少有一个步骤能够处理的文件子集
   */
  public findInitiallyMatchingFiles(files: AppFile[], workflow: Workflow): AppFile[] {
    return this.validationService.findInitiallyMatchingFiles(files, workflow);
  }

  /**
   * 预览工作流执行结果
   */
  async preview(files: AppFile[], workflow: Workflow): Promise<WorkflowResult> {
    // 验证工作流配置
    const validation = this.validationService.validateWorkflowConfiguration(workflow);
    if (!validation.isValid) {
      throw new Error(`${this.t('workflow.configError')}:\n${validation.errors.join('\n')}`);
    }

    // 预览时也需要重置命名计数器，确保结果与实际执行一致
    this.namingService.resetCounters();

    // 验证输入文件与步骤的匹配性
    const inputValidation = this.validationService.validateWorkflowInputs(files, workflow);

    const startTime = new Date().toISOString();
    const stepResults: StepResult[] = [];
    let currentFiles = [...files];
    // 保存原始输入文件列表，用于处理 'original' 输入源
    const initialFiles = [...files];
    const errors: ExtendedProcessError[] = [];

    // 如果有匹配性问题，添加到错误列表但继续执行（用于显示详细信息）
    if (!inputValidation.isValid) {
      for (const issue of inputValidation.issues) {
        errors.push({
          file: '',
          error: issue.message,
          step: issue.stepId,
          suggestion: issue.suggestion
        });
      }
    }

    for (const step of workflow.steps.filter(s => s.enabled).sort((a, b) => a.order - b.order)) {
      const stepStart = Date.now();

      // 获取步骤的输入文件，传入原始文件列表
      const inputFiles = await this.inputService.getStepInputFiles(
        currentFiles,
        step,
        stepResults,
        initialFiles
      );

      // 处理步骤
      const { outputFiles, stepErrors, hasMatches } = await this.stepProcessor.preview(inputFiles, step);

      // 处理步骤没有匹配文件的情况
      if (!hasMatches) {
        const targetType = this.t(step.processTarget === 'folders' ? 'targetType.folders' : 'targetType.files');

        if (inputFiles.length === 0) {
          // 步骤没有输入文件（可能是前面的步骤过滤掉了所有文件）
          stepErrors.push({
            file: '',
            error: this.t('workflow.stepNoInput', { stepName: step.name }) + ' - ' + this.t('workflow.checkPreviousSteps'),
            step: step.id
          });
        } else {
          // 步骤有输入文件但没有匹配的文件
          stepErrors.push({
            file: '',
            error: this.t('workflow.stepNoMatches', { stepName: step.name, targetType }) + ' - ' + this.t('workflow.adjustStepTarget'),
            step: step.id
          });
        }
      }

      const inputMap = new Map(inputFiles.map(file => [file.id, file]));
      const processedInStep = outputFiles.filter(file =>
        this.isFileProcessed(inputMap.get(file.id), file)
      ).length;

      const stepResult: StepResult = {
        stepId: step.id,
        stepName: step.name,
        inputFiles,
        outputFiles,
        processedCount: processedInStep,
        errors: stepErrors,
        duration: Date.now() - stepStart
      };

      stepResults.push(stepResult);
      errors.push(...stepErrors);

      // 更新当前文件列表为步骤输出
      currentFiles = outputFiles;
    }

    const endTime = new Date().toISOString();
    
    // 计算实际处理的文件数量（所有步骤中实际被处理的文件总数）
    const totalProcessedFiles = stepResults.reduce((total, stepResult) => total + stepResult.processedCount, 0);

    // 生成文件变化记录
    const changes = this.resultService.generateFileChanges(stepResults, initialFiles);

    return {
      workflowId: workflow.id,
      stepResults,
      totalFiles: files.length,
      processedFiles: totalProcessedFiles,
      errors,
      startTime,
      endTime,
      duration: Date.parse(endTime) - Date.parse(startTime),
      changes
    };
  }

  /**
   * 批处理执行工作流
   */
  async executeBatch(files: AppFile[], workflow: Workflow, onProgress?: (progress: { processed: number; total: number; currentBatch: number; totalBatches: number }) => void): Promise<WorkflowResult> {
    // 从设置中获取批处理配置
    const batchSize = this.store?.get('workflow.processing.batchSize', 100) || 100;
    const batchInterval = this.store?.get('workflow.processing.batchInterval', 100) || 100;

    const totalFiles = files.length;
    const totalBatches = Math.ceil(totalFiles / batchSize);

    console.log(`开始批处理执行工作流: ${workflow.name}, 总文件数: ${totalFiles}, 批大小: ${batchSize}, 总批次: ${totalBatches}`);

    const startTime = new Date().toISOString();
    const allStepResults: StepResult[] = [];
    const allErrors: ProcessError[] = [];
    let processedCount = 0;

    // 重置创建的文件夹跟踪和counter映射
    this.fileSystem.clearTrackingData();
    this.namingService.resetCounters();
    this.inputService.clearCache();

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, totalFiles);
      const batchFiles = files.slice(startIndex, endIndex);

      console.log(`处理批次 ${batchIndex + 1}/${totalBatches}, 文件范围: ${startIndex}-${endIndex - 1}`);

      try {
        // 执行当前批次
        const batchResult = await this.execute(batchFiles, workflow, { resetState: batchIndex === 0 });

        // 合并结果
        allStepResults.push(...batchResult.stepResults);
        allErrors.push(...batchResult.errors);
        processedCount += batchResult.processedFiles;

        // 报告进度
        if (onProgress) {
          // 异步调用进度回调，避免阻塞批处理
          setImmediate(() => {
            onProgress({
              processed: processedCount,
              total: totalFiles,
              currentBatch: batchIndex + 1,
              totalBatches
            });
          });
        }

        // 批次间等待
        if (batchIndex < totalBatches - 1 && batchInterval > 0) {
          await new Promise(resolve => setTimeout(resolve, batchInterval));
        }

      } catch (error) {
        console.error(`批次 ${batchIndex + 1} 执行失败:`, error);
        allErrors.push({
          file: `批次 ${batchIndex + 1}`,
          step: '批处理执行',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

    // 生成文件变化记录（批处理模式下使用所有文件作为初始文件）
    const changes = this.resultService.generateFileChanges(allStepResults, files);

    return {
      workflowId: workflow.id,
      startTime,
      endTime,
      duration,
      totalFiles,
      processedFiles: processedCount,
      stepResults: allStepResults,
      errors: allErrors,
      changes
    };
  }

  /**
   * 执行工作流
   */
  async execute(files: AppFile[], workflow: Workflow, options: { resetState?: boolean } = {}): Promise<WorkflowResult> {
    const { resetState = true } = options;
    // 重置中断状态
    this.isInterrupted = false;

    // 验证工作流配置
    const validation = this.validationService.validateWorkflowConfiguration(workflow);
    if (!validation.isValid) {
      throw new Error(`工作流配置错误:\n${validation.errors.join('\n')}`);
    }

    const startTime = new Date().toISOString();
    const stepResults: StepResult[] = [];
    let currentFiles = [...files];
    // 保存原始输入文件列表，用于处理 'original' 输入源
    const initialFiles = [...files];
    const errors: ProcessError[] = [];

    // 初始化当前执行状态
    this.currentExecution = {
      workflowId: workflow.id,
      startTime,
      stepResults,
      processedFiles: 0,
      totalFiles: files.length,
      errors
    };

    if (resetState) {
      // 重置创建的文件夹跟踪和counter映射
      this.fileSystem.clearTrackingData();
      this.namingService.resetCounters();
      // 清理目录扫描缓存
      this.inputService.clearCache();
    }

    try {
      for (const step of workflow.steps.filter(s => s.enabled).sort((a, b) => a.order - b.order)) {
        // 检查是否被中断
        if (this.isInterrupted) {
          console.warn(`[工作流引擎] 在步骤"${step.name}"前检测到中断信号，停止执行`);
          errors.push({
            file: '',
            error: this.t('workflow.interrupted', { stepName: step.name }),
            step: step.id
          });
          break;
        }

        const stepStart = Date.now();

        // 获取步骤的输入文件，传入原始文件列表
        const inputFiles = await this.inputService.getStepInputFiles(
          currentFiles,
          step,
          stepResults,
          initialFiles
        );

        // 执行步骤
        const { outputFiles, stepErrors } = await this.stepProcessor.execute(inputFiles, step);

        const inputMap = new Map(inputFiles.map(file => [file.id, file]));
        const processedInStep = outputFiles.filter(file =>
          this.isFileProcessed(inputMap.get(file.id), file)
        ).length;

        const stepResult: StepResult = {
          stepId: step.id,
          stepName: step.name,
          inputFiles,
          outputFiles,
          processedCount: processedInStep,
          errors: stepErrors,
          duration: Date.now() - stepStart
        };

        stepResults.push(stepResult);
        errors.push(...stepErrors);

        // 更新当前执行状态
        if (this.currentExecution) {
          this.currentExecution.stepResults = [...stepResults];
          this.currentExecution.processedFiles = stepResults.reduce((total, sr) => total + sr.processedCount, 0);
          this.currentExecution.errors = [...errors];
        }

        // 更新当前文件列表为步骤输出
        currentFiles = outputFiles;

        // 再次检查中断状态（步骤执行后）
        if (this.isInterrupted) {
          console.warn(`[工作流引擎] 在步骤"${step.name}"后检测到中断信号，停止执行`);
          errors.push({
            file: '',
            error: `工作流在步骤"${step.name}"后被中断`,
            step: step.id
          });
          break;
        }
      }
    } catch (error) {
      // 捕获执行过程中的异常
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[工作流引擎] 执行过程中发生异常:', errorMessage);

      errors.push({
        file: '',
        error: `执行异常: ${errorMessage}`,
        step: 'system'
      });

      // 保存部分结果
      const partialResult = this.currentExecution
        ? this.resultService.createPartialResult(this.currentExecution)
        : null;
      if (partialResult) {
        // 清理执行状态
        this.currentExecution = null;
        return partialResult;
      }
    }

    const endTime = new Date().toISOString();

    // 默认清理机制：始终清理工作流创建的空文件夹（软件内部清理）
    try {
      await this.fileSystem.cleanupCreatedEmptyDirectories();
      console.log(`✅ 已清理工作流创建的空文件夹`);
    } catch (cleanupError) {
      console.warn('清理工作流创建的空文件夹时出错:', cleanupError);
      // 不影响主要的工作流结果
    }

    // 用户功能：如果启用，清理处理过程中遇到的所有空文件夹
    if (workflow.cleanupEmptyFolders === true) {
      try {
        await this.fileSystem.cleanupAllProcessedEmptyDirectories();
        console.log(`✅ 已清理处理过程中的所有空文件夹`);
      } catch (cleanupError) {
        console.warn('清理处理过程中的空文件夹时出错:', cleanupError);
        // 不影响主要的工作流结果
      }
    }

    // 计算实际处理的文件数量（所有步骤中实际被处理的文件总数）
    const totalProcessedFiles = stepResults.reduce((total, stepResult) => total + stepResult.processedCount, 0);

    // 生成文件变化记录
    const changes = this.resultService.generateFileChanges(stepResults, initialFiles);

    // 清理执行状态
    this.currentExecution = null;

    return {
      workflowId: workflow.id,
      stepResults,
      totalFiles: files.length,
      processedFiles: totalProcessedFiles,
      errors,
      startTime,
      endTime,
      duration: Date.parse(endTime) - Date.parse(startTime),
      changes
    };
  }



  /**
   * 理想的 processDroppedPaths 实现蓝图：处理用户拖拽的路径并返回工作流可处理的文件
   *
   * 这个方法体现了正确的设计原则：
   * 1. 职责分离：文件扫描和工作流验证是两个独立的步骤
   * 2. 数据保真：从路径到 AppFile 的转换过程是无损的，不受工作流配置影响
   * 3. 智能验证：只有在完整扫描后才进行工作流匹配验证
   *
   * @param paths 用户拖拽的原始路径数组
   * @param workflow 目标工作流配置
   * @returns 经过智能验证后，工作流可以处理的 AppFile 数组
   */
  public async processPathsWithWorkflow(paths: string[], workflow: Workflow): Promise<AppFile[]> {
    console.log(`🚀 开始处理 ${paths.length} 个路径，目标工作流: ${workflow.name}`);

    // 第一步：数据保真的文件扫描
    // 这一步确保每个用户输入的路径都被忠实地转换为 AppFile 对象
    // 不管工作流的配置如何，都不会提前过滤任何输入
    console.log(`📁 第一步：无损文件扫描...`);
    const allAppFiles = await this.createAppFilesFromPaths(paths);
    console.log(`📊 扫描结果: 创建了 ${allAppFiles.length} 个 AppFile 对象`);

    // 显示扫描到的文件详情（用于调试）
    if (allAppFiles.length > 0) {
      console.log(`📋 扫描到的文件详情:`);
      allAppFiles.forEach((file, index) => {
        const type = file.isDirectory ? '文件夹' : '文件';
        const empty = file.isDirectory && file.isEmpty ? ' (空)' : '';
        console.log(`  ${index + 1}. ${file.name} (${type}${empty})`);
      });
    }

    // 第二步：智能工作流验证
    // 这一步使用智能验证逻辑，识别工作流中所有可能的入口点
    // 并找出至少有一个步骤能够处理的文件
    console.log(`🧠 第二步：智能工作流验证...`);
    const validFiles = this.findInitiallyMatchingFiles(allAppFiles, workflow);
    console.log(`✅ 验证结果: ${validFiles.length} 个文件可被工作流处理`);

    // 显示验证结果详情
    if (validFiles.length > 0) {
      console.log(`📋 有效文件详情:`);
      validFiles.forEach((file, index) => {
        const type = file.isDirectory ? '文件夹' : '文件';
        const empty = file.isDirectory && file.isEmpty ? ' (空)' : '';
        console.log(`  ${index + 1}. ${file.name} (${type}${empty})`);
      });
    } else {
      console.log(`⚠️  没有文件能被当前工作流处理`);
      console.log(`💡 这可能意味着:`);
      console.log(`   - 工作流的处理目标与输入文件类型不匹配`);
      console.log(`   - 工作流的条件过滤规则过于严格`);
      console.log(`   - 需要检查工作流配置的合理性`);
    }

    // 第三步：返回结果
    console.log(`🎯 processPathsWithWorkflow 完成: ${paths.length} 个输入路径 → ${allAppFiles.length} 个扫描文件 → ${validFiles.length} 个有效文件`);
    return validFiles;
  }

  /**
   * 从指定路径加载文件或文件夹
   */
  private async loadItemsFromPath(
    targetPath: string,
    processTarget: 'files' | 'folders' | 'both' = 'files',
    processSubfolders: boolean = true,
    maxDepth: number = -1
  ): Promise<AppFile[]> {
    return this.inputService.loadItemsFromPath(targetPath, processTarget, processSubfolders, maxDepth);
  }

  /**
   * 检查文件或文件夹权限
   */
  public async checkPermissions(itemPath: string, operation: 'read' | 'write' | 'both' = 'both'): Promise<boolean> {
    return this.safetyService.checkPermissions(itemPath, operation);
  }

  /**
   * 检查磁盘空间是否足够
   */
  public async checkDiskSpace(targetPath: string, requiredSize: number): Promise<{ hasSpace: boolean; error?: string }> {
    return this.safetyService.checkDiskSpace(targetPath, requiredSize);
  }

  /**
   * 分类和翻译错误信息
   */
  public categorizeError(error: Error, operation: string, path: string): string {
    return this.safetyService.categorizeError(error, operation, path);
  }

  /**
   * 获取工作流执行过程中创建的文件夹列表
   */
  getCreatedDirectories(): string[] {
    return this.fileSystem.getCreatedDirectories();
  }

  /**
   * 获取并保存创建的文件夹列表（用于历史记录）
   * 这个方法会在清理之前调用，确保历史记录能获取到完整的文件夹列表
   */
  getAndPreserveCreatedDirectories(): string[] {
    return this.fileSystem.getAndPreserveCreatedDirectories();
  }

  /**
   * 清空创建的文件夹列表（在历史记录创建后调用）
   */
  clearCreatedDirectories(): void {
    this.fileSystem.clearCreatedDirectories();
  }

  /**
   * 获取被清理的空文件夹列表
   */
  getCleanedEmptyDirectories(): string[] {
    return this.fileSystem.getCleanedEmptyDirectories();
  }

  /**
   * 获取并保存被清理的空文件夹列表（用于历史记录）
   */
  getAndPreserveCleanedEmptyDirectories(): string[] {
    return this.fileSystem.getAndPreserveCleanedEmptyDirectories();
  }

  /**
   * 清空被清理空文件夹的跟踪列表（在历史记录创建后调用）
   */
  clearCleanedEmptyDirectories(): void {
    this.fileSystem.clearCleanedEmptyDirectories();
  }

  /**
   * 将拖拽路径转换为 DropGroup，并根据工作流配置过滤文件
   */
  public async createDropGroupsFromPaths(paths: string[], workflow: Workflow): Promise<DropGroup[]> {
    return this.inputService.createDropGroupsFromPaths(paths, workflow);
  }

  /**
   * 扫描路径并生成 AppFile 列表
   */
  public async createAppFilesFromPaths(paths: string[]): Promise<AppFile[]> {
    return this.inputService.createAppFilesFromPaths(paths);
  }

  private isFileProcessed(original: AppFile | undefined, current: AppFile): boolean {
    if (current.status === 'error') {
      return false;
    }

    const pathChanged = Boolean(original && current.path && current.path !== original.path);
    const newPathChanged = Boolean(original && current.newPath && current.newPath !== original.path);
    const nameChanged = Boolean(original && current.name && original.name && current.name !== original.name);

    if (current.deleted || current.operationType === 'delete') {
      return true;
    }

    if (current.operationType === 'copy') {
      return true;
    }

    if (!original) {
      return Boolean(current.operationType || current.newPath);
    }

    if (current.operationType === 'createFolder') {
      return true;
    }

    if (current.operationType && (pathChanged || newPathChanged || nameChanged)) {
      return true;
    }

    if (pathChanged || newPathChanged || nameChanged) {
      return true;
    }

    return false;
  }
}
