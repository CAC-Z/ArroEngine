import path from 'path';
import { app } from 'electron';

export const HISTORY_FILE_PATH = path.join(app.getPath('userData'), 'history.json');

export const HISTORY_CONFIG = {
  MAX_ENTRIES: 1000, // 最大历史记录数量
  AUTO_CLEANUP_DAYS: 30, // 自动清理超过30天的记录
  MEMORY_CLEANUP_THRESHOLD: 500, // 内存中超过500条时触发清理
  DUPLICATE_CHECK_WINDOW: 5000, // 重复检测时间窗口（毫秒）
  MIN_EXECUTION_INTERVAL: 1000 // 最小执行间隔（毫秒）
} as const;

export type HistoryConfig = typeof HISTORY_CONFIG;
