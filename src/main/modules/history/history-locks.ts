export class HistoryLockManager {
  private operationLocks: Map<string, Promise<any>> = new Map();
  private operationLockTimestamps: Map<string, number> = new Map();
  private isHistoryLocked = false;
  private historyLockTimestamp = 0;
  private lockCleanupInterval: NodeJS.Timeout | null = null;
  private readonly lockTimeout = 10 * 60 * 1000; // 10分钟超时

  start(): void {
    if (this.lockCleanupInterval) return;
    this.lockCleanupInterval = setInterval(() => {
      this.cleanupExpiredLocks();
    }, 5 * 60 * 1000);
  }

  stop(): void {
    if (this.lockCleanupInterval) {
      clearInterval(this.lockCleanupInterval);
      this.lockCleanupInterval = null;
    }
  }

  async acquireOperationLock(entryId: string, timeout: number = 60000): Promise<void> {
    const existingLock = this.operationLocks.get(entryId);
    if (!existingLock) return;

    console.log(`[并发控制] 等待操作锁释放: ${entryId}`);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`等待操作锁超时 (${timeout}ms): ${entryId}`));
      }, timeout);
    });

    try {
      await Promise.race([existingLock, timeoutPromise]);
      console.log(`[并发控制] 操作锁已释放: ${entryId}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('超时')) {
        console.warn(`[并发控制] 强制清理超时的操作锁: ${entryId}`);
        this.operationLocks.delete(entryId);
        this.operationLockTimestamps.delete(entryId);
        throw error;
      }
      throw error;
    }
  }

  registerOperation(entryId: string, promise: Promise<any>): void {
    this.operationLocks.set(entryId, promise);
    this.operationLockTimestamps.set(entryId, Date.now());
  }

  releaseOperationLock(entryId: string): void {
    this.operationLocks.delete(entryId);
    this.operationLockTimestamps.delete(entryId);
    console.log(`[并发控制] 操作锁已释放: ${entryId}`);
  }

  async acquireHistoryLock(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    let retryCount = 0;

    while (this.isHistoryLocked) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`获取历史记录锁超时 (${timeout}ms)，可能存在死锁。重试次数: ${retryCount}`);
      }

      retryCount++;
      const backoffDelay = Math.min(50 * Math.pow(1.1, retryCount / 10), 200);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));

      if (retryCount % 100 === 0) {
        console.warn(`[并发控制] 历史记录锁等待时间过长，已重试 ${retryCount} 次`);
      }
    }

    this.isHistoryLocked = true;
    this.historyLockTimestamp = Date.now();

    if (retryCount > 0) {
      console.log(`[并发控制] 成功获取历史记录锁，重试次数: ${retryCount}, 等待时间: ${Date.now() - startTime}ms`);
    }
  }

  releaseHistoryLock(): void {
    this.isHistoryLocked = false;
    this.historyLockTimestamp = 0;
  }

  private cleanupExpiredLocks(): void {
    const now = Date.now();

    for (const [entryId, timestamp] of this.operationLockTimestamps) {
      if (now - timestamp > this.lockTimeout) {
        console.warn(`[并发控制] 清理过期的操作锁: ${entryId}, 持续时间: ${now - timestamp}ms`);
        this.operationLocks.delete(entryId);
        this.operationLockTimestamps.delete(entryId);
      }
    }

    if (this.isHistoryLocked && this.historyLockTimestamp > 0) {
      if (now - this.historyLockTimestamp > this.lockTimeout) {
        console.warn(`[并发控制] 清理过期的历史记录锁, 持续时间: ${now - this.historyLockTimestamp}ms`);
        this.isHistoryLocked = false;
        this.historyLockTimestamp = 0;
      }
    }
  }
}
