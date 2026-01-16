import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs-extra';
import path from 'path';
import { appState } from './app-state';
import { createTray, setAutoLaunch, updateTrayMenu } from './tray-manager';

function resolveWindowBounds() {
  const isDev = appState.isDev;
  const store = appState.store;

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const referenceScreenWidth = 2560;
  const referenceScreenHeight = 1400;
  const referenceWindowWidth = 1865;
  const referenceWindowHeight = 994;

  const widthRatio = referenceWindowWidth / referenceScreenWidth;
  const heightRatio = referenceWindowHeight / referenceScreenHeight;
  const targetAspectRatio = referenceWindowWidth / referenceWindowHeight;

  let calculatedWidth = Math.floor(screenWidth * widthRatio);
  let calculatedHeight = Math.floor(screenHeight * heightRatio);

  const calculatedAspectRatio = calculatedWidth / calculatedHeight;
  if (Math.abs(calculatedAspectRatio - targetAspectRatio) > 0.01) {
    const widthBasedHeight = Math.floor(calculatedWidth / targetAspectRatio);
    const heightBasedWidth = Math.floor(calculatedHeight * targetAspectRatio);

    if (widthBasedHeight <= calculatedHeight) {
      calculatedHeight = widthBasedHeight;
    } else {
      calculatedWidth = heightBasedWidth;
    }
  }

  const minWidth = 1000;
  const minHeight = Math.floor(minWidth / targetAspectRatio);
  const maxWidth = 2560;
  const maxHeight = Math.floor(maxWidth / targetAspectRatio);

  let windowWidth = Math.max(minWidth, Math.min(calculatedWidth, maxWidth));
  let windowHeight = Math.floor(windowWidth / targetAspectRatio);

  if (windowHeight < minHeight) {
    windowHeight = minHeight;
    windowWidth = Math.floor(windowHeight * targetAspectRatio);
  } else if (windowHeight > maxHeight) {
    windowHeight = maxHeight;
    windowWidth = Math.floor(windowHeight * targetAspectRatio);
  }

  const savedState = store?.get('windowState');
  if (savedState) {
    return {
      width: savedState.width ?? windowWidth,
      height: savedState.height ?? windowHeight,
      x: savedState.x ?? undefined,
      y: savedState.y ?? undefined,
      minWidth,
      minHeight,
      bounds: {
        width: savedState.width ?? windowWidth,
        height: savedState.height ?? windowHeight
      },
      isMaximized: savedState.isMaximized ?? false,
      targetAspectRatio
    };
  }

  return {
    width: windowWidth,
    height: windowHeight,
    minWidth,
    minHeight,
    targetAspectRatio
  };
}

