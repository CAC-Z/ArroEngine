// src/shared/types.ts

// 拖拽分组接口 - 表示一次用户输入（拖拽或选择）的完整上下文
export interface DropGroup {
  rootPath: string;    // 用户拖入或选择的原始顶级路径
  files: AppFile[];    // 从该 rootPath 中解析出的所有待处理项的列表
}

// 文件信息接口
export interface AppFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  status: 'pending' | 'success' | 'error';
  newPath?: string;
  deleted?: boolean;
  operationType?: 'move' | 'copy' | 'rename' | 'delete' | 'createFolder';
  error?: string;
  createdDate?: string;
  modifiedDate?: string;
  isDirectory?: boolean; // 标识是否为文件夹
  originalDir?: string; // 记录文件的原始目录路径，用于工作流步骤间的状态管理
  sourceFileId?: string; // 若由其他文件生成（如复制），记录源文件ID
  sourceFilePath?: string; // 若由其他文件生成，记录源文件路径
  skipped?: boolean;
  // 文件夹特有属性
  fileCount?: number; // 文件夹内文件数量
  folderCount?: number; // 文件夹内子文件夹数量
  totalSize?: number; // 文件夹总大小
  depth?: number; // 文件夹深度级别
  isEmpty?: boolean; // 文件夹是否为空
}

// 新的工作流系统
export interface Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  order: number;
  steps: ProcessStep[];
  createdAt: string;
  updatedAt: string;
  defaultInputPath?: string; // 默认输入路径，用于一键执行
  cleanupEmptyFolders?: boolean; // 是否清理空文件夹，默认为true
  includeSubfolders?: boolean; // 是否包含子文件夹，默认为true
}

export interface ProcessStep {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  order: number;
  inputSource: InputSource;
  conditions: ConditionGroup;
  actions: Action[];
  outputPath?: string;
  processTarget: 'files' | 'folders'; // 处理对象类型
}

export interface InputSource {
  type: 'original' | 'previous_step' | 'specific_path';
  stepId?: string;
  path?: string;
}

export interface ConditionGroup {
  id?: string;
  operator: 'AND' | 'OR';
  conditions: Condition[];
  groups?: ConditionGroup[];
}

export interface Condition {
  id: string;
  field: 'fileName' | 'fileExtension' | 'fileSize' | 'fileType' | 'createdDate' | 'modifiedDate' | 'filePath' |
        'folderName' | 'folderSize' | 'folderFileCount' | 'folderSubfolderCount' | 'folderIsEmpty' | 'itemType';
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'in' |
           'notEquals' | 'notContains' | 'notStartsWith' | 'notEndsWith' | 'notIn' | 'is';
  value: string | number | string[] | boolean;
  enabled: boolean;
  // 文件大小条件的单位
  sizeUnit?: 'B' | 'KB' | 'MB' | 'GB';
  // 日期条件的类型和配置
  dateType?: 'absolute' | 'relative';
  relativeDateValue?: number;
  relativeDateUnit?: 'days' | 'weeks' | 'months' | 'years';
  relativeDateDirection?: 'ago' | 'within';
}

export interface Action {
  id: string;
  type: 'move' | 'copy' | 'rename' | 'delete' | 'createFolder';
  enabled: boolean;
  config: ActionConfig;
}

export interface ActionConfig {
  targetPath?: string;
  targetPathType?: 'input_folder' | 'specific_path'; // 目标路径类型：输入文件夹或指定路径
  createSubfolders?: boolean; // 保留向后兼容，等同于 classifyBy: 'fileType'

  // 新的分类系统
  classifyBy?: 'fileType' | 'createdDate' | 'modifiedDate' | 'fileSize' | 'extension' | 'preserveStructure';

  // 日期分类配置
  dateGrouping?: 'year' | 'yearMonth' | 'yearMonthDay' | 'quarter' | 'monthName';

