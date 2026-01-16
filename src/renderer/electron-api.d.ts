import { AppFile, Workflow, WorkflowResult, HistoryEntry, MonitorTask, MonitorExecutionResult, MonitorTaskStatus, DropGroup } from '@shared/types';

export interface IElectronAPI {
  openFile: () => Promise<string[]>;
  openDirectory: () => Promise<string | null>;
  processDroppedPaths: (paths: string[], workflowId?: string) => Promise<DropGroup[]>;

  // 工作流操作
  previewWorkflow: (files: AppFile[], workflow: Workflow) => Promise<WorkflowResult>;
  executeWorkflow: (files: AppFile[], workflow: Workflow) => Promise<WorkflowResult>;

  // 工作流 CRUD 操作
  getAllWorkflows: () => Promise<Workflow[]>;
  saveWorkflow: (workflow: Workflow) => Promise<Workflow>;
  deleteWorkflow: (workflowId: string) => Promise<boolean>;
  getWorkflowById: (workflowId: string) => Promise<Workflow | null>;
  resetToDefaultWorkflows: (language?: 'zh-CN' | 'en-US') => Promise<boolean>;
  updateDefaultWorkflowLanguage: (language: 'zh-CN' | 'en-US') => Promise<boolean>;

  // 历史记录操作
  getAllHistory: (limit?: number, offset?: number) => Promise<HistoryEntry[]>;
  getHistory: (limit?: number, offset?: number) => Promise<HistoryEntry[]>;
  searchHistory: (query: string, limit?: number) => Promise<HistoryEntry[]>;
  clearHistory: () => Promise<boolean>;
  deleteHistoryEntry: (entryId: string) => Promise<boolean>;
  undoHistoryEntry: (entryId: string) => Promise<{ success: boolean; message?: string; requiresChainUndo?: boolean; entryId?: string }>;
  chainUndoHistoryEntry: (entryId: string) => Promise<{ success: boolean; message?: string }>;
  redoHistoryEntry: (entryId: string) => Promise<{ success: boolean; message?: string }>;
  getHistoryStats: () => Promise<{
    totalEntries: number;
    totalFiles: number;
    totalSuccessful: number;
    totalPartial: number;
    totalFailed: number;
    activeDays: number;
    lastActivity: string | null;
  }>;
  getHistorySettings: () => Promise<{
    maxEntries: number;
    autoCleanupDays: number;
  }>;
  updateHistorySettings: (settings: { maxEntries?: number; autoCleanupDays?: number }) => Promise<boolean>;

  // 监控功能操作
  getAllMonitorTasks: () => Promise<MonitorTask[]>;
  getMonitorTask: (taskId: string) => Promise<MonitorTask | null>;
  createMonitorTask: (taskData: Omit<MonitorTask, 'id' | 'createdAt' | 'updatedAt' | 'statistics'>) => Promise<MonitorTask>;
  updateMonitorTask: (taskId: string, updates: Partial<MonitorTask>) => Promise<MonitorTask | null>;
  deleteMonitorTask: (taskId: string) => Promise<boolean>;
  executeMonitorTask: (taskId: string, filePaths?: string[]) => Promise<MonitorExecutionResult>;
  getMonitorTaskStatus: (taskId: string) => Promise<MonitorTaskStatus | null>;
  getAllMonitorTaskStatuses: () => Promise<MonitorTaskStatus[]>;

  // 监控事件监听
  onMonitorTaskCreated: (callback: (task: MonitorTask) => void) => void;
  onMonitorTaskUpdated: (callback: (task: MonitorTask) => void) => void;
  onMonitorTaskDeleted: (callback: (taskId: string) => void) => void;
  onMonitorExecutionCompleted: (callback: (data: { result: MonitorExecutionResult; historyEntry?: any }) => void) => void;

  // 工作流进度监听
  onWorkflowProgress: (callback: (progress: { processed: number; total: number; currentBatch?: number; totalBatches?: number }) => void) => void;
  onMonitorExecutionFailed: (callback: (result: MonitorExecutionResult) => void) => void;
  onMonitorFilesDetected: (callback: (data: any) => void) => void;
  onMonitorTaskError: (callback: (data: any) => void) => void;

  // 工作流更新监听
  onWorkflowsUpdated: (callback: (data: { workflow: Workflow; isNew: boolean }) => void) => void;
  onWorkflowsDeleted: (callback: (data: { workflowId: string }) => void) => void;

  // 设置相关
  getSetting: (key: string) => Promise<any>;
  setSetting: (key: string, value: any) => Promise<boolean>;
  getAllSettings: () => Promise<Record<string, any>>;
  
  // 开机自启动
  getAutoLaunch: () => Promise<boolean>;
  setAutoLaunch: (enable: boolean) => Promise<boolean>;
  
  // 存储管理
  getStorageUsage: () => Promise<{
    appDataSize: number;
    historySize: number;
    tempSize: number;
    totalSize: number;
  }>;
  cleanTempFiles: () => Promise<boolean>;
  
  // 窗口控制
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<boolean>;
  closeWindow: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
  resetWindowToDefaultSize: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

// 图片模块类型声明
declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.jpeg" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const value: string;
  export default value;
}

declare module "*.ico" {
  const value: string;
  export default value;
}