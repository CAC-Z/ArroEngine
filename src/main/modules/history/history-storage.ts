import fs from 'fs-extra';
import path from 'path';
import type { HistoryEntry } from '../../../shared/types';
import { HISTORY_FILE_PATH, HISTORY_CONFIG } from './history-config';

interface SaveOptions {
  updateCache?: boolean;
}

export class HistoryStorage {
  private memoryCache: HistoryEntry[] | null = null;
  private lastCleanupTime = 0;

  /**
   * 直接从磁盘读取完整历史记录（不使用缓存）
   */
  async readHistoryFile(): Promise<HistoryEntry[]> {
    try {
      if (await fs.pathExists(HISTORY_FILE_PATH)) {
        const data = await fs.readFile(HISTORY_FILE_PATH, 'utf-8');
        return JSON.parse(data) as HistoryEntry[];
      }
      return [];
    } catch (error) {
      console.error('Failed to load history:', error);
      return [];
    }
  }

  /**
   * 将历史记录写入磁盘
   */
  async writeHistoryFile(history: HistoryEntry[], options: SaveOptions = {}): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(HISTORY_FILE_PATH));
      await fs.writeFile(HISTORY_FILE_PATH, JSON.stringify(history, null, 2), 'utf-8');
      if (options.updateCache) {
        this.memoryCache = [...history];
      } else {
        this.memoryCache = null;
      }
    } catch (error) {
      console.error('Failed to save history:', error);
      throw error;
    }
  }

  /**
   * 获取历史记录（带缓存与自动清理）
   */
  async getEntries(limit?: number, offset?: number): Promise<HistoryEntry[]> {
    if (!this.memoryCache) {
      this.memoryCache = await this.readHistoryFile();

      if (this.memoryCache.length > HISTORY_CONFIG.MEMORY_CLEANUP_THRESHOLD) {
        const cleanedHistory = this.performCleanup([...this.memoryCache]);

        if (cleanedHistory.length !== this.memoryCache.length) {
          this.memoryCache = cleanedHistory;
          await this.writeHistoryFile(cleanedHistory, { updateCache: true });
        } else {
          this.memoryCache = cleanedHistory;
        }
      }
    }

    if (limit !== undefined && offset !== undefined) {
      return this.memoryCache.slice(offset, offset + limit);
    }

    return this.memoryCache;
  }

  /**
   * 执行历史记录清理策略
   */
  performCleanup(history: HistoryEntry[]): HistoryEntry[] {
    let result = [...history];
    const now = Date.now();

    if (result.length > HISTORY_CONFIG.MAX_ENTRIES) {
      result = result.slice(0, HISTORY_CONFIG.MAX_ENTRIES);
      console.log(`[历史记录] 按数量限制清理，保留最近${HISTORY_CONFIG.MAX_ENTRIES}条记录`);
    }

    if (now - this.lastCleanupTime > 60 * 60 * 1000) {
      const cutoffTime = now - HISTORY_CONFIG.AUTO_CLEANUP_DAYS * 24 * 60 * 60 * 1000;
      const beforeCount = result.length;

      result = result.filter(entry => {
        const entryTime = new Date(entry.timestamp).getTime();
        return entryTime > cutoffTime;
      });

      if (beforeCount !== result.length) {
        console.log(`[历史记录] 按时间清理，删除了${beforeCount - result.length}条超过${HISTORY_CONFIG.AUTO_CLEANUP_DAYS}天的记录`);
      }

      this.lastCleanupTime = now;
    }

    return result;
  }

  /**
   * 手动触发清理
   */
  async manualCleanup(): Promise<{ deletedCount: number; message: string }> {
    const history = await this.readHistoryFile();
    const cleanedHistory = this.performCleanup(history);
    const deletedCount = history.length - cleanedHistory.length;

    if (deletedCount > 0) {
      await this.writeHistoryFile(cleanedHistory, { updateCache: true });
      return {
        deletedCount,
        message: `已清理${deletedCount}条历史记录`
      };
    }

    this.memoryCache = [...history];
    return {
      deletedCount: 0,
      message: '无需清理'
    };
  }

  /**
   * 删除单条历史记录
   */
  async deleteEntry(entryId: string): Promise<boolean> {
    const history = await this.getEntries();
    const filteredHistory = history.filter(entry => entry.id !== entryId);

    if (filteredHistory.length !== history.length) {
      await this.writeHistoryFile(filteredHistory, { updateCache: true });
      return true;
    }

    return false;
  }

  /**
   * 清空历史记录
   */
  async clearHistory(): Promise<void> {
    await this.writeHistoryFile([], { updateCache: true });
  }

  /**
   * 清除内存缓存
   */
  clearCache(): void {
    this.memoryCache = null;
  }
}
