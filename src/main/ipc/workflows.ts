import { BrowserWindow, ipcMain } from 'electron';
import type { Action, Condition, ProcessStep, Workflow, AppFile } from '../../shared/types';
import { loadWorkflows, saveWorkflows } from '../modules/workflow-storage';
import { getWorkflowEngine, getMainWindow, ensureStore } from '../modules/app-context';
import { createDefaultWorkflows } from '../modules/default-workflows';

const { historyManager } = require('../modules/history-manager');

export const registerWorkflowHandlers = () => {
  ipcMain.handle('workflows:preview', async (_, files: AppFile[], workflow: Workflow) => {
    const workflowEngine = getWorkflowEngine();
    if (!workflowEngine) {
      throw new Error('工作流引擎未初始化');
    }
    return workflowEngine.preview(files, workflow);
  });

  ipcMain.handle('workflows:execute', async (_, files: AppFile[], workflow: Workflow) => {
    const workflowEngine = getWorkflowEngine();
    if (!workflowEngine) {
      throw new Error('工作流引擎未初始化');
    }
    console.log('执行工作流:', workflow.name, '文件数量:', files.length);

    const batchSize = ensureStore().get('workflow.processing.batchSize', 100) as number;
    const result = files.length > batchSize
      ? await workflowEngine.executeBatch(files, workflow, (progress) => {
          const mainWindow = getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('workflow-progress', progress);
          }
        })
      : await workflowEngine.execute(files, workflow);

    try {
      console.log('创建历史记录条目');
      const createdDirectories = workflowEngine.getAndPreserveCreatedDirectories();
      const cleanedEmptyDirectories = workflowEngine.getAndPreserveCleanedEmptyDirectories();
      console.log('📋 获取到的创建文件夹列表:', createdDirectories);
      console.log('📋 获取到的被清理空文件夹列表:', cleanedEmptyDirectories);

      const historyEntry = historyManager.createEntryFromWorkflowResult(
        result,
        workflow,
        files,
        'manual',
        undefined,
        undefined,
        createdDirectories,
        cleanedEmptyDirectories
      );
      await historyManager.addEntry(historyEntry);
      console.log('历史记录已保存，包含', createdDirectories.length, '个创建的文件夹和', cleanedEmptyDirectories.length, '个被清理的空文件夹');

      workflowEngine.clearCreatedDirectories();
      workflowEngine.clearCleanedEmptyDirectories();
    } catch (error) {
      console.error('Failed to save history entry:', error);
    }

    return result;
  });

  ipcMain.handle('workflows:getAll', async () => {
    return loadWorkflows();
  });

  ipcMain.handle('workflows:save', async (_, workflow: Workflow) => {
    try {
      console.log('保存工作流:', workflow.id, workflow.name);
      const workflows = await loadWorkflows();
      const existingIndex = workflows.findIndex((w: Workflow) => w.id === workflow.id);
      const isNewWorkflow = existingIndex < 0;

      let workflowToBroadcast = workflow;
      if (existingIndex >= 0) {
        workflows[existingIndex] = { ...workflow, updatedAt: new Date().toISOString() };
        console.log('更新现有工作流:', workflow.id);
        workflowToBroadcast = workflows[existingIndex];
      } else {
        const newWorkflow = { ...workflow, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        workflows.push(newWorkflow);
        console.log('添加新工作流:', workflow.id);
        workflowToBroadcast = newWorkflow;
      }

      await saveWorkflows(workflows);
      console.log('工作流保存成功，总数:', workflows.length);

      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('workflows:updated', {
          workflow: workflowToBroadcast,
          isNew: isNewWorkflow
        });
      });

      return workflowToBroadcast;
    } catch (error) {
      console.error('保存工作流失败:', error);
      throw error;
    }
  });

  ipcMain.handle('workflows:delete', async (event, workflowId: string) => {
    const workflows = await loadWorkflows();
    const filteredWorkflows = workflows.filter((w: Workflow) => w.id !== workflowId);
    await saveWorkflows(filteredWorkflows);

    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('workflows:deleted', { workflowId });
    });

    return true;
  });

  ipcMain.handle('workflows:getById', async (event, workflowId: string) => {
    const workflows = await loadWorkflows();
    return workflows.find((w: Workflow) => w.id === workflowId) || null;
  });

  ipcMain.handle('workflows:resetToDefault', async (_, language: 'zh-CN' | 'en-US' = 'zh-CN') => {
    try {
      const existingWorkflows = await loadWorkflows();
      const newDefaultWorkflows = createDefaultWorkflows(language);
      const userWorkflows = existingWorkflows.filter(w => !w.id.startsWith('workflow-'));
      const combinedWorkflows = [...userWorkflows, ...newDefaultWorkflows];
      const allWorkflows = combinedWorkflows.map((item, index) => ({
        ...item,
        order: index + 1,
        updatedAt: new Date().toISOString()
      }));

      await saveWorkflows(allWorkflows);
      console.log('重置默认工作流成功, 语言:', language, '保留用户工作流:', userWorkflows.length, '个', '总工作流数:', allWorkflows.length);
      return true;
    } catch (error) {
      console.error('重置默认工作流失败:', error);
      return false;
    }
  });

  ipcMain.handle('workflows:updateDefaultLanguage', async (event, language: 'zh-CN' | 'en-US' = 'zh-CN') => {
    try {
      const existingWorkflows = await loadWorkflows();
      const newDefaultWorkflows = createDefaultWorkflows(language);

      const userWorkflows = existingWorkflows.filter((w: Workflow) => !w.id.startsWith('workflow-'));
      const updatedDefaultWorkflows = newDefaultWorkflows.map((newWorkflow: Workflow) => {
        const existingWorkflow = existingWorkflows.find((w: Workflow) => w.id === newWorkflow.id);
        if (existingWorkflow) {
          const updatedSteps = existingWorkflow.steps.map((existingStep: ProcessStep) => {
            const newStep = newWorkflow.steps.find((s: ProcessStep) => s.id === existingStep.id);
            if (newStep) {
              const updatedConditions = {
                ...existingStep.conditions,
                conditions: existingStep.conditions.conditions.map((existingCondition: Condition) => {
                  const newCondition = newStep.conditions.conditions.find((c: Condition) => c.id === existingCondition.id);
                  if (newCondition && existingCondition.field === 'fileType' && existingCondition.operator === 'equals') {
                    return {
                      ...existingCondition,
                      value: newCondition.value
                    };
                  }
                  return existingCondition;
                })
              };

              const updatedActions = existingStep.actions.map((existingAction: Action) => {
                const newAction = newStep.actions.find((a: Action) => a.id === existingAction.id);
                if (newAction && newAction.config.targetPath) {
                  return {
                    ...existingAction,
                    config: {
                      ...existingAction.config,
                      targetPath: newAction.config.targetPath
                    }
                  };
                }
                return existingAction;
              });

              return {
                ...existingStep,
                name: newStep.name,
                description: newStep.description,
                conditions: updatedConditions,
                actions: updatedActions
              };
            }
            return existingStep;
          });

          return {
            ...existingWorkflow,
            name: newWorkflow.name,
            description: newWorkflow.description,
            steps: updatedSteps,
            updatedAt: new Date().toISOString()
          };
        }
        return newWorkflow;
      });

      const allWorkflows = [...userWorkflows, ...updatedDefaultWorkflows];
      await saveWorkflows(allWorkflows);

      console.log('更新默认工作流语言成功, 语言:', language);
      return true;
    } catch (error) {
      console.error('更新默认工作流语言失败:', error);
      return false;
    }
  });
};
