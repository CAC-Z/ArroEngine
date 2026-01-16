import type { BrowserWindow } from 'electron';
import { appState } from './app-state';
import type { WorkflowEngine } from './workflow-engine';
import type { MonitorManager } from './monitor-manager';

export const getStore = () => appState.store as any;

export const ensureStore = () => {
  const store = getStore();
  if (!store) {
    throw new Error('Store is not initialized');
  }
  return store;
};

export const getMainWindow = () => appState.mainWindow as BrowserWindow | null;

export const getWorkflowEngine = () => appState.workflowEngine as WorkflowEngine | null;

export const getMonitorManager = () => appState.monitorManager as MonitorManager | null;
