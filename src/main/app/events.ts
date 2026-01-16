import { app, BrowserWindow, ipcMain } from 'electron';
import { appState } from '../modules/app-state';
import { getMainWindow, getMonitorManager, getWorkflowEngine } from '../modules/app-context';
import { clearWorkflowsCache } from '../modules/workflow-storage';
import { stopResourceMonitoring } from '../modules/resource-monitor';
import { createMainWindow } from '../modules/window-manager';

export const registerAppEvents = () => {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      const tray = appState.tray;
      if (tray && !tray.isDestroyed()) {
        console.log('窗口关闭时销毁托盘图标...');
        tray.destroy();
        appState.tray = null;
      }
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  app.on('will-quit', () => {
    console.log('应用即将退出，执行最后的托盘清理...');

    const tray = appState.tray;
    if (tray && !tray.isDestroyed()) {
      console.log('will-quit: 强制销毁托盘图标');
      try {
        tray.destroy();
        appState.tray = null;

        if (process.platform === 'win32') {
          const start = Date.now();
          while (Date.now() - start < 100) {
            // busy wait to give system time to update tray icon
          }
        }
      } catch (error) {
        console.error('销毁托盘图标时出错:', error);
      }
    }
  });

  app.on('before-quit', async (event) => {
    console.log('应用准备退出，开始清理资源...');

    if (appState.isQuitting) {
      return;
    }

    event.preventDefault();
    appState.isQuitting = true;

    try {
      const cleanupTimeout = setTimeout(() => {
        console.warn('清理超时，强制退出');
        app.exit(1);
      }, 10000);

      const monitorManager = getMonitorManager();
      if (monitorManager) {
        console.log('清理监控管理器...');
        await monitorManager.cleanup();
        appState.monitorManager = null;
      }

      const workflowEngine = getWorkflowEngine();
      if (workflowEngine) {
        console.log('清理工作流引擎...');
        workflowEngine.interrupt();

        const currentState = workflowEngine.getCurrentExecutionState();
        if (currentState) {
          console.log('检测到正在执行的工作流，尝试保存部分结果...');
          try {
            console.log('部分执行状态:', {
              workflowId: currentState.workflowId,
              processedFiles: currentState.processedFiles,
              totalFiles: currentState.totalFiles,
              stepCount: currentState.stepResults.length
            });
          } catch (error) {
            console.error('保存部分执行结果失败:', error);
          }
        }

        appState.workflowEngine = null;
      }

      console.log('清理工作流缓存...');
      clearWorkflowsCache();

      stopResourceMonitoring();

      const tray = appState.tray;
      if (tray && !tray.isDestroyed()) {
        console.log('销毁系统托盘...');
        tray.destroy();
        appState.tray = null;
      }

      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('关闭主窗口...');
        mainWindow.destroy();
        appState.mainWindow = null;
      }

      console.log('清理 IPC 监听器...');
      ipcMain.removeAllListeners();

      console.log('清理定时器...');
      if (appState.isDev && (process as any)._getActiveHandles) {
        const handles = (process as any)._getActiveHandles();
        console.log(`活跃句柄数量: ${handles.length}`);
      }

      clearTimeout(cleanupTimeout);

      console.log('资源清理完成，退出应用');

      app.exit(0);
    } catch (error) {
      console.error('清理资源时出错:', error);
      app.exit(1);
    }
  });

  process.on('SIGINT', () => {
    console.log('收到 SIGINT 信号，准备退出...');
    if (!appState.isQuitting) {
      app.quit();
    }
  });

  process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，准备退出...');
    if (!appState.isQuitting) {
      app.quit();
    }
  });

  process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    if (!appState.isQuitting) {
      app.quit();
    }
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的 Promise 拒绝:', reason, 'at:', promise);
  });
};
