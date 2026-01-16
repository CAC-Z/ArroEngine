import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  AppFile,
  FileWatchConfig,
  MonitorExecutionResult,
  MonitorTask,
  ScheduledConfig
} from '../../../shared/types';
import { MonitorTaskRuntimeDeps } from './monitor-task-types';

const RECENT_FILE_THRESHOLD_MS = 3 * 60 * 1000;

export type TriggerSource = 'file_change' | 'scheduled' | 'manual';

export class MonitorTaskExecutor {
  private postExecutionHandler?: (task: MonitorTask, triggeredBy: TriggerSource) => void;

  constructor(private readonly deps: MonitorTaskRuntimeDeps) {}

  setPostExecutionHandler(handler: (task: MonitorTask, triggeredBy: TriggerSource) => void): void {
    this.postExecutionHandler = handler;
  }

  async executeTask(taskId: string, filePaths?: string[]): Promise<MonitorExecutionResult> {
    const task = this.deps.tasks.get(taskId);
    if (!task) {
      throw new Error(`监控任务不存在: ${taskId}`);
    }

    if (!task.enabled) {
      throw new Error(`监控任务已禁用: ${task.name}`);
    }

    if (this.deps.runningExecutions.has(taskId)) {
      throw new Error(`监控任务正在执行中: ${task.name}`);
    }

    let files: string[] = filePaths || [];

    if (files.length === 0) {
      const workflow = await this.deps.getWorkflow(task.workflowId);
      const includeSubfolders = workflow?.includeSubfolders !== false;

      if (task.type === 'file_watch') {
        const config = task.config as FileWatchConfig;
        for (const watchPath of config.watchPaths) {
          const pathFiles = await this.collectFilesFromPath(
            watchPath,
            includeSubfolders,
            undefined,
            config.ignorePatterns
          );
          files.push(...pathFiles);
        }
      } else if (task.type === 'scheduled') {
        const config = task.config as ScheduledConfig;
        const inputPaths = config.inputPaths || [config.inputPath];

        for (const inputPath of inputPaths) {
          if (inputPath && inputPath.trim()) {
            const pathFiles = await this.collectFilesFromPath(
              inputPath,
              includeSubfolders,
              undefined,
              config.ignorePatterns
            );
            files.push(...pathFiles);
          }
        }
      }
    }

    if (files.length === 0) {
      throw new Error('没有找到要处理的文件');
    }

    return this.executeTaskWithFiles(task, files, 'manual');
  }

