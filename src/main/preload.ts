// src/main/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { AppFile, Workflow, WorkflowResult, HistoryEntry, MonitorTask, MonitorExecutionResult, MonitorTaskStatus, DropGroup } from '../shared/types';

// 定义我们将要暴露给前端的 API
const electronAPI = {
  openFile: (): Promise<string[]> => ipcRenderer.invoke('dialog:openFile'),
  openDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:openDirectory'),
  processDroppedPaths: (paths: string[], workflowId?: string): Promise<DropGroup[]> => ipcRenderer.invoke('files:processDroppedPaths', paths, workflowId),

  // 工作流操作
  previewWorkflow: (files: AppFile[], workflow: Workflow): Promise<WorkflowResult> =>
    ipcRenderer.invoke('workflows:preview', files, workflow),
  executeWorkflow: (files: AppFile[], workflow: Workflow): Promise<WorkflowResult> =>
    ipcRenderer.invoke('workflows:execute', files, workflow),

  // 工作流 CRUD 操作
  getAllWorkflows: (): Promise<Workflow[]> => ipcRenderer.invoke('workflows:getAll'),
  saveWorkflow: (workflow: Workflow): Promise<Workflow> => ipcRenderer.invoke('workflows:save', workflow),
  createWorkflow: (workflow: Workflow): Promise<Workflow> => ipcRenderer.invoke('workflows:save', workflow),
  updateWorkflow: (workflow: Workflow): Promise<Workflow> => ipcRenderer.invoke('workflows:save', workflow),
  deleteWorkflow: (workflowId: string): Promise<boolean> => ipcRenderer.invoke('workflows:delete', workflowId),
  getWorkflowById: (workflowId: string): Promise<Workflow | null> => ipcRenderer.invoke('workflows:getById', workflowId),
  resetToDefaultWorkflows: (language?: 'zh-CN' | 'en-US'): Promise<boolean> => ipcRenderer.invoke('workflows:resetToDefault', language),
  updateDefaultWorkflowLanguage: (language: 'zh-CN' | 'en-US'): Promise<boolean> => ipcRenderer.invoke('workflows:updateDefaultLanguage', language),

  // 历史记录操作
  getAllHistory: (limit?: number, offset?: number): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke('history:getAll', limit, offset),
  getHistory: (limit?: number, offset?: number): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke('history:getAll', limit, offset),
  searchHistory: (query: string, limit?: number): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke('history:search', query, limit),
  clearHistory: (): Promise<boolean> => ipcRenderer.invoke('history:clear'),
  deleteHistoryEntry: (entryId: string): Promise<boolean> =>
    ipcRenderer.invoke('history:delete', entryId),
  undoHistoryEntry: (entryId: string): Promise<{ success: boolean; message?: string; requiresChainUndo?: boolean; entryId?: string }> =>
    ipcRenderer.invoke('history:undo', entryId),
  chainUndoHistoryEntry: (entryId: string): Promise<{ success: boolean; message?: string }> =>
    ipcRenderer.invoke('history:chainUndo', entryId),
  redoHistoryEntry: (entryId: string): Promise<{ success: boolean; message?: string }> =>
    ipcRenderer.invoke('history:redo', entryId),
  getHistoryStats: (): Promise<{
    totalEntries: number;
    totalFiles: number;
    totalSuccessful: number;
    totalPartial: number;
    totalFailed: number;
    activeDays: number;
    lastActivity: string | null;
  }> => ipcRenderer.invoke('history:getStats'),
  getHistorySettings: (): Promise<{
    maxEntries: number;
    autoCleanupDays: number;
  }> => ipcRenderer.invoke('history:getSettings'),
  updateHistorySettings: (settings: { maxEntries?: number; autoCleanupDays?: number }): Promise<boolean> =>
    ipcRenderer.invoke('history:updateSettings', settings),

  // 监控功能操作
  getAllMonitorTasks: (): Promise<MonitorTask[]> => ipcRenderer.invoke('monitor:getAllTasks'),
  getMonitorTask: (taskId: string): Promise<MonitorTask | null> => ipcRenderer.invoke('monitor:getTask', taskId),
  createMonitorTask: (taskData: Omit<MonitorTask, 'id' | 'createdAt' | 'updatedAt' | 'statistics'>): Promise<MonitorTask> =>
    ipcRenderer.invoke('monitor:createTask', taskData),
  updateMonitorTask: (taskId: string, updates: Partial<MonitorTask>): Promise<MonitorTask | null> =>
    ipcRenderer.invoke('monitor:updateTask', taskId, updates),
  deleteMonitorTask: (taskId: string): Promise<boolean> => ipcRenderer.invoke('monitor:deleteTask', taskId),
  executeMonitorTask: (taskId: string, filePaths?: string[]): Promise<MonitorExecutionResult> =>
    ipcRenderer.invoke('monitor:executeTask', taskId, filePaths),
  getMonitorTaskStatus: (taskId: string): Promise<MonitorTaskStatus | null> =>
    ipcRenderer.invoke('monitor:getTaskStatus', taskId),
  getAllMonitorTaskStatuses: (): Promise<MonitorTaskStatus[]> => ipcRenderer.invoke('monitor:getAllTaskStatuses'),

  // 监控事件监听
  onMonitorTaskCreated: (callback: (task: MonitorTask) => void) => {
    ipcRenderer.on('monitor:taskCreated', (_, task) => callback(task));
  },
  onMonitorTaskUpdated: (callback: (task: MonitorTask) => void) => {
    ipcRenderer.on('monitor:taskUpdated', (_, task) => callback(task));
  },
  onMonitorTaskDeleted: (callback: (taskId: string) => void) => {
    ipcRenderer.on('monitor:taskDeleted', (_, taskId) => callback(taskId));
  },
  onMonitorExecutionCompleted: (callback: (data: { result: MonitorExecutionResult; historyEntry?: any }) => void) => {
    ipcRenderer.on('monitor:executionCompleted', (_, data) => callback(data));
  },

  // 工作流进度监听
  onWorkflowProgress: (callback: (progress: { processed: number; total: number; currentBatch?: number; totalBatches?: number }) => void) => {
    ipcRenderer.on('workflow-progress', (_, progress) => callback(progress));
  },
  onMonitorExecutionFailed: (callback: (result: MonitorExecutionResult) => void) => {
    ipcRenderer.on('monitor:executionFailed', (_, result) => callback(result));
  },
  onMonitorFilesDetected: (callback: (data: any) => void) => {
    ipcRenderer.on('monitor:filesDetected', (_, data) => callback(data));
  },
  onMonitorTaskError: (callback: (data: any) => void) => {
    ipcRenderer.on('monitor:taskError', (_, data) => callback(data));
  },

  // 工作流更新监听
  onWorkflowsUpdated: (callback: (data: { workflow: Workflow; isNew: boolean }) => void) => {
    ipcRenderer.on('workflows:updated', (_, data) => callback(data));
  },
  onWorkflowsDeleted: (callback: (data: { workflowId: string }) => void) => {
    ipcRenderer.on('workflows:deleted', (_, data) => callback(data));
  },

  // 获取设置
  getSetting: (key: string): Promise<any> => ipcRenderer.invoke('settings:get', key),
  
  // 设置值
  setSetting: (key: string, value: any): Promise<boolean> => ipcRenderer.invoke('settings:set', key, value),
  
  // 获取所有设置
  getAllSettings: (): Promise<Record<string, any>> => ipcRenderer.invoke('settings:getAll'),
  
  // 获取开机自启动状态
  getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke('auto-launch:get'),
  
  // 设置开机自启动状态
  setAutoLaunch: (enable: boolean): Promise<boolean> => ipcRenderer.invoke('auto-launch:set', enable),
  
  // 存储管理
  getStorageUsage: (): Promise<{
    appDataSize: number,
    historySize: number,
    tempSize: number,
    totalSize: number
  }> => ipcRenderer.invoke('storage:getUsage'),
  
  cleanTempFiles: (): Promise<boolean> => ipcRenderer.invoke('storage:cleanTemp'),
  
  // 窗口控制
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: (): Promise<boolean> => ipcRenderer.invoke('window:maximize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isWindowMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  resetWindowToDefaultSize: (): Promise<boolean> => ipcRenderer.invoke('window:resetToDefaultSize'),
};

// 使用 contextBridge 将 API 安全地挂载到前端的 window 对象上
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// ✅ 为了让 TypeScript 知道 window.electronAPI 的存在，我们需要扩展 Window 类型
// 在 renderer 进程中创建一个 .d.ts 文件来定义它