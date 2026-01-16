import { ipcMain } from 'electron';
import { ensureStore } from '../modules/app-context';

const { historyManager } = require('../modules/history-manager');

export const registerHistoryHandlers = () => {
  ipcMain.handle('history:getAll', async (event, limit?: number, offset?: number) => {
    try {
      return await historyManager.getEntries(limit, offset);
    } catch (error) {
      console.error('Failed to get history entries:', error);
      return [];
    }
  });

  ipcMain.handle('history:search', async (event, query: string, limit?: number) => {
    try {
      return await historyManager.searchEntries(query, limit);
    } catch (error) {
      console.error('Failed to search history entries:', error);
      return [];
    }
  });

  ipcMain.handle('history:clear', async () => {
    try {
      await historyManager.clearHistory();
      return true;
    } catch (error) {
      console.error('Failed to clear history:', error);
      return false;
    }
  });

  ipcMain.handle('history:delete', async (event, entryId: string) => {
    try {
      return await historyManager.deleteEntry(entryId);
    } catch (error) {
      console.error('Failed to delete history entry:', error);
      return false;
    }
  });

  ipcMain.handle('history:undo', async (event, entryId: string) => {
    try {
      return await historyManager.undoEntry(entryId);
    } catch (error) {
      console.error('Failed to undo history entry:', error);
      return { success: false, message: '撤销操作失败' };
    }
  });

  ipcMain.handle('history:redo', async (event, entryId: string) => {
    try {
      return await historyManager.redoEntry(entryId);
    } catch (error) {
      console.error('Failed to redo history entry:', error);
      return { success: false, message: '重做操作失败' };
    }
  });

  ipcMain.handle('history:chainUndo', async (event, entryId: string) => {
    try {
      return await historyManager.chainUndoEntry(entryId);
    } catch (error) {
      console.error('Failed to chain undo history entry:', error);
      return { success: false, message: '连锁撤回操作失败' };
    }
  });

  ipcMain.handle('history:getStats', async () => {
    try {
      const historyEntries = await historyManager.getEntries();

      const totalEntries = historyEntries.length;
      const recentDays = new Set<number>();
      const totalFiles = historyEntries.reduce((sum: number, entry: any) => sum + (entry.fileCount || 0), 0);
      const totalSuccessful = historyEntries.filter((entry: any) => entry.status === 'success').length;
      const totalPartial = historyEntries.filter((entry: any) => entry.status === 'partial').length;
      const totalFailed = historyEntries.filter((entry: any) => entry.status === 'error').length;

      const now = new Date();
      historyEntries.forEach((entry: any) => {
        const entryDate = new Date(entry.timestamp);
        const dayDiff = Math.floor((now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
        if (dayDiff < 30) {
          recentDays.add(Math.floor(entryDate.getTime() / (1000 * 60 * 60 * 24)));
        }
      });

      const activeDays = recentDays.size;

      return {
        totalEntries,
        totalFiles,
        totalSuccessful,
        totalPartial,
        totalFailed,
        activeDays,
        lastActivity: totalEntries > 0 ? historyEntries[0].timestamp : null
      };
    } catch (error) {
      console.error('Failed to get history stats:', error);
      return {
        totalEntries: 0,
        totalFiles: 0,
        totalSuccessful: 0,
        totalPartial: 0,
        totalFailed: 0,
        activeDays: 0,
        lastActivity: null
      };
    }
  });

  ipcMain.handle('history:getSettings', async () => {
    try {
      return {
        maxEntries: ensureStore().get('history.maxEntries', 1000),
        autoCleanupDays: ensureStore().get('history.autoCleanupDays', 30)
      };
    } catch (error) {
      console.error('Failed to get history settings:', error);
      return {
        maxEntries: 1000,
        autoCleanupDays: 30
      };
    }
  });

  ipcMain.handle('history:updateSettings', async (event, settings: { maxEntries?: number; autoCleanupDays?: number }) => {
    try {
      if (settings.maxEntries !== undefined) {
        ensureStore().set('history.maxEntries', settings.maxEntries);
      }

      if (settings.autoCleanupDays !== undefined) {
        ensureStore().set('history.autoCleanupDays', settings.autoCleanupDays);

        const entries = await historyManager.getEntries();
        if (entries.length > 0 && settings.autoCleanupDays > 0) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - settings.autoCleanupDays);

          const oldEntries = entries.filter((entry: any) => new Date(entry.timestamp) < cutoffDate);
          for (const entry of oldEntries) {
            await historyManager.deleteEntry(entry.id);
          }

          console.log(`已清理 ${oldEntries.length} 条过期历史记录`);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to update history settings:', error);
      return false;
    }
  });
};
