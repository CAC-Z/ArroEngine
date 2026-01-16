import * as chokidar from 'chokidar';
import * as cron from 'node-cron';
import {
  MonitorEvent,
  MonitorTask,
  Workflow
} from '../../../shared/types';
import { WorkflowEngine } from '../workflow-engine';
import { HistoryManager } from '../history-manager';

export type EmitFn = (event: MonitorEvent | string, payload: any) => void;

export interface MonitorTaskRuntimeDeps {
  tasks: Map<string, MonitorTask>;
  watchers: Map<string, chokidar.FSWatcher>;
  cronJobs: Map<string, cron.ScheduledTask>;
  runningExecutions: Map<string, string>;
  fileQueues: Map<string, string[]>;
  watcherCleanups: Map<string, () => void>;
  workflowEngine: WorkflowEngine;
  historyManager: HistoryManager;
  store: any;
  saveTasks: () => Promise<void>;
  getWorkflow: (workflowId: string) => Promise<Workflow | null>;
  emitEvent: EmitFn;
  recordEnhancedError: (
    task: MonitorTask,
    error: Error | string,
    executionId: string,
    triggeredBy: 'file_change' | 'schedule' | 'manual',
    filesInvolved?: string[],
    workflowStep?: string
  ) => void;
  recordSuccessfulExecution: (task: MonitorTask) => void;
}

