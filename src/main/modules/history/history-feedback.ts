export type FeedbackType = 'success' | 'warning' | 'error';

export interface UserFeedbackAction {
  label: string;
  action: string;
}

export interface UserFeedback {
  title: string;
  message: string;
  type: FeedbackType;
  actions?: UserFeedbackAction[];
}

export interface ErrorReportContext {
  operation: string;
  entryId?: string;
  timestamp?: string;
}

export interface ErrorSuggestionContext {
  operation?: string;
  filePath?: string;
  retryCount?: number;
}

export interface ErrorReport {
  summary: string;
  details: string[];
  suggestions: string[];
  severity: 'low' | 'medium' | 'high';
  canRetry: boolean;
}

/**
 * 根据错误文本生成用户可执行的建议。
 */
export function generateErrorSuggestion(error: string, context: ErrorSuggestionContext = {}): string {
  const baseError = error.toLowerCase();
  let suggestion = '';
  let priority: 'low' | 'medium' | 'high' = 'medium';

  if (baseError.includes('权限不足') || baseError.includes('eacces') || baseError.includes('eperm')) {
    priority = 'high';
    suggestion = '💡 权限问题解决方案：\n' +
      '  1. 以管理员身份运行程序\n' +
      '  2. 检查文件/文件夹权限设置\n' +
      '  3. 确保当前用户有足够的访问权限';

    if (context.filePath) {
      suggestion += `\n  4. 检查路径权限: ${context.filePath}`;
    }
  } else if (baseError.includes('文件被占用') || baseError.includes('ebusy') || baseError.includes('正在使用')) {
    priority = 'high';
    suggestion = '💡 文件占用解决方案：\n' +
      '  1. 关闭正在使用该文件的程序\n' +
      '  2. 检查是否有其他进程在访问文件\n' +
      '  3. 等待几秒后重试\n' +
      '  4. 重启相关应用程序';
  } else if (baseError.includes('磁盘空间不足') || baseError.includes('enospc') || baseError.includes('空间')) {
    priority = 'high';
    suggestion = '💡 磁盘空间解决方案：\n' +
      '  1. 清理磁盘空间（删除临时文件、回收站等）\n' +
      '  2. 选择其他有足够空间的位置\n' +
      '  3. 检查磁盘使用情况\n' +
      '  4. 考虑移动大文件到其他位置';
  } else if (baseError.includes('文件不存在') || baseError.includes('enoent') || baseError.includes('找不到')) {
    priority = 'medium';
    suggestion = '💡 文件缺失解决方案：\n' +
      '  1. 检查文件是否被手动删除或移动\n' +
      '  2. 确认文件路径是否正确\n' +
      '  3. 检查是否有其他程序移动了文件\n' +
      '  4. 考虑从备份恢复文件';
  } else if (baseError.includes('目标已存在') || baseError.includes('eexist') || baseError.includes('已存在')) {
    priority = 'medium';
    suggestion = '💡 文件冲突解决方案：\n' +
      '  1. 检查目标位置是否有同名文件\n' +
      '  2. 重命名冲突的文件\n' +
      '  3. 选择不同的目标位置\n' +
      '  4. 确认是否要覆盖现有文件';
  } else if (baseError.includes('网络') || baseError.includes('连接') || baseError.includes('超时')) {
    priority = 'medium';
    suggestion = '💡 网络问题解决方案：\n' +
      '  1. 检查网络连接状态\n' +
      '  2. 确认网络路径是否可访问\n' +
      '  3. 重试操作\n' +
      '  4. 检查防火墙设置';
  } else if (baseError.includes('路径') || baseError.includes('path') || baseError.includes('目录')) {
    priority = 'medium';
    suggestion = '💡 路径问题解决方案：\n' +
      '  1. 检查路径格式是否正确\n' +
      '  2. 确认路径长度不超过系统限制\n' +
      '  3. 检查路径中是否包含特殊字符\n' +
      '  4. 确认目录结构是否完整';
  } else {
    priority = 'low';
    suggestion = '💡 通用解决方案：\n' +
      '  1. 检查文件状态和系统环境\n' +
      '  2. 重启应用程序后重试\n' +
      '  3. 检查系统资源使用情况\n' +
      '  4. 必要时手动恢复文件';
  }

  if (context.retryCount && context.retryCount > 0) {
    suggestion += `\n\n⚠️ 已重试 ${context.retryCount} 次，建议检查根本原因`;
  }

  if (context.operation) {
    suggestion += `\n\n📋 操作类型: ${context.operation}`;
  }

  const priorityIcon = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
  return `${priorityIcon} ${suggestion}`;
}

