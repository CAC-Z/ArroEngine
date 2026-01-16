import { ipcMain } from 'electron';
import type { DropGroup } from '../../shared/types';
import { loadWorkflows } from '../modules/workflow-storage';
import { ensureStore, getMainWindow, getWorkflowEngine } from '../modules/app-context';

export const registerFileHandlers = () => {
  ipcMain.handle('files:processDroppedPaths', async (_, paths: string[], workflowId?: string): Promise<DropGroup[]> => {
    const startTime = performance.now();
    console.log(`🚀 开始处理拖拽文件，路径数量: ${paths.length}, 工作流ID: ${workflowId}`);

    try {
      if (!paths || !Array.isArray(paths) || paths.length === 0) {
        console.warn('未提供有效的路径数组，返回空数组');
        return [];
      }

      if (!workflowId) {
        console.warn('未提供工作流ID，返回空数组');
        return [];
      }

      const workflows = await loadWorkflows();
      if (!workflows || workflows.length === 0) {
        console.error('无法加载工作流配置，返回空数组');
        return [];
      }

      const workflow = workflows.find(w => w.id === workflowId);
      if (!workflow) {
        console.error(`未找到工作流: ${workflowId}`);
        return [];
      }

      if (!workflow.enabled) {
        console.warn(`工作流"${workflow.name}"已被禁用，返回空数组`);
        return [];
      }

      const workflowEngine = getWorkflowEngine();
      if (!workflowEngine) {
        console.error('WorkflowEngine未初始化，无法处理文件');
        return [];
      }

      console.log(`📋 使用工作流"${workflow.name}"处理文件`);
      const dropGroups = await workflowEngine.createDropGroupsFromPaths(paths, workflow);

      const MAX_ITEMS = ensureStore().get('workflow.processing.maxItems', 1000) as number;
      const totalFiles = dropGroups.reduce((sum, group) => sum + group.files.length, 0);

      if (totalFiles > MAX_ITEMS) {
        console.warn(`处理的文件数量 (${totalFiles}) 超出上限 (${MAX_ITEMS})，将进行截断。`);

        let remainingItems = MAX_ITEMS;
        const truncatedGroups = dropGroups.map(group => {
          if (remainingItems <= 0) {
            return { ...group, files: [] };
          }

          const filesToTake = Math.min(group.files.length, remainingItems);
          remainingItems -= filesToTake;

          return {
            ...group,
            files: group.files.slice(0, filesToTake)
          };
        });

        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('file-processing-warning', {
            type: 'max_items_exceeded',
            totalFiles,
            maxItems: MAX_ITEMS,
            processedFiles: MAX_ITEMS
          });
        }

        const totalTime = performance.now() - startTime;
        console.log(`🎯 文件处理完成（已截断），耗时: ${totalTime.toFixed(2)}ms, 处理组数: ${truncatedGroups.length}`);
        return truncatedGroups;
      }

      const totalTime = performance.now() - startTime;
      console.log(`🎯 文件处理完成，耗时: ${totalTime.toFixed(2)}ms, 处理组数: ${dropGroups.length}, 总文件数: ${totalFiles}`);

      if (totalTime > 5000) {
        console.warn(`文件处理耗时过长: ${totalTime.toFixed(2)}ms`);
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('performance-warning', {
            operation: 'file-processing',
            duration: totalTime,
            itemCount: totalFiles
          });
        }
      }

      return dropGroups;
    } catch (error) {
      const totalTime = performance.now() - startTime;
      console.error('在 processDroppedPaths 过程中发生严重错误:', error);

      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('file-processing-error', {
          paths,
          workflowId,
          error: error instanceof Error ? error.message : String(error),
          duration: totalTime
        });
      }

      return [];
    }
  });
};
