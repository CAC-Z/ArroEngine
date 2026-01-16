import * as chokidar from 'chokidar';
import * as cron from 'node-cron';
import { EventEmitter } from 'events';
import {
  MonitorTask,
  MonitorExecutionResult,
  MonitorTaskStatus,
  MonitorErrorRecord,
  Workflow
} from '../../shared/types';
import { WorkflowEngine } from './workflow-engine';
import { HistoryManager } from './history-manager';
import { MonitorTaskRuntime } from './monitor/monitor-task-runtime';
import { v4 as uuidv4 } from 'uuid';

export class MonitorManager extends EventEmitter {
  private tasks: Map<string, MonitorTask> = new Map();
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private runningExecutions: Map<string, string> = new Map(); // taskId -> executionId
  private fileQueues: Map<string, string[]> = new Map(); // taskId -> pending files
  private watcherCleanups: Map<string, () => void> = new Map(); // taskId -> cleanup function
  private workflowEngine: WorkflowEngine;
  private historyManager: HistoryManager;
  private store: any; // electron-store instance
  private getWorkflowFn: (workflowId: string) => Promise<Workflow | null>;
  private runtime: MonitorTaskRuntime;

  constructor(workflowEngine: WorkflowEngine, historyManager: HistoryManager, store: any, getWorkflowFn: (workflowId: string) => Promise<Workflow | null>) {
    super();
    this.workflowEngine = workflowEngine;
    this.historyManager = historyManager;
    this.store = store;
    this.getWorkflowFn = getWorkflowFn;

    this.runtime = new MonitorTaskRuntime({
      tasks: this.tasks,
      watchers: this.watchers,
      cronJobs: this.cronJobs,
      runningExecutions: this.runningExecutions,
      fileQueues: this.fileQueues,
      watcherCleanups: this.watcherCleanups,
      workflowEngine: this.workflowEngine,
      historyManager: this.historyManager,
      store: this.store,
      saveTasks: this.saveTasks.bind(this),
      getWorkflow: this.getWorkflow.bind(this),
      emitEvent: (event, payload) => this.emit(event as string, payload),
      recordEnhancedError: this.recordEnhancedError.bind(this),
      recordSuccessfulExecution: this.recordSuccessfulExecution.bind(this)
    });
  }

  /**
   * 初始化监控管理器
   */
  async initialize(): Promise<void> {
    await this.loadTasks();
  }

  /**
   * 加载所有监控任务
   */
  private async loadTasks(): Promise<void> {
    try {
      const savedTasks = this.store.get('monitorTasks', []) as MonitorTask[];
      for (const task of savedTasks) {
        this.tasks.set(task.id, task);
        if (task.enabled) {
          await this.startTask(task.id);
        }
      }
      console.log(`已加载 ${savedTasks.length} 个监控任务`);
    } catch (error) {
      console.error('加载监控任务失败:', error);
    }
  }

  /**
   * 保存所有监控任务
   */
  private async saveTasks(): Promise<void> {
    try {
      const tasksArray = Array.from(this.tasks.values());
      console.log(`[保存任务] 保存${tasksArray.length}个监控任务到存储`);
      this.store.set('monitorTasks', tasksArray);
      console.log(`[保存任务] 任务保存成功`);
    } catch (error) {
      console.error('[保存任务] 保存监控任务失败:', error);
      throw error; // 重新抛出错误，让调用者知道保存失败
    }
  }

  /**
   * 创建新的监控任务
   */
  async createTask(taskData: Omit<MonitorTask, 'id' | 'createdAt' | 'updatedAt' | 'statistics'>): Promise<MonitorTask> {
    const task: MonitorTask = {
      ...taskData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statistics: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalFilesProcessed: 0
      }
    };

    this.tasks.set(task.id, task);
    await this.saveTasks();

    if (task.enabled) {
      await this.startTask(task.id);
    }