/**
 * 为错误集合生成结构化报告。
 */
export function createErrorReport(errors: string[], context: ErrorReportContext): ErrorReport {
  if (errors.length === 0) {
    return {
      summary: '操作成功完成',
      details: [],
      suggestions: [],
      severity: 'low',
      canRetry: false
    };
  }

  let severity: 'low' | 'medium' | 'high' = 'low';
  let canRetry = true;

  const criticalErrors = errors.filter(error =>
    error.includes('权限不足') ||
    error.includes('磁盘空间') ||
    error.includes('系统错误')
  );

  const mediumErrors = errors.filter(error =>
    error.includes('文件被占用') ||
    error.includes('文件不存在') ||
    error.includes('目标已存在')
  );

  if (criticalErrors.length > 0) {
    severity = 'high';
    canRetry = false;
  } else if (mediumErrors.length > 0) {
    severity = 'medium';
    canRetry = true;
  }

  const summary = errors.length === 1
    ? `${context.operation}过程中发生1个错误`
    : `${context.operation}过程中发生${errors.length}个错误`;

  const suggestions = errors
    .map(error => generateErrorSuggestion(error, { operation: context.operation }))
    .filter((suggestion, index, array) => array.indexOf(suggestion) === index);

  return {
    summary,
    details: errors,
    suggestions,
    severity,
    canRetry
  };
}

export interface FeedbackContext {
  entryId?: string;
  fileCount?: number;
  duration?: number;
}

export interface FeedbackResult {
  success: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * 构建面向 UI 的用户反馈信息。
 */
export function generateUserFeedback(
  operation: string,
  result: FeedbackResult,
  context: FeedbackContext = {}
): UserFeedback {
  const errors = result.errors || [];
  const warnings = result.warnings || [];

  if (result.success && errors.length === 0 && warnings.length === 0) {
    return {
      title: `${operation}成功`,
      message: context.fileCount
        ? `成功处理了 ${context.fileCount} 个文件${context.duration ? `，用时 ${(context.duration / 1000).toFixed(1)} 秒` : ''}`
        : `${operation}操作已成功完成`,
      type: 'success'
    };
  }

  if (result.success && warnings.length > 0 && errors.length === 0) {
    return {
      title: `${operation}完成（有警告）`,
      message: `操作已完成，但有 ${warnings.length} 个警告需要注意：\n${warnings.slice(0, 3).join('\n')}${warnings.length > 3 ? '\n...' : ''}`,
      type: 'warning',
      actions: [
        { label: '查看详细信息', action: 'show_details' },
        { label: '忽略警告', action: 'dismiss' }
      ]
    };
  }

  if (!result.success && errors.length > 0) {
    const errorReport = createErrorReport(errors, { operation, entryId: context.entryId });

    return {
      title: `${operation}失败`,
      message: `${errorReport.summary}\n\n主要问题：\n${errorReport.details.slice(0, 2).join('\n')}${errorReport.details.length > 2 ? '\n...' : ''}`,
      type: 'error',
      actions: errorReport.canRetry
        ? [
            { label: '重试', action: 'retry' },
            { label: '查看解决方案', action: 'show_solutions' },
            { label: '手动处理', action: 'manual_fix' }
          ]
        : [
            { label: '查看解决方案', action: 'show_solutions' },
            { label: '手动处理', action: 'manual_fix' }
          ]
    };
  }

  return {
    title: `${operation}部分完成`,
    message: `操作部分完成，有 ${errors.length} 个错误和 ${warnings.length} 个警告`,
    type: 'warning',
    actions: [
      { label: '查看详细信息', action: 'show_details' },
      { label: '重试失败项', action: 'retry_failed' }
    ]
  };
}
