// 撤销系统的类型定义

export interface UndoOperation {
  id: string;
  type: 'move' | 'copy' | 'rename' | 'delete';
  timestamp: number;
  sourcePath: string;
  targetPath: string;
  originalName?: string; // 用于重命名操作
  isDirectory: boolean;
  size?: number; // 文件大小，用于统计
}

export interface UndoRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  executionId: string;
  timestamp: number;
  operations: UndoOperation[];
  status: 'completed' | 'partial' | 'failed';
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  canUndo: boolean; // 是否可以撤销
  undoReason?: string; // 不能撤销的原因
}

export interface UndoProgress {
  total: number;
  completed: number;
  current: string;
  errors: string[];
}

export interface UndoResult {
  success: boolean;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  errors: string[];
  message: string;
}

// 撤销策略配置
export interface UndoConfig {
  maxRecords: number; // 最大保留记录数
  maxAge: number; // 记录最大保存时间（毫秒）
  enableAutoCleanup: boolean; // 是否自动清理过期记录
  confirmBeforeUndo: boolean; // 撤销前是否需要确认
}