    this.emit('taskCreated', task);
    return task;
  }

  /**
   * 更新监控任务
   */
  async updateTask(taskId: string, updates: Partial<MonitorTask>): Promise<MonitorTask | null> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`监控任务不存在: ${taskId}`);
    }

    const wasEnabled = task.enabled;
    const updatedTask = {
      ...task,
      ...updates,
      id: taskId, // 确保ID不被修改
      updatedAt: new Date().toISOString()
    };

    console.log(`[监控任务] 更新任务 ${task.name}: ${wasEnabled} -> ${updatedTask.enabled}`);

    // 处理启用/禁用状态变化
    if (wasEnabled && !updatedTask.enabled) {
      // 禁用任务：先更新任务数据，然后停止任务
      console.log(`[更新任务] 禁用任务: ${task.name}`);
      this.tasks.set(taskId, updatedTask);
      await this.saveTasks();
      await this.stopTask(taskId);
      // 获取stopTask更新后的最新任务状态
      const finalTask = this.tasks.get(taskId) || updatedTask;
      console.log(`[更新任务] 禁用完成，最终状态:`, finalTask.enabled, finalTask.status);
      this.emit('taskUpdated', finalTask);
      return finalTask;
    } else if (!wasEnabled && updatedTask.enabled) {
      // 启用任务：先更新任务数据，然后启动
      this.tasks.set(taskId, updatedTask);
      await this.saveTasks();
      await this.startTask(taskId);
      // 获取startTask更新后的最新状态
      const finalTask = this.tasks.get(taskId) || updatedTask;
      this.emit('taskUpdated', finalTask);
      return finalTask;
    } else if (updatedTask.enabled) {
      // 如果任务仍然启用，重启以应用新配置
      this.tasks.set(taskId, updatedTask);
      await this.saveTasks();
      await this.stopTask(taskId);
      await this.startTask(taskId);
      // 获取重启后的最新状态
      const finalTask = this.tasks.get(taskId) || updatedTask;
      this.emit('taskUpdated', finalTask);
      return finalTask;
    } else {
      // 任务保持禁用状态，只更新数据
      this.tasks.set(taskId, updatedTask);
      await this.saveTasks();
      this.emit('taskUpdated', updatedTask);
      return updatedTask;
    }
  }

  /**
   * 删除监控任务
   */
  async deleteTask(taskId: string): Promise<boolean> {
    console.log(`[删除任务] 开始删除任务: ${taskId}`);

    const task = this.tasks.get(taskId);
    if (!task) {
      console.log(`[删除任务] 任务不存在: ${taskId}`);
      return false;
    }

    console.log(`[删除任务] 停止任务: ${task.name}`);
    await this.stopTask(taskId);

    console.log(`[删除任务] 从内存中删除任务`);
    this.tasks.delete(taskId);
    await this.saveTasks();

    console.log(`[删除任务] 发送删除事件`);
    this.emit('taskDeleted', taskId);

    console.log(`[删除任务] 删除完成: ${taskId}`);
    return true;
  }

  /**
   * 获取所有监控任务
   */
  getAllTasks(): MonitorTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取单个监控任务
   */
  getTask(taskId: string): MonitorTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * 启动监控任务
   */
  async startTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || !task.enabled) {
      return;
    }

    try {
      if (task.type === 'file_watch') {
        await this.runtime.startFileWatcher(task);
      } else if (task.type === 'scheduled') {
        await this.runtime.startScheduledTask(task);
      }

      // 更新任务状态
      task.status = 'idle';
      await this.saveTasks();

      console.log(`监控任务已启动: ${task.name}`);
    } catch (error) {
      console.error(`启动监控任务失败: ${task.name}`, error);
      task.status = 'error';
      await this.saveTasks();
    }
  }

  /**
   * 停止监控任务
   */
  async stopTask(taskId: string): Promise<void> {
    console.log(`[停止任务] 开始停止任务: ${taskId}`);

    const task = this.tasks.get(taskId);
    if (!task) {
      console.log(`[停止任务] 任务不存在: ${taskId}`);
      return;
    }

    console.log(`[停止任务] 停止任务: ${task.name}, 当前状态: ${task.status}`);

    // 停止文件监控
    const watcher = this.watchers.get(taskId);
    if (watcher) {
      console.log(`[停止任务] 关闭文件监控器`);

      // 先调用清理函数
      const cleanup = this.watcherCleanups.get(taskId);
      if (cleanup) {
        console.log(`[停止任务] 执行清理函数`);
        cleanup();
        this.watcherCleanups.delete(taskId);
      }

      // 然后关闭监控器
      await watcher.close();
      this.watchers.delete(taskId);
    }

    // 停止定时任务
    const cronJob = this.cronJobs.get(taskId);
    if (cronJob) {
      console.log(`[停止任务] 停止定时任务`);
      cronJob.stop();
      cronJob.destroy();
      this.cronJobs.delete(taskId);
    }

    // 清理执行队列和状态
    console.log(`[停止任务] 清理执行队列和状态`);
    this.fileQueues.delete(taskId);
    this.runningExecutions.delete(taskId);

    // 更新任务状态
    task.status = 'disabled';
    await this.saveTasks();

    console.log(`[停止任务] 监控任务已停止: ${task.name}, enabled: ${task.enabled}, status: ${task.status}`);
  }

  /**
   * 手动执行监控任务
   */
  async executeTask(taskId: string, filePaths?: string[]): Promise<MonitorExecutionResult> {
    return this.runtime.executeTask(taskId, filePaths);
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): MonitorTaskStatus | null {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    const isRunning = this.runningExecutions.has(taskId);
    const executionId = this.runningExecutions.get(taskId);

    const status: MonitorTaskStatus = {
      taskId,
      isRunning,
      currentExecution: isRunning && executionId ? {
        executionId,
        startTime: new Date().toISOString(), // 这里应该记录实际开始时间
        filesBeingProcessed: 0 // 这里应该记录实际处理的文件数
      } : undefined,
      nextScheduledRun: task.nextExecution,
      lastRun: task.lastExecuted ? {
        timestamp: task.lastExecuted,
        status: task.statistics.lastError ? 'error' : 'success',
        duration: task.statistics.lastExecutionDuration || 0,
        filesProcessed: task.statistics.totalFilesProcessed
      } : undefined
    };

    return status;
  }

  /**
   * 获取所有任务状态
   */
  getAllTaskStatuses(): MonitorTaskStatus[] {
    return Array.from(this.tasks.keys()).map(taskId => this.getTaskStatus(taskId)).filter(Boolean) as MonitorTaskStatus[];
  }

  /**
   * 获取工作流
   */
  private async getWorkflow(workflowId: string): Promise<Workflow | null> {
    return await this.getWorkflowFn(workflowId);
  }

  /**
   * 记录增强的错误信息
   */
  private recordEnhancedError(
    task: MonitorTask,
    error: Error | string,
    executionId: string,
    triggeredBy: 'file_change' | 'schedule' | 'manual',
    filesInvolved: string[] = [],
    workflowStep?: string
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack : undefined;

    // 确定错误类型
    let errorType: MonitorErrorRecord['errorType'] = 'system_error';
    if (errorMessage.includes('工作流') || errorMessage.includes('workflow')) {
      errorType = 'workflow_error';
    } else if (errorMessage.includes('文件') || errorMessage.includes('路径') || errorMessage.includes('ENOENT') || errorMessage.includes('EACCES')) {
      errorType = 'file_access_error';
    } else if (errorMessage.includes('配置') || errorMessage.includes('config')) {
      errorType = 'configuration_error';
    }

    // 获取系统信息
    const systemInfo = {
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      diskSpace: 0 // 简化实现，实际可以获取磁盘空间
    };

    const errorRecord: MonitorErrorRecord = {
      timestamp: new Date().toISOString(),
      error: errorMessage,
      errorType,
      context: {
        executionId,
        triggeredBy,
        filesInvolved,
        workflowStep,
        systemInfo
      },
      stackTrace
    };

    // 初始化错误历史
    if (!task.statistics.errorHistory) {
      task.statistics.errorHistory = [];
    }

    // 添加错误记录，保持最近50条
    task.statistics.errorHistory.unshift(errorRecord);
    if (task.statistics.errorHistory.length > 50) {
      task.statistics.errorHistory = task.statistics.errorHistory.slice(0, 50);
    }

    // 更新连续失败次数
    task.statistics.consecutiveFailures = (task.statistics.consecutiveFailures || 0) + 1;

    // 更新基本错误信息
    task.statistics.lastError = errorMessage;
    task.statistics.lastErrorTime = errorRecord.timestamp;

    console.error(`[监控错误] 任务${task.name}: ${errorType} - ${errorMessage}`, {
      executionId,
      triggeredBy,
      filesCount: filesInvolved.length,
      consecutiveFailures: task.statistics.consecutiveFailures
    });
  }

  /**
   * 记录成功执行
   */
  private recordSuccessfulExecution(task: MonitorTask): void {
    // 重置连续失败次数
    task.statistics.consecutiveFailures = 0;
    task.statistics.lastSuccessTime = new Date().toISOString();
  }

  /**
   * 获取任务的错误统计摘要
   */
  getTaskErrorSummary(taskId: string): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: MonitorErrorRecord[];
    consecutiveFailures: number;
    lastSuccessTime?: string;
  } | null {
    const task = this.tasks.get(taskId);
    if (!task || !task.statistics.errorHistory) {
      return null;
    }

    const errorHistory = task.statistics.errorHistory;
    const errorsByType: Record<string, number> = {};

    // 统计错误类型
    for (const error of errorHistory) {
      errorsByType[error.errorType] = (errorsByType[error.errorType] || 0) + 1;
    }

    return {
      totalErrors: errorHistory.length,
      errorsByType,
      recentErrors: errorHistory.slice(0, 10), // 最近10个错误
      consecutiveFailures: task.statistics.consecutiveFailures || 0,
      lastSuccessTime: task.statistics.lastSuccessTime
    };
  }

  /**
   * 获取所有任务的错误概览
   */
  getAllTasksErrorOverview(): Array<{
    taskId: string;
    taskName: string;
    status: string;
    consecutiveFailures: number;
    lastError?: string;
    lastErrorTime?: string;
  }> {
    const overview: Array<{
      taskId: string;
      taskName: string;
      status: string;
      consecutiveFailures: number;
      lastError?: string;
      lastErrorTime?: string;
    }> = [];

    for (const [taskId, task] of this.tasks) {
      overview.push({
        taskId,
        taskName: task.name,
        status: task.status,
        consecutiveFailures: task.statistics.consecutiveFailures || 0,
        lastError: task.statistics.lastError,
        lastErrorTime: task.statistics.lastErrorTime
      });
    }

    return overview.sort((a, b) => b.consecutiveFailures - a.consecutiveFailures);
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('开始清理监控管理器资源...');

    try {
      // 停止所有监控任务
      const taskIds = Array.from(this.tasks.keys());
      console.log(`停止 ${taskIds.length} 个监控任务`);

      for (const taskId of taskIds) {
        try {
          await this.stopTask(taskId);
        } catch (error) {
          console.error(`停止任务 ${taskId} 失败:`, error);
        }
      }

      // 强制清理所有监控器
      console.log(`清理 ${this.watchers.size} 个文件监控器`);
      for (const [taskId, watcher] of this.watchers.entries()) {
        try {
          await watcher.close();
        } catch (error) {
          console.error(`关闭监控器 ${taskId} 失败:`, error);
        }
      }
      this.watchers.clear();

      // 强制清理所有定时任务
      console.log(`清理 ${this.cronJobs.size} 个定时任务`);
      for (const [taskId, cronJob] of this.cronJobs.entries()) {
        try {
          cronJob.stop();
          cronJob.destroy();
        } catch (error) {
          console.error(`清理定时任务 ${taskId} 失败:`, error);
        }
      }
      this.cronJobs.clear();

      // 清理所有队列和执行状态
      this.fileQueues.clear();
      this.runningExecutions.clear();
      this.tasks.clear();

      // 清理所有监听器
      this.removeAllListeners();

      console.log('监控管理器资源清理完成');
    } catch (error) {
      console.error('清理监控管理器资源时出错:', error);
      throw error;
    }
  }
}
