import { ipcMain } from 'electron';
import { ensureStore } from '../modules/app-context';
import { updateTrayMenu } from '../modules/tray-manager';

export const registerSettingsHandlers = () => {
  ipcMain.handle('settings:get', async (event, key: string) => {
    try {
      const value = ensureStore().get(key);
      console.log('获取设置:', key, '=', value);
      return value;
    } catch (error) {
      console.error('Failed to get setting:', error);
      return null;
    }
  });

  ipcMain.handle('settings:set', async (event, key: string, value: any) => {
    try {
      console.log('保存设置:', key, '=', value);
      ensureStore().set(key, value);

      const savedValue = ensureStore().get(key);
      console.log('设置保存后验证:', key, '=', savedValue);

      if (key === 'minimizeToTray') {
        updateTrayMenu();
      }

      return true;
    } catch (error) {
      console.error('Failed to set setting:', error);
      return false;
    }
  });

  ipcMain.handle('settings:getAll', async () => {
    try {
      return ensureStore().store;
    } catch (error) {
      console.error('Failed to get all settings:', error);
      return {};
    }
  });
};
