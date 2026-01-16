import { BrowserWindow } from 'electron';
import { appState } from './app-state';

const FIVE_MINUTES = 5 * 60 * 1000;

export const startResourceMonitoring = () => {
  stopResourceMonitoring();
  const timer = setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    console.log('内存使用情况 (MB):', memUsageMB);

    if (memUsageMB.heapUsed > 500) {
      console.warn('内存使用过高:', memUsageMB);
      const mainWindow = appState.mainWindow;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('resource-warning', {
          type: 'memory',
          usage: memUsageMB
        });
      }
    }

    if (appState.isDev && global.gc) {
      global.gc();
      console.log('执行垃圾回收');
    }
  }, FIVE_MINUTES);

  appState.resourceMonitorTimer = timer;
};

export const stopResourceMonitoring = () => {
  const timer = appState.resourceMonitorTimer;
  if (timer) {
    clearInterval(timer);
    appState.resourceMonitorTimer = null;
    console.log('资源监控已停止');
  }
};