  // 文件大小分类配置
  sizeClassifyMode?: 'preset' | 'custom';
  sizePreset?: 'general' | 'photo' | 'video';
  customSizeRanges?: FileSizeRange[];
  namingPattern?: 'original' | 'timestamp' | 'date' | 'file-created' | 'file-modified' | 'counter' | 'custom' | 'prefix' | 'suffix' | 'replace' | 'case' | 'advanced';
  dateFormat?: string;
  customPattern?: string;
  counterStart?: number;
  counterPadding?: number;
  confirmDelete?: boolean;
  // 新增的重命名配置
  prefix?: string;
  suffix?: string;
  replaceFrom?: string;
  replaceTo?: string;
  caseType?: 'lower' | 'upper' | 'title' | 'camel' | 'pascal' | 'snake' | 'kebab';
  removeSpaces?: boolean;
  removeSpecialChars?: boolean;
  // 高级模式配置
  advancedRules?: AdvancedNamingRule[];
  // 文件夹相关配置
  deleteEmptyFolders?: boolean; // 是否删除空文件夹
  deleteNonEmptyFolders?: boolean; // 是否删除非空文件夹
  preserveFolderStructure?: boolean; // 是否保持文件夹结构

  // 步骤级别的子文件夹处理配置
  processSubfolders?: boolean; // 是否处理子文件夹
  maxDepth?: number; // 最大处理深度，-1表示无限制
}

export interface AdvancedNamingRule {
  id: string;
  type: 'prefix' | 'suffix' | 'replace' | 'case' | 'counter' | 'date' | 'custom';
  value: string;
  enabled: boolean;
  order: number;
  config?: {
    dateFormat?: string;
    counterStart?: number;
    counterPadding?: number;
    caseType?: string;
    replaceFrom?: string;
    replaceTo?: string;
  };
}

// 文件变化类型枚举
export enum FileChangeType {
  RENAMED = 'renamed',      // 文件或文件夹仅名称发生改变，但父目录未变
  MOVED = 'moved',          // 文件或文件夹被移动到新的目录
  MODIFIED = 'modified',    // 文件内容发生了改变，但其路径和名称均未改变
  DELETED = 'deleted',      // 文件或文件夹在工作流处理后被删除
  COPIED = 'copied',        // 基于一个现有文件创建了一个副本
  CREATED = 'created'       // 创建了新的文件或文件夹
}

// 文件变化对象
export interface FileChange {
  type: FileChangeType;           // 变化类型
  file: AppFile | null;           // 变化后的文件状态，对于被删除的文件此字段为 null
  originalFile: AppFile | null;   // 变化前的原始文件状态，对于新创建的文件此字段为 null
  stepId: string;                 // 导致此次变化的工作流步骤ID
}

// 工作流执行结果
export interface WorkflowResult {
  workflowId: string;
  stepResults: StepResult[];
  totalFiles: number;
  processedFiles: number;
  errors: ProcessError[];
  startTime: string;
  endTime: string;
  duration: number;
  changes: FileChange[];          // 新增：文件变化记录数组
}

export interface StepResult {
  stepId: string;
  stepName: string;
  inputFiles: AppFile[];
  outputFiles: AppFile[];
  processedCount: number;
  errors: ProcessError[];
  duration: number;
}

export interface ProcessError {
  file: string;
  error: string;
  step?: string;
}

// 历史记录相关类型
export interface HistoryEntry {
  id: string;
  timestamp: string;
  workflowId: string;
  workflowName: string;
  stepId?: string;
  stepName?: string;
  fileOperations: FileOperation[];
  status: 'success' | 'error' | 'partial';
  duration: number;
  totalFiles: number;
  processedFiles: number;
  errors: ProcessError[];
  // 撤销相关字段
  canUndo?: boolean;
  isUndone?: boolean;
  undoTimestamp?: string;
  undoWarning?: string;
  // 工作流执行过程中创建的文件夹（用于撤销时清理）
  createdDirectories?: string[];
  // 被清理的空文件夹（用于撤销时恢复）
  cleanedEmptyDirectories?: string[];
  // 监控来源相关字段
  source?: 'manual' | 'file_watch' | 'scheduled';
  monitorTaskId?: string;
  monitorTaskName?: string;
}