  async executeTaskWithFiles(
    task: MonitorTask,
    filePaths: string[],
    triggeredBy: TriggerSource,
    triggerData?: any
  ): Promise<MonitorExecutionResult> {
    const executionId = uuidv4();
    const startTime = new Date().toISOString();

    this.deps.runningExecutions.set(task.id, executionId);
    task.status = 'running';
    await this.deps.saveTasks();

    try {
      const workflow = await this.deps.getWorkflow(task.workflowId);
      if (!workflow) {
        throw new Error(`工作流不存在: ${task.workflowId}`);
      }

      const files: AppFile[] = [];
      for (const filePath of filePaths) {
        try {
          const stat = await fs.stat(filePath);
          files.push({
            id: uuidv4(),
            name: path.basename(filePath),
            path: filePath,
            size: stat.size,
            type: this.getFileType(filePath),
            status: 'pending',
            createdDate: stat.birthtime.toISOString()
          });
        } catch (error) {
          console.error(`获取文件信息失败: ${filePath}`, error);
        }
      }

      const workflowResult = await this.deps.workflowEngine.execute(files, workflow);
      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      task.statistics.totalExecutions++;
      task.statistics.totalFilesProcessed += files.length;
      task.statistics.lastExecutionDuration = duration;

      if (workflowResult.errors.length === 0) {
        task.statistics.successfulExecutions++;
        this.deps.recordSuccessfulExecution(task);
      } else {
        task.statistics.failedExecutions++;
        const firstError = workflowResult.errors[0];
        this.deps.recordEnhancedError(
          task,
          firstError?.error || '未知错误',
          executionId,
          triggeredBy === 'scheduled' ? 'schedule' : triggeredBy,
          files.map(file => file.path),
          firstError?.step
        );
      }

      if (task.statistics.totalExecutions > 0) {
        const avgTime = task.statistics.averageExecutionTime || 0;
        task.statistics.averageExecutionTime =
          (avgTime * (task.statistics.totalExecutions - 1) + duration) / task.statistics.totalExecutions;
      }

      task.lastExecuted = endTime;
      task.status = 'idle';

      if (task.type === 'scheduled') {
        const config = task.config as ScheduledConfig;
        task.nextExecution = this.getNextExecutionTime(config.cronExpression);
      }

      await this.deps.saveTasks();

      const result: MonitorExecutionResult = {
        taskId: task.id,
        executionId,
        startTime,
        endTime,
        duration,
        status:
          workflowResult.errors.length === 0
            ? 'success'
            : workflowResult.processedFiles > 0
              ? 'partial'
              : 'error',
        filesProcessed: workflowResult.processedFiles,
        workflowResult,
        triggeredBy,
        triggerData
      };

      let createdHistoryEntry: any = null;
      if (triggeredBy === 'file_change' || triggeredBy === 'scheduled' || triggeredBy === 'manual') {
        try {
          const sourceType =
            triggeredBy === 'file_change' ? 'file_watch' : triggeredBy === 'scheduled' ? 'scheduled' : 'manual';
          const createdDirectories = this.deps.workflowEngine.getCreatedDirectories();
          const cleanedEmptyDirectories = this.deps.workflowEngine.getCleanedEmptyDirectories();
          const historyEntry = this.deps.historyManager.createEntryFromWorkflowResult(
            workflowResult,
            workflow,
            files,
            sourceType,
            task.id,
            task.name,
            createdDirectories,
            cleanedEmptyDirectories
          );

          if (Array.isArray(historyEntry)) {
            for (const entry of historyEntry) {
              await this.deps.historyManager.addEntry(entry);
            }
            createdHistoryEntry = historyEntry[0];
          } else {
            await this.deps.historyManager.addEntry(historyEntry);
            createdHistoryEntry = historyEntry;
          }
          console.log(`[历史记录] 已添加监控任务执行记录: ${task.name} (${sourceType})`);
        } catch (error) {
          console.error('[历史记录] 添加监控任务历史记录失败:', error);
        }
      }

      this.deps.emitEvent('executionCompleted', { result, historyEntry: createdHistoryEntry });
      return result;
    } catch (error) {
      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      task.statistics.totalExecutions++;
      task.statistics.failedExecutions++;
      task.status = 'error';

      this.deps.recordEnhancedError(
        task,
        error instanceof Error ? error : String(error),
        executionId,
        triggeredBy === 'scheduled' ? 'schedule' : triggeredBy,
        filePaths,
        undefined
      );

      await this.deps.saveTasks();

      const result: MonitorExecutionResult = {
        taskId: task.id,
        executionId,
        startTime,
        endTime,
        duration,
        status: 'error',
        filesProcessed: 0,
        workflowResult: {
          workflowId: task.workflowId,
          stepResults: [],
          processedFiles: 0,
          totalFiles: filePaths.length,
          errors: [
            {
              file: '',
              error: error instanceof Error ? error.message : String(error)
            }
          ],
          startTime,
          endTime,
          duration,
          changes: []
        },
        triggeredBy,
        triggerData
      };

      this.deps.emitEvent('executionFailed', result);
      throw error;
    } finally {
      this.deps.runningExecutions.delete(task.id);
      console.log(`[执行完成] 任务${task.name}: 执行完成，移除运行标记`);

      if (this.postExecutionHandler) {
        this.postExecutionHandler(task, triggeredBy);
      }
    }
  }

  async collectFilesFromPath(
    inputPath: string,
    recursive: boolean,
    maxFiles?: number,
    ignorePatterns?: string[]
  ): Promise<string[]> {
    const files: string[] = [];

    if (!fs.existsSync(inputPath)) {
      return files;
    }

    const stat = await fs.stat(inputPath);
    if (stat.isFile()) {
      if (this.shouldIgnoreFile(inputPath, ignorePatterns)) {
        return [];
      }
      return [inputPath];
    }

    if (stat.isDirectory()) {
      const entries = await fs.readdir(inputPath);

      for (const entry of entries) {
        if (maxFiles && files.length >= maxFiles) {
          break;
        }

        const fullPath = path.join(inputPath, entry);

        if (this.shouldIgnoreFile(fullPath, ignorePatterns)) {
          continue;
        }

        const entryStat = await fs.stat(fullPath);

        if (entryStat.isFile()) {
          files.push(fullPath);
        } else if (entryStat.isDirectory() && recursive) {
          const subFiles = await this.collectFilesFromPath(
            fullPath,
            recursive,
            maxFiles ? maxFiles - files.length : undefined,
            ignorePatterns
          );
          files.push(...subFiles);
        }
      }
    }

    return files;
  }

