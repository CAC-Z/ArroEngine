import {
  MonitorExecutionResult,
  MonitorTask
} from '../../../shared/types';
import { MonitorTaskExecutor } from './monitor-task-executor';
import { MonitorTaskFileManager } from './monitor-task-file-manager';
import { MonitorTaskRuntimeDeps } from './monitor-task-types';

export class MonitorTaskRuntime {
  private readonly executor: MonitorTaskExecutor;
  private readonly fileManager: MonitorTaskFileManager;

  constructor(private readonly deps: MonitorTaskRuntimeDeps) {
    this.executor = new MonitorTaskExecutor(this.deps);
    this.fileManager = new MonitorTaskFileManager(this.deps, this.executor);
  }

  async startFileWatcher(task: MonitorTask): Promise<void> {
    await this.fileManager.startFileWatcher(task);
  }

  async startScheduledTask(task: MonitorTask): Promise<void> {
    await this.fileManager.startScheduledTask(task);
  }

  async executeTask(taskId: string, filePaths?: string[]): Promise<MonitorExecutionResult> {
    return this.executor.executeTask(taskId, filePaths);
  }
}

export { MonitorTaskRuntimeDeps } from './monitor-task-types';

