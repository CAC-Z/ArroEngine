import * as chokidar from 'chokidar';
import * as cron from 'node-cron';
import * as fs from 'fs-extra';
import { MonitorTask, FileWatchConfig, ScheduledConfig } from '../../../shared/types';
import { MonitorTaskRuntimeDeps } from './monitor-task-types';
import { MonitorTaskExecutor, TriggerSource } from './monitor-task-executor';

export class MonitorTaskFileManager {
  constructor(
    private readonly deps: MonitorTaskRuntimeDeps,
    private readonly executor: MonitorTaskExecutor
  ) {
    this.executor.setPostExecutionHandler(this.handlePostExecution.bind(this));
  }

  async startFileWatcher(task: MonitorTask): Promise<void> {
    const config = task.config as FileWatchConfig;

    const workflow = await this.deps.getWorkflow(task.workflowId);
    const includeSubfolders = workflow?.includeSubfolders !== false;

    const watcher = chokidar.watch(config.watchPaths, {
      ignored: config.ignorePatterns || [],
      persistent: true,
      ignoreInitial: true,
      depth: includeSubfolders ? undefined : 0,
      awaitWriteFinish: {
        stabilityThreshold: config.debounceMs,
        pollInterval: 100
      }
    });

    const changeQueue: { path: string; event: string; stats?: any }[] = [];
    let processTimeout: NodeJS.Timeout | null = null;

    const processChanges = async () => {
      if (changeQueue.length === 0) {
        return;
      }

      const changes = [...changeQueue];
      changeQueue.length = 0;

      try {
        await this.handleFileChanges(task, changes);
      } catch (error) {
        console.error(`处理文件变化失败: ${task.name}`, error);
      }
    };

    const queueChange = (event: string, filePath: string, stats?: any) => {
      changeQueue.push({ path: filePath, event, stats });

      if (processTimeout) {
        clearTimeout(processTimeout);
      }

      processTimeout = setTimeout(processChanges, config.batchTimeoutMs || 1000);
    };

    const cleanup = () => {
      if (processTimeout) {
        clearTimeout(processTimeout);
        processTimeout = null;
      }
      watcher.close().catch(error => {
        console.error(`关闭监控器失败: ${task.name}`, error);
      });
    };

    config.events.forEach(eventType => {
      watcher.on(eventType, (filePath: string, stats?: any) => {
        queueChange(eventType, filePath, stats);
      });
    });

    watcher.on('error', error => {
      console.error(`文件监控错误: ${task.name}`, error);
      this.deps.emitEvent('taskError', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    this.deps.watchers.set(task.id, watcher);
    this.deps.watcherCleanups.set(task.id, cleanup);
  }

  async startScheduledTask(task: MonitorTask): Promise<void> {
    const config = task.config as ScheduledConfig;

    if (!cron.validate(config.cronExpression)) {
      throw new Error(`无效的 cron 表达式: ${config.cronExpression}`);
    }

    const cronJob = cron.schedule(
      config.cronExpression,
      async () => {
        const currentTask = this.deps.tasks.get(task.id);
        if (!currentTask || !currentTask.enabled) {
          console.log(`定时任务已禁用，跳过执行: ${task.name}`);
          return;
        }

        if (config.skipIfRunning && currentTask.status === 'running') {
          console.log(`定时任务正在运行，跳过本次执行: ${task.name}`);
          return;
        }

        await this.executeScheduledTask(currentTask);
      },
      {
        timezone: config.timezone || 'Asia/Shanghai'
      }
    );

    this.deps.cronJobs.set(task.id, cronJob);

    task.nextExecution = this.executor.getNextExecutionTime(config.cronExpression);
    await this.deps.saveTasks();

    console.log(`定时任务已启动: ${task.name}, 下次执行: ${task.nextExecution}`);
  }

  async processQueuedFiles(task: MonitorTask): Promise<void> {
    console.log(`[队列处理] 任务${task.name}: 开始处理队列`);

    if (!task.enabled) {
      console.log(`[队列处理] 任务${task.name}: 任务已禁用，停止处理`);
      return;
    }

    if (this.deps.runningExecutions.has(task.id)) {
      console.log(`[队列处理] 任务${task.name}: 任务正在执行中，跳过处理`);
      return;
    }

    const queue = this.deps.fileQueues.get(task.id);
    if (!queue || queue.length === 0) {
      console.log(`[队列处理] 任务${task.name}: 队列为空，无需处理`);
      return;
    }

    const batchSize = this.deps.store.get('workflow.processing.batchSize', 100) as number;
    console.log(`[队列处理] 任务${task.name}: 队列中有${queue.length}个文件，批处理大小: ${batchSize}`);

    const batch = queue.splice(0, batchSize);
    const existingFiles = batch.filter(filePath => fs.existsSync(filePath) && fs.statSync(filePath).isFile());

    console.log(
      `[队列处理] 任务${task.name}: 从队列取出${batch.length}个文件，其中${existingFiles.length}个仍存在，队列剩余: ${queue.length}个`
    );

    if (existingFiles.length > 0) {
      try {
        console.log(`[队列处理] 任务${task.name}: 开始执行工作流处理${existingFiles.length}个文件`);
        await this.executor.executeTaskWithFiles(task, existingFiles, 'file_change', {
          changes: existingFiles.map(file => ({ path: file, event: 'add' }))
        });
        console.log(`[队列处理] 任务${task.name}: 完成处理${existingFiles.length}个文件`);
      } catch (error) {
        console.error(`[队列处理] 任务${task.name}: 处理失败`, error);
      }
    } else {
      console.log(`[队列处理] 任务${task.name}: 没有有效文件需要处理`);
    }
  }

  private async handleFileChanges(
    task: MonitorTask,
    changes: { path: string; event: string; stats?: any }[]
  ): Promise<void> {
    if (!task.enabled) {
      console.log(`[文件变化] 任务${task.name}已禁用，跳过处理`);
      return;
    }

    const config = task.config as FileWatchConfig;

    const filePaths = changes
      .filter(change => change.event === 'add' || change.event === 'change')
      .map(change => change.path)
      .filter(filePath => fs.existsSync(filePath) && fs.statSync(filePath).isFile());

    console.log(`[文件变化] 任务${task.name}: 检测到${changes.length}个变化，有效文件${filePaths.length}个`);

    if (filePaths.length === 0) {
      return;
    }

    if (config.autoExecute) {
      const globalBatchSize = this.deps.store.get('workflow.processing.batchSize', 100) as number;
      console.log(`[文件变化] 任务${task.name}: 自动执行已启用，批处理大小: ${globalBatchSize}`);

      this.addToFileQueue(task.id, filePaths);

      if (!this.deps.runningExecutions.has(task.id)) {
        console.log(`[文件变化] 任务${task.name}: 开始处理队列`);
        await this.processQueuedFiles(task);
      } else {
        console.log(`[文件变化] 任务${task.name}: 正在执行中，文件已加入队列等待`);
      }
    } else {
      console.log(`[文件变化] 任务${task.name}: 自动执行已禁用，发送检测事件`);
      this.deps.emitEvent('filesDetected', {
        taskId: task.id,
        files: filePaths,
        changes
      });
    }
  }

  private addToFileQueue(taskId: string, filePaths: string[]): void {
    if (!this.deps.fileQueues.has(taskId)) {
      this.deps.fileQueues.set(taskId, []);
    }

    const queue = this.deps.fileQueues.get(taskId)!;
    const newFiles = filePaths.filter(filePath => !queue.includes(filePath));
    queue.push(...newFiles);

    console.log(`[队列管理] 任务${taskId}: 新增${newFiles.length}个文件，队列总数: ${queue.length}`);
  }

  private async executeScheduledTask(task: MonitorTask): Promise<void> {
    if (!task.enabled || this.deps.runningExecutions.has(task.id)) {
      return;
    }

    const config = task.config as ScheduledConfig;

    try {
      const inputPaths = config.inputPaths || [config.inputPath];
      const allFiles: string[] = [];

      const workflow = await this.deps.getWorkflow(task.workflowId);
      const includeSubfolders = workflow?.includeSubfolders !== false;

      for (const inputPath of inputPaths) {
        if (inputPath && inputPath.trim()) {
          console.log(`[定时任务] ${task.name}: 收集路径 ${inputPath} 下的文件`);
          const pathFiles = await this.executor.collectFilesFromPath(
            inputPath,
            includeSubfolders,
            undefined,
            config.ignorePatterns
          );
          allFiles.push(...pathFiles);
          console.log(`[定时任务] ${task.name}: 路径 ${inputPath} 找到 ${pathFiles.length} 个文件`);
        }
      }

      if (allFiles.length === 0) {
        console.log(`[定时任务] ${task.name}: 所有路径均未找到文件`);
        return;
      }

      const filteredFiles = await this.executor.filterFilesByEvents(allFiles, config.events);
      if (filteredFiles.length === 0) {
        console.log(`[定时任务] ${task.name}: 根据监控事件过滤后无文件需要处理`);
        return;
      }

      console.log(`[定时任务] ${task.name}: 事件过滤后剩余 ${filteredFiles.length} 个文件需要处理`);
      console.log(`[定时任务] ${task.name}: 开始按顺序处理 ${filteredFiles.length} 个文件`);
      await this.executor.executeTaskWithFiles(task, filteredFiles, 'scheduled');
    } catch (error) {
      console.error(`执行定时任务失败: ${task.name}`, error);
    }
  }

  private handlePostExecution(task: MonitorTask, triggeredBy: TriggerSource): void {
    if (task.type === 'file_watch' && triggeredBy === 'file_change') {
      const queue = this.deps.fileQueues.get(task.id);
      if (queue && queue.length > 0 && task.enabled) {
        console.log(`[执行完成] 任务${task.name}: 队列中还有${queue.length}个文件待处理，将在1秒后继续处理`);
        setTimeout(() => {
          const currentTask = this.deps.tasks.get(task.id);
          if (currentTask && currentTask.enabled && !this.deps.runningExecutions.has(task.id)) {
            console.log(`[执行完成] 任务${task.name}: 开始处理下一批文件`);
            this.processQueuedFiles(currentTask).catch(error => {
              console.error(`[执行完成] 任务${task.name}: 处理下一批文件失败`, error);
            });
          } else {
            console.log(`[执行完成] 任务${task.name}: 任务状态已变化，取消队列处理`);
          }
        }, 1000);
      } else {
        console.log(`[执行完成] 任务${task.name}: 队列已清空或任务已禁用，所有文件处理完成`);
      }
    }
  }
}