  async filterFilesByEvents(filePaths: string[], events: string[]): Promise<string[]> {
    if (!events || events.length === 0) {
      return filePaths;
    }

    const filteredFiles: string[] = [];
    const now = Date.now();

    for (const filePath of filePaths) {
      try {
        if (!fs.existsSync(filePath)) {
          continue;
        }

        const stats = await fs.stat(filePath);
        const isFile = stats.isFile();
        const isDirectory = stats.isDirectory();

        const createdTime = stats.birthtime.getTime();
        const modifiedTime = stats.mtime.getTime();
        const isRecentlyCreated = now - createdTime < RECENT_FILE_THRESHOLD_MS;
        const isRecentlyModified = now - modifiedTime < RECENT_FILE_THRESHOLD_MS && modifiedTime > createdTime;

        let shouldInclude = false;

        for (const event of events) {
          switch (event) {
            case 'add':
              if (isFile && isRecentlyCreated) {
                shouldInclude = true;
              }
              break;
            case 'change':
              if (isFile && isRecentlyModified) {
                shouldInclude = true;
              }
              break;
            case 'addDir':
              if (isDirectory && isRecentlyCreated) {
                shouldInclude = true;
              }
              break;
            case 'unlink':
            case 'unlinkDir':
              break;
            default:
              shouldInclude = true;
              break;
          }

          if (shouldInclude) {
            break;
          }
        }

        if (shouldInclude) {
          filteredFiles.push(filePath);
        }
      } catch (error) {
        console.error(`检查文件状态失败: ${filePath}`, error);
        filteredFiles.push(filePath);
      }
    }

    return filteredFiles;
  }

  getNextExecutionTime(cronExpression: string): string {
    try {
      const parts = cronExpression.trim().split(/\s+/);

      if (parts.length !== 5) {
        throw new Error('Invalid cron expression format, expected 5 parts');
      }

      const [minute, hour] = parts;
      const now = new Date();
      const nextTime = new Date(now);

      nextTime.setSeconds(0);
      nextTime.setMilliseconds(0);

      let targetMinute = 0;
      if (minute !== '*') {
        targetMinute = parseInt(minute, 10);
        if (Number.isNaN(targetMinute) || targetMinute < 0 || targetMinute > 59) {
          throw new Error('Invalid minute value');
        }
      }

      if (hour !== '*' && !hour.includes('/')) {
        const targetHour = parseInt(hour, 10);
        if (Number.isNaN(targetHour) || targetHour < 0 || targetHour > 23) {
          throw new Error('Invalid hour value');
        }

        nextTime.setHours(targetHour);
        nextTime.setMinutes(targetMinute);

        if (nextTime <= now) {
          nextTime.setDate(nextTime.getDate() + 1);
        }
      } else if (hour.includes('/')) {
        const match = hour.match(/\*\/(\d+)/);
        if (match) {
          const interval = parseInt(match[1], 10);
          if (interval > 0 && interval <= 24) {
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            let nextHour = currentHour;

            if (currentMinute >= targetMinute) {
              nextHour = currentHour + 1;
            }

            nextHour = Math.ceil(nextHour / interval) * interval;

            if (nextHour >= 24) {
              nextTime.setDate(nextTime.getDate() + 1);
              nextHour %= 24;
            }

            nextTime.setHours(nextHour);
            nextTime.setMinutes(targetMinute);
          }
        }
      } else {
        nextTime.setMinutes(targetMinute);

        if (now.getMinutes() >= targetMinute) {
          nextTime.setHours(nextTime.getHours() + 1);
        }
      }

      if (nextTime <= now) {
        nextTime.setTime(nextTime.getTime() + 60000);
      }

      return nextTime.toISOString();
    } catch (error) {
      console.error('计算下次执行时间失败:', error, '表达式:', cronExpression);
      const fallbackTime = new Date();
      fallbackTime.setHours(fallbackTime.getHours() + 1);
      fallbackTime.setMinutes(0);
      fallbackTime.setSeconds(0);
      fallbackTime.setMilliseconds(0);
      return fallbackTime.toISOString();
    }
  }

  private shouldIgnoreFile(filePath: string, ignorePatterns?: string[]): boolean {
    if (!ignorePatterns || ignorePatterns.length === 0) {
      return false;
    }

    const fileName = path.basename(filePath);
    const relativePath = filePath;

    for (const pattern of ignorePatterns) {
      if (!pattern.trim()) {
        continue;
      }

      if (this.matchPattern(fileName, pattern) || this.matchPattern(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  private matchPattern(text: string, pattern: string): boolean {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    const regex = new RegExp(`^${escaped}$`, 'i');
    return regex.test(text);
  }

  private getFileType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    const videoExts = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'];
    const audioExts = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma'];
    const documentExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
    const archiveExts = ['.zip', '.rar', '.7z', '.tar', '.gz'];

    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    if (documentExts.includes(ext)) return 'document';
    if (archiveExts.includes(ext)) return 'archive';

    return 'other';
  }
}
