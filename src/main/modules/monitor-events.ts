import { BrowserWindow } from 'electron';
import { getMonitorManager } from './app-context';

export const setupMonitorEventForwarding = () => {
  const monitorManager = getMonitorManager();
  if (!monitorManager) {
    return;
  }

  const broadcast = (channel: string, payload: unknown) => {
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, payload);
      }
    });
  };

  monitorManager.on('taskCreated', (task) => broadcast('monitor:taskCreated', task));
  monitorManager.on('taskUpdated', (task) => broadcast('monitor:taskUpdated', task));
  monitorManager.on('taskDeleted', (taskId) => broadcast('monitor:taskDeleted', taskId));
  monitorManager.on('executionCompleted', (data) => broadcast('monitor:executionCompleted', data));
  monitorManager.on('executionFailed', (result) => broadcast('monitor:executionFailed', result));
  monitorManager.on('filesDetected', (data) => broadcast('monitor:filesDetected', data));
  monitorManager.on('taskError', (data) => broadcast('monitor:taskError', data));
};
