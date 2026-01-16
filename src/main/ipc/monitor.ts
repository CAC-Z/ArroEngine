import { ipcMain } from 'electron';
import type { MonitorTask } from '../../shared/types';
import { getMonitorManager } from '../modules/app-context';

export const registerMonitorHandlers = () => {
  ipcMain.handle('monitor:getAllTasks', async () => {
    try {
      const monitorManager = getMonitorManager();
      if (!monitorManager) {
        throw new Error('监控管理器未初始化');
      }
      return monitorManager.getAllTasks();
    } catch (error) {
      console.error('Failed to get monitor tasks:', error);
      return [];
    }
  });

  ipcMain.handle('monitor:getTask', async (event, taskId: string) => {
    try {
      const monitorManager = getMonitorManager();
      if (!monitorManager) {
        throw new Error('监控管理器未初始化');
      }
      return monitorManager.getTask(taskId);
    } catch (error) {
      console.error('Failed to get monitor task:', error);
      return null;
    }
  });

  ipcMain.handle('monitor:createTask', async (event, taskData: Omit<MonitorTask, 'id' | 'createdAt' | 'updatedAt' | 'statistics'>) => {
    try {
      const monitorManager = getMonitorManager();
      if (!monitorManager) {
        throw new Error('监控管理器未初始化');
      }
      return await monitorManager.createTask(taskData);
    } catch (error) {
      console.error('Failed to create monitor task:', error);
      throw error;
    }
  });

  ipcMain.handle('monitor:updateTask', async (event, taskId: string, updates: Partial<MonitorTask>) => {
    try {
      const monitorManager = getMonitorManager();
      if (!monitorManager) {
        throw new Error('监控管理器未初始化');
      }
      return await monitorManager.updateTask(taskId, updates);
    } catch (error) {
      console.error('Failed to update monitor task:', error);
      throw error;
    }
  });

  ipcMain.handle('monitor:deleteTask', async (event, taskId: string) => {
    try {
      const monitorManager = getMonitorManager();
      if (!monitorManager) {
        throw new Error('监控管理器未初始化');
      }
      return await monitorManager.deleteTask(taskId);
    } catch (error) {
      console.error('Failed to delete monitor task:', error);
      return false;
    }
  });

  ipcMain.handle('monitor:executeTask', async (event, taskId: string, filePaths?: string[]) => {
    try {
      const monitorManager = getMonitorManager();
      if (!monitorManager) {
        throw new Error('监控管理器未初始化');
      }
      return await monitorManager.executeTask(taskId, filePaths);
    } catch (error) {
      console.error('Failed to execute monitor task:', error);
      throw error;
    }
  });

  ipcMain.handle('monitor:getTaskStatus', async (event, taskId: string) => {
    try {
      const monitorManager = getMonitorManager();
      if (!monitorManager) {
        throw new Error('监控管理器未初始化');
      }
      return monitorManager.getTaskStatus(taskId);
    } catch (error) {
      console.error('Failed to get task status:', error);
      return null;
    }
  });

  ipcMain.handle('monitor:getAllTaskStatuses', async () => {
    try {
      const monitorManager = getMonitorManager();
      if (!monitorManager) {
        throw new Error('监控管理器未初始化');
      }
      return monitorManager.getAllTaskStatuses();
    } catch (error) {
      console.error('Failed to get all task statuses:', error);
      return [];
    }
  });
};
