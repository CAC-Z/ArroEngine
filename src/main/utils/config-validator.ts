// 配置验证工具
import type { Workflow, ProcessStep, ActionConfig, MonitorTask } from '@shared/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 验证工作流配置
 */
export function validateWorkflow(workflow: Workflow): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 基本字段验证
  if (!workflow.id || typeof workflow.id !== 'string') {
    errors.push('工作流ID不能为空');
  }

  if (!workflow.name || typeof workflow.name !== 'string') {
    errors.push('工作流名称不能为空');
  }

  if (!Array.isArray(workflow.steps)) {
    errors.push('工作流步骤必须是数组');
  }

  // 允许新建的工作流没有步骤，但如果有步骤则必须至少有一个启用的步骤
  if (workflow.steps && workflow.steps.length > 0) {
    const enabledSteps = workflow.steps.filter((step: any) => step.enabled);
    if (enabledSteps.length === 0) {
      warnings.push('工作流没有启用的步骤，无法执行');
    }
  }

  // 验证步骤
  workflow.steps?.forEach((step: any, index: number) => {
    const stepErrors = validateWorkflowStep(step, index);
    errors.push(...stepErrors.errors);
    warnings.push(...stepErrors.warnings);
  });

  // 检查步骤ID重复
  const stepIds = workflow.steps?.map((step: any) => step.id) || [];
  const duplicateIds = stepIds.filter((id: any, index: number) => stepIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    errors.push(`发现重复的步骤ID: ${duplicateIds.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 验证工作流步骤
 */
export function validateWorkflowStep(step: ProcessStep, stepIndex: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!step.id) {
    errors.push(`步骤 ${stepIndex + 1}: ID不能为空`);
  }

  if (!step.name) {
    errors.push(`步骤 ${stepIndex + 1}: 名称不能为空`);
  }

  // 允许步骤在配置过程中没有动作，但如果步骤已启用且没有动作则给出警告
  if (!Array.isArray(step.actions) || step.actions.length === 0) {
    if (step.enabled) {
      warnings.push(`步骤 ${stepIndex + 1}: 已启用但没有配置动作，无法执行`);
    }
  }

  // 验证动作配置
  step.actions?.forEach((action: any, actionIndex: number) => {
    if (!action.type) {
      errors.push(`步骤 ${stepIndex + 1}, 动作 ${actionIndex + 1}: 动作类型不能为空`);
    }

    // 验证特定动作类型的配置
    const actionErrors = validateActionConfig(action.config, action.type, stepIndex, actionIndex);
    errors.push(...actionErrors.errors);
    warnings.push(...actionErrors.warnings);
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 验证动作配置
 */
export function validateActionConfig(
  config: any,
  actionType: string,
  stepIndex: number,
  actionIndex: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const prefix = `步骤 ${stepIndex + 1}, 动作 ${actionIndex + 1}`;

  if (!config) {
    errors.push(`${prefix}: 动作配置不能为空`);
    return { isValid: false, errors, warnings };
  }

  switch (actionType) {
    case 'move':
    case 'copy':
      // 只有在选择"指定路径"模式时才要求目标路径不能为空
      // 如果是"输入文件夹"模式，则不需要targetPath
      const pathType = config.targetPathType || (config.targetPath ? 'specific_path' : 'input_folder');
      if (pathType === 'specific_path' && !config.targetPath) {
        errors.push(`${prefix}: 选择指定路径时，目标路径不能为空`);
      }
      break;

    case 'rename':
      if (!config.namingPattern) {
        errors.push(`${prefix}: 重命名模式不能为空`);
      }
      break;

    case 'createFolder':
      if (!config.targetPath) {
        errors.push(`${prefix}: 文件夹路径不能为空`);
      }
      break;
  }

  // 检查危险配置
  if (config.deleteNonEmptyFolders) {
    warnings.push(`${prefix}: 启用了删除非空文件夹功能，请谨慎使用`);
  }

  if (config.overwriteExisting) {
    warnings.push(`${prefix}: 启用了覆盖功能，可能会丢失数据`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 验证监控任务配置
 */
export function validateMonitorTask(task: Partial<MonitorTask>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!task.name) {
    errors.push('任务名称不能为空');
  }

  if (!task.workflowId) {
    errors.push('必须选择一个工作流');
  }

  if (!task.type || !['file_watch', 'scheduled'].includes(task.type)) {
    errors.push('任务类型必须是 file_watch 或 scheduled');
  }

  // 验证特定类型的配置
  if (task.type === 'file_watch' && task.config) {
    const config = task.config as any;
    if (!config.watchPaths || !Array.isArray(config.watchPaths) || config.watchPaths.length === 0) {
      errors.push('文件监控任务必须指定监控路径');
    }

    if (!config.events || !Array.isArray(config.events) || config.events.length === 0) {
      errors.push('文件监控任务必须指定监控事件');
    }
  }

  if (task.type === 'scheduled' && task.config) {
    const config = task.config as any;
    if (!config.schedule) {
      errors.push('定时任务必须指定执行计划');
    }

    if (!config.inputPaths || !Array.isArray(config.inputPaths) || config.inputPaths.length === 0) {
      errors.push('定时任务必须指定输入路径');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 验证路径安全性
 */
export function validatePathSafety(filePath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查系统关键路径
  const dangerousPaths = [
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    '/System',
    '/usr',
    '/bin',
    '/sbin',
    '/etc'
  ];

  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  
  for (const dangerousPath of dangerousPaths) {
    if (normalizedPath.startsWith(dangerousPath.toLowerCase())) {
      errors.push(`不能操作系统关键路径: ${filePath}`);
      break;
    }
  }

  // 检查相对路径
  if (filePath.includes('..')) {
    warnings.push(`路径包含相对路径符号，请确认安全性: ${filePath}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
