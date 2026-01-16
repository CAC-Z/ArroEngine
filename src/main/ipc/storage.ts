import { app, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs-extra';

export const registerStorageHandlers = () => {
  ipcMain.handle('storage:getUsage', async () => {
    try {
      const appDataPath = app.getPath('userData');
      const appDataSize = await getDirectorySize(appDataPath);

      const historyPath = path.join(app.getPath('userData'), 'history');
      let historySize = 0;
      if (await fs.pathExists(historyPath)) {
        historySize = await getDirectorySize(historyPath);
      }

      const tempPath = path.join(app.getPath('temp'), 'fileark-temp');
      let tempSize = 0;
      if (await fs.pathExists(tempPath)) {
        tempSize = await getDirectorySize(tempPath);
      }

      return {
        appDataSize,
        historySize,
        tempSize,
        totalSize: appDataSize
      };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return {
        appDataSize: 0,
        historySize: 0,
        tempSize: 0,
        totalSize: 0
      };
    }
  });

  ipcMain.handle('storage:cleanTemp', async () => {
    try {
      const tempPath = path.join(app.getPath('temp'), 'fileark-temp');

      if (await fs.pathExists(tempPath)) {
        await fs.emptyDir(tempPath);
      }

      return true;
    } catch (error) {
      console.error('Failed to clean temp files:', error);
      return false;
    }
  });
};

const getDirectorySize = async (directoryPath: string): Promise<number> => {
  try {
    if (!(await fs.pathExists(directoryPath))) {
      return 0;
    }

    const stats = await fs.stat(directoryPath);

    if (!stats.isDirectory()) {
      return stats.size;
    }

    const files = await fs.readdir(directoryPath);
    const sizes = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(directoryPath, file);
        const fileStats = await fs.stat(filePath);

        if (fileStats.isDirectory()) {
          return getDirectorySize(filePath);
        }

        return fileStats.size;
      })
    );

    return sizes.reduce((acc, size) => acc + size, 0);
  } catch (error) {
    console.error(`Error getting size for directory ${directoryPath}:`, error);
    return 0;
  }
};
