import { app } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import { createDefaultWorkflows } from './default-workflows';
import { validateWorkflow } from '../utils/config-validator';
import type { Workflow } from '../../shared/types';
import { getMainWindow } from './app-context';

const WORKFLOWS_FILE_PATH = path.join(app.getPath('userData'), 'workflows.json');

let workflowsCache: Workflow[] | null = null;
let workflowsFileModTime = 0;

export const loadWorkflows = async (): Promise<Workflow[]> => {
  try {
    if (await fs.pathExists(WORKFLOWS_FILE_PATH)) {
      const stats = await fs.stat(WORKFLOWS_FILE_PATH);
      const fileModTime = stats.mtime.getTime();

      console.log('文件修改时间检查:', {
        fileModTime: new Date(fileModTime).toISOString(),
        cachedModTime: workflowsFileModTime ? new Date(workflowsFileModTime).toISOString() : 'null',
        hasCachedData: !!workflowsCache,
        isFileModified: fileModTime !== workflowsFileModTime
      });

      if (workflowsCache && fileModTime === workflowsFileModTime) {
        console.log('使用缓存的工作流数据 (文件未修改)');
        return workflowsCache;
      }

      console.log('文件已修改或首次加载，重新读取工作流');
      workflowsFileModTime = fileModTime;
    }

    const startTime = performance.now();
    console.log('开始加载工作流，路径:', WORKFLOWS_FILE_PATH);

    if (await fs.pathExists(WORKFLOWS_FILE_PATH)) {
      const readStartTime = performance.now();
      const data = await fs.readFile(WORKFLOWS_FILE_PATH, 'utf-8');
      const readTime = performance.now() - readStartTime;
      console.log(`文件读取耗时: ${readTime.toFixed(2)}ms`);

      if (!data.trim()) {
        console.warn('工作流文件为空，初始化默认工作流');
        await initializeDefaultWorkflows('zh-CN');
        const defaultWorkflows = createDefaultWorkflows('zh-CN');
        workflowsCache = defaultWorkflows;
        return defaultWorkflows;
      }

      const parseStartTime = performance.now();
      const existingWorkflows = JSON.parse(data);
      const parseTime = performance.now() - parseStartTime;
      console.log(`JSON解析耗时: ${parseTime.toFixed(2)}ms`);
      console.log('加载现有工作流，数量:', existingWorkflows.length);

      const validateStartTime = performance.now();
      const validWorkflows = existingWorkflows.filter((workflow: any) =>
        workflow && workflow.id && workflow.name
      );
      const validateTime = performance.now() - validateStartTime;
      console.log(`数据验证耗时: ${validateTime.toFixed(2)}ms`);

      if (validWorkflows.length !== existingWorkflows.length) {
        console.warn('发现损坏的工作流数据，已过滤:', existingWorkflows.length - validWorkflows.length, '个');
        await saveWorkflows(validWorkflows);
      }

      const hasDefaultWorkflows = validWorkflows.some((workflow: any) => workflow.id.startsWith('workflow-'));
      if (!hasDefaultWorkflows) {
        console.log('未发现默认工作流，添加默认工作流');
        const defaultWorkflows = createDefaultWorkflows('zh-CN');
        const mergedWorkflows = [...validWorkflows, ...defaultWorkflows];
        await saveWorkflows(mergedWorkflows);
        workflowsCache = mergedWorkflows;
        return mergedWorkflows;
      }

      workflowsCache = validWorkflows;

      const totalTime = performance.now() - startTime;
      console.log(`工作流加载总耗时: ${totalTime.toFixed(2)}ms`);

      return validWorkflows;
    }

    console.log('工作流文件不存在，初始化默认工作流');
    await initializeDefaultWorkflows('zh-CN');
    const defaultWorkflows = createDefaultWorkflows('zh-CN');
    workflowsCache = defaultWorkflows;
    return defaultWorkflows;
  } catch (error) {
    console.error('加载工作流失败:', error);
    try {
      console.log('尝试返回默认工作流作为备用');
      const fallbackWorkflows = createDefaultWorkflows('zh-CN');
      workflowsCache = fallbackWorkflows;
      return fallbackWorkflows;
    } catch (fallbackError) {
      console.error('创建默认工作流也失败:', fallbackError);
      return [];
    }
  }
};

export const clearWorkflowsCache = () => {
  console.log('清除工作流缓存');
  workflowsCache = null;
  workflowsFileModTime = 0;
};

export const initializeDefaultWorkflows = async (language: 'zh-CN' | 'en-US' = 'zh-CN'): Promise<void> => {
  try {
    const workflows = createDefaultWorkflows(language);
    await saveWorkflows(workflows);
    console.log('默认工作流已初始化, 语言:', language);
  } catch (error) {
    console.error('初始化默认工作流失败:', error);
  }
};

export const saveWorkflows = async (workflows: Workflow[]): Promise<void> => {
  try {
    console.log('开始保存工作流，数量:', workflows.length);
    await fs.ensureDir(path.dirname(WORKFLOWS_FILE_PATH));

    const validWorkflows: Workflow[] = [];
    const validationErrors: string[] = [];

    for (const workflow of workflows) {
      if (!workflow || !workflow.id || !workflow.name) {
        validationErrors.push(`工作流基本信息不完整: ${workflow?.name || '未知'}`);
        continue;
      }

      const validation = validateWorkflow(workflow);
      if (validation.isValid) {
        validWorkflows.push(workflow);
        if (validation.warnings.length > 0) {
          console.warn(`工作流 "${workflow.name}" 存在警告:`, validation.warnings);
        }
      } else {
        validationErrors.push(`工作流 "${workflow.name}" 验证失败: ${validation.errors.join(', ')}`);
      }
    }

    if (validationErrors.length > 0) {
      console.warn('工作流验证错误:', validationErrors);
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('workflow-validation-errors', validationErrors);
      }
    }

    if (validWorkflows.length !== workflows.length) {
      console.warn('发现无效工作流数据，已过滤:', workflows.length - validWorkflows.length, '个');
    }

    await fs.writeFile(WORKFLOWS_FILE_PATH, JSON.stringify(validWorkflows, null, 2), 'utf-8');
    console.log('工作流保存成功，路径:', WORKFLOWS_FILE_PATH);

    clearWorkflowsCache();
  } catch (error) {
    console.error('保存工作流失败:', error);
    throw error;
  }
};

export { WORKFLOWS_FILE_PATH };
