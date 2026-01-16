import { app } from 'electron';
import { WorkflowEngine } from '../modules/workflow-engine';
import { MonitorManager } from '../modules/monitor-manager';
import { appState } from '../modules/app-state';
import { ensureStore } from '../modules/app-context';
import { createMainWindow } from '../modules/window-manager';
import { setAutoLaunch } from '../modules/tray-manager';
import { loadWorkflows } from '../modules/workflow-storage';
import { startResourceMonitoring } from '../modules/resource-monitor';
import { setupMonitorEventForwarding } from '../modules/monitor-events';

const { historyManager } = require('../modules/history-manager');

export const bootstrapApplication = () => {
  app.whenReady().then(async () => {
    try {
      console.log('应用启动开始');

      const Store = (await eval('import("electron-store")')).default;
      const store = new Store();
      appState.store = store;

      appState.currentLanguage = ensureStore().get('language', 'zh-CN');

      console.log('创建主窗口');
      createMainWindow();

      setTimeout(async () => {
        try {
          console.log('开始初始化工作流引擎');
          const workflowEngine = new WorkflowEngine(appState.currentLanguage, store);
          appState.workflowEngine = workflowEngine;

          console.log('开始初始化监控管理器');
          const monitorManager = new MonitorManager(workflowEngine, historyManager, store, async (workflowId: string) => {
            const workflows = await loadWorkflows();
            return workflows.find(w => w.id === workflowId) || null;
          });
          appState.monitorManager = monitorManager;

          monitorManager.initialize()
            .then(() => {
              console.log('监控管理器初始化完成');
              setupMonitorEventForwarding();
            })
            .catch(error => {
              console.error('监控管理器初始化失败:', error);
            });

          loadWorkflows()
            .then(workflows => {
              console.log(`预加载工作流完成，数量: ${workflows.length}`);
              startResourceMonitoring();
            })
            .catch(error => {
              console.error('预加载工作流失败:', error);
            });

          const autoLaunch = ensureStore().get('autoLaunch', false);
          setAutoLaunch(autoLaunch);

          console.log('应用后台组件初始化完成');
        } catch (error) {
          console.error('后台组件初始化失败:', error);
        }
      }, 500);
    } catch (error) {
      console.error('应用初始化失败:', error);
    }
  });
};