export interface FileOperation {
  id: string;
  fileId?: string;
  originalPath: string;
  originalName: string;
  newPath?: string;
  newName?: string;
  operation: 'move' | 'copy' | 'rename' | 'delete' | 'createFolder';
  status: 'success' | 'error';
  error?: string;
  fileType: string;
  fileSize: number;
  // 步骤级别信息（可选）
  stepId?: string;
  stepName?: string;
}

// 监控功能相关类型定义
export interface MonitorTask {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'file_watch' | 'scheduled';
  workflowId: string;
  createdAt: string;
  updatedAt: string;
  lastExecuted?: string;
  nextExecution?: string;
  status: 'idle' | 'running' | 'error' | 'disabled';
  config: FileWatchConfig | ScheduledConfig;
  statistics: MonitorStatistics;
}

// 文件监控配置
  export interface FileWatchConfig {
    watchPaths: string[];
    ignorePatterns?: string[];
    debounceMs: number;
    events: FileWatchEvent[];
    autoExecute: boolean;
    recursive?: boolean;
    batchSize?: number;
    batchTimeoutMs?: number;
  }

// 定时任务配置
export interface ScheduledConfig {
  cronExpression: string;
  timezone?: string;
  inputPath: string; // 保持向后兼容
  inputPaths?: string[]; // 新的多路径支持
  skipIfRunning: boolean;
    // 与文件监控完全相同的高级配置
    ignorePatterns?: string[];
    debounceMs: number; // 改为必需字段，与FileWatchConfig一致
    events: FileWatchEvent[]; // 改为必需字段，与FileWatchConfig一致
    recursive?: boolean;
    batchSize?: number;
    batchTimeoutMs?: number;
  }

// 文件监控事件类型
export type FileWatchEvent = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

// 监控统计信息
export interface MonitorStatistics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalFilesProcessed: number;
  lastExecutionDuration?: number;
  averageExecutionTime?: number;
  lastError?: string;
  lastErrorTime?: string;
  // 增强的错误信息
  errorHistory?: MonitorErrorRecord[];
  consecutiveFailures?: number;
  lastSuccessTime?: string;
}

// 监控错误记录
export interface MonitorErrorRecord {
  timestamp: string;
  error: string;
  errorType: 'workflow_error' | 'file_access_error' | 'system_error' | 'configuration_error';
  context: {
    executionId: string;
    triggeredBy: 'file_change' | 'schedule' | 'manual';
    filesInvolved: string[];
    workflowStep?: string;
    systemInfo?: {
      memoryUsage?: number;
      diskSpace?: number;
    };
  };
  stackTrace?: string;
}

// 监控事件
export interface MonitorEvent {
  id: string;
  taskId: string;
  type: 'execution_started' | 'execution_completed' | 'execution_failed' | 'file_detected' | 'task_enabled' | 'task_disabled';
  timestamp: string;
  data: any;
  message?: string;
}

// 监控执行结果
export interface MonitorExecutionResult {
  taskId: string;
  executionId: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'success' | 'error' | 'partial';
  filesProcessed: number;
  workflowResult: WorkflowResult;
  triggeredBy: 'file_change' | 'scheduled' | 'manual';
  triggerData?: any;
}

// 文件大小范围定义
export interface FileSizeRange {
  id: string;
  minSize: number; // 字节数
  maxSize: number; // 字节数，-1 表示无限大
  unit: 'B' | 'KB' | 'MB' | 'GB';
  folderName: string;
}

// 监控任务状态
export interface MonitorTaskStatus {
  taskId: string;
  isRunning: boolean;
  currentExecution?: {
    executionId: string;
    startTime: string;
    filesBeingProcessed: number;
  };
  nextScheduledRun?: string;
  lastRun?: {
    timestamp: string;
    status: 'success' | 'error' | 'partial';
    duration: number;
    filesProcessed: number;
  };
}

// 兼容性：保留旧的Rule接口用于迁移
export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: Condition[];
  actions: Action[];
  matchType: 'ALL' | 'ANY';
  order: number;
}