export function createMainWindow(): BrowserWindow | null {
  const store = appState.store;

  if (!store) {
    console.warn('Store is not initialized yet, skip creating main window.');
    return null;
  }

  const isDev = appState.isDev;

  const iconCandidates = isDev
    ? [
        path.join(__dirname, '../../resources/logov1.ico'),
        path.join(__dirname, '../../../resources/logov1.ico'),
        path.join(process.cwd(), 'resources', 'logov1.ico')
      ]
    : [
        path.join(process.resourcesPath, 'logov1.ico'),
        path.join(process.resourcesPath, 'resources', 'logov1.ico'),
        path.join(__dirname, '../resources/logov1.ico'),
        path.join(__dirname, '../../resources/logov1.ico'),
        path.join(__dirname, '../../../resources/logov1.ico')
      ];

  const iconPath = iconCandidates.find(p => fs.existsSync(p)) ?? iconCandidates[0];
  console.log('窗口图标路径:', iconPath, '存在:', fs.existsSync(iconPath));

  const windowConfig = resolveWindowBounds();

  const preloadCandidates = [
    path.join(__dirname, '../preload/index.js'),
    path.join(__dirname, '../preload.js')
  ];
  const preloadPath = preloadCandidates.find(candidate => fs.existsSync(candidate)) ?? preloadCandidates[0];

  const browserWindow = new BrowserWindow({
    width: windowConfig.width,
    height: windowConfig.height,
    minWidth: windowConfig.minWidth,
    minHeight: windowConfig.minHeight,
    frame: false,
    show: false,
    backgroundColor: '#202020',
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  appState.mainWindow = browserWindow;

  if ('isMaximized' in windowConfig && windowConfig.isMaximized) {
    browserWindow.maximize();
  } else if ('x' in windowConfig && 'y' in windowConfig && windowConfig.x !== undefined && windowConfig.y !== undefined) {
    browserWindow.setBounds({
      x: windowConfig.x,
      y: windowConfig.y,
      width: windowConfig.width,
      height: windowConfig.height
    });
  } else {
    browserWindow.center();
  }

  browserWindow.once('ready-to-show', () => {
    browserWindow.show();
  });

  if (isDev) {
    browserWindow.webContents.openDevTools();
  }

  const url = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../renderer/index.html')}`;

  browserWindow.loadURL(url);

  let saveWindowStateTimeout: NodeJS.Timeout;
  const saveWindowState = () => {
    const win = appState.mainWindow;
    if (!win || win.isDestroyed()) return;

    const bounds = win.getBounds();
    const isMaximized = win.isMaximized();
    store.set('windowState', {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized
    });
    console.log('保存窗口状态:', bounds);
  };

  const debouncedSaveWindowState = () => {
    clearTimeout(saveWindowStateTimeout);
    saveWindowStateTimeout = setTimeout(saveWindowState, 500);
  };

  browserWindow.on('resize', debouncedSaveWindowState);
  browserWindow.on('move', debouncedSaveWindowState);
  browserWindow.on('maximize', saveWindowState);
  browserWindow.on('unmaximize', saveWindowState);

  ipcMain.handle('window:minimize', () => {
    const win = appState.mainWindow;
    if (win) {
      win.minimize();
    }
  });

  ipcMain.handle('window:maximize', () => {
    const win = appState.mainWindow;
    if (!win) {
      return false;
    }
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    return win.isMaximized();
  });

  ipcMain.handle('window:close', () => {
    const win = appState.mainWindow;
    if (!win) return;

    const minimizeToTray = store.get('minimizeToTray', false);
    if (minimizeToTray) {
      win.hide();
      updateTrayMenu();
    } else {
      win.close();
    }
  });

  ipcMain.handle('window:isMaximized', () => {
    const win = appState.mainWindow;
    return win ? win.isMaximized() : false;
  });

  ipcMain.handle('window:resetToDefaultSize', () => {
    const win = appState.mainWindow;
    if (!win) {
      return false;
    }

    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const referenceScreenWidth = 2560;
    const referenceScreenHeight = 1400;
    const referenceWindowWidth = 1865;
    const referenceWindowHeight = 994;

    const widthRatio = referenceWindowWidth / referenceScreenWidth;
    const heightRatio = referenceWindowHeight / referenceScreenHeight;
    const targetAspectRatio = referenceWindowWidth / referenceWindowHeight;

    let calculatedWidth = Math.floor(screenWidth * widthRatio);
    let calculatedHeight = Math.floor(screenHeight * heightRatio);

    const calculatedAspectRatio = calculatedWidth / calculatedHeight;
    if (Math.abs(calculatedAspectRatio - targetAspectRatio) > 0.01) {
      const widthBasedHeight = Math.floor(calculatedWidth / targetAspectRatio);
      const heightBasedWidth = Math.floor(calculatedHeight * targetAspectRatio);

      if (widthBasedHeight <= calculatedHeight) {
        calculatedHeight = widthBasedHeight;
      } else {
        calculatedWidth = heightBasedWidth;
      }
    }

    const minWidth = 1000;
    const minHeight = Math.floor(minWidth / targetAspectRatio);
    const maxWidth = 2560;
    const maxHeight = Math.floor(maxWidth / targetAspectRatio);

    let windowWidth = Math.max(minWidth, Math.min(calculatedWidth, maxWidth));
    let windowHeight = Math.floor(windowWidth / targetAspectRatio);

    if (windowHeight < minHeight) {
      windowHeight = minHeight;
      windowWidth = Math.floor(windowHeight * targetAspectRatio);
    } else if (windowHeight > maxHeight) {
      windowHeight = maxHeight;
      windowWidth = Math.floor(windowHeight * targetAspectRatio);
    }

    if (win.isMaximized()) {
      win.unmaximize();
    }

    win.setSize(windowWidth, windowHeight);
    win.center();

    store.delete('windowState');
    console.log('窗口已重置到默认大小:', { windowWidth, windowHeight });
    return true;
  });

  browserWindow.on('close', (event) => {
    const win = appState.mainWindow;
    if (!win) return;

    const minimizeToTray = store.get('minimizeToTray', false);
    if (minimizeToTray) {
      event.preventDefault();
      win.hide();
      updateTrayMenu();
    }
  });

  ipcMain.handle('get-language', () => {
    return store.get('language', 'zh-CN');
  });

  ipcMain.handle('set-language', (_, language: 'zh-CN' | 'en-US') => {
    appState.currentLanguage = language;
    store.set('language', language);

    const engine = appState.workflowEngine;
    if (engine) {
      engine.setLanguage(language);
    }

    updateTrayMenu();
    return language;
  });

  ipcMain.handle('auto-launch:get', () => {
    return store.get('autoLaunch', false);
  });

  ipcMain.handle('auto-launch:set', (_, enable: boolean) => {
    store.set('autoLaunch', enable);
    setAutoLaunch(enable);
    updateTrayMenu();
    return enable;
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    const win = appState.mainWindow;
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:openFile', async (_, options: Electron.OpenDialogOptions = {}) => {
    const win = appState.mainWindow;
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      ...options
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('window:toggleDevTools', () => {
    const win = appState.mainWindow;
    if (win) {
      win.webContents.toggleDevTools();
    }
  });

  if (!appState.tray) {
    createTray();
  }

  return browserWindow;
}
