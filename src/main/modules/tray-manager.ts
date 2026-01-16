import { app, Menu, Tray, nativeImage } from 'electron';
import fs from 'fs-extra';
import path from 'path';
import { appState } from './app-state';

export function updateTrayMenu() {
  const tray = appState.tray;
  const store = appState.store;
  const mainWindow = appState.mainWindow;

  if (!tray || appState.isQuitting || tray.isDestroyed() || !store) {
    return;
  }

  const isVisible = mainWindow ? mainWindow.isVisible() : false;
  const lang = appState.currentLanguage === 'zh-CN' ? 'zh' : 'en';
  const autoLaunch = store.get('autoLaunch', false);

  const menuTemplates: { [key: string]: Electron.MenuItemConstructorOptions[] } = {
    zh: [
      {
        label: isVisible ? '隐藏窗口' : '显示窗口',
        click: () => {
          const windowRef = appState.mainWindow;
          if (!windowRef) return;

          if (windowRef.isVisible()) {
            windowRef.hide();
          } else {
            if (windowRef.isMinimized()) {
              windowRef.restore();
            }
            windowRef.show();
            windowRef.focus();
          }
          updateTrayMenu();
        }
      },
      {
        label: autoLaunch ? '禁用开机自启' : '启用开机自启',
        click: () => {
          const newValue = !autoLaunch;
          store.set('autoLaunch', newValue);
          setAutoLaunch(newValue);
          updateTrayMenu();
        }
      },
      {
        type: 'separator'
      },
      {
        label: '退出',
        click: () => {
          app.quit();
        }
      }
    ],
    en: [
      {
        label: isVisible ? 'Hide Window' : 'Show Window',
        click: () => {
          const windowRef = appState.mainWindow;
          if (!windowRef) return;

          if (windowRef.isVisible()) {
            windowRef.hide();
          } else {
            if (windowRef.isMinimized()) {
              windowRef.restore();
            }
            windowRef.show();
            windowRef.focus();
          }
          updateTrayMenu();
        }
      },
      {
        label: autoLaunch ? 'Disable Auto Launch' : 'Enable Auto Launch',
        click: () => {
          const newValue = !autoLaunch;
          store.set('autoLaunch', newValue);
          setAutoLaunch(newValue);
          updateTrayMenu();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Exit',
        click: () => {
          app.quit();
        }
      }
    ]
  };

  const contextMenu = Menu.buildFromTemplate(menuTemplates[lang]);
  tray.setContextMenu(contextMenu);
}

export function setAutoLaunch(enable: boolean) {
  const store = appState.store;

  if (!store) {
    console.warn('Skip setting auto launch because store is not ready.');
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('开发环境下不设置开机自启动');
    return;
  }

  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
      openAsHidden: store.get('minimizeToTray', false),
      args: store.get('minimizeToTray', false) ? ['--hidden'] : []
    });
    console.log(`开机自启动已${enable ? '启用' : '禁用'}`);
  } catch (error) {
    console.error('设置开机自启动失败:', error);
  }
}

export function createTray() {
  const isDev = appState.isDev;
  let tray = appState.tray;

  if (tray) {
    tray.destroy();
    tray = null;
  }

  let iconPath: string;

  if (isDev) {
    const devCandidates = [
      path.join(__dirname, '../../resources/logov1.ico'),
      path.join(__dirname, '../../../resources/logov1.ico'),
      path.join(process.cwd(), 'resources', 'logov1.ico')
    ];
    iconPath = devCandidates.find(candidate => fs.existsSync(candidate)) ?? devCandidates[0];
  } else {
    const possiblePaths = [
      path.join(process.resourcesPath, 'logov1.ico'),
      path.join(process.resourcesPath, 'resources', 'logov1.ico'),
      path.join(__dirname, '../resources/logov1.ico'),
      path.join(__dirname, '../../resources/logov1.ico'),
      path.join(__dirname, '../../../resources/logov1.ico')
    ];

    iconPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
  }

  console.log('托盘图标路径:', iconPath, '存在:', fs.existsSync(iconPath));

  let trayInstance: Tray;
  if (!fs.existsSync(iconPath)) {
    console.log('图标文件不存在，使用内置图标');
    const icon = nativeImage.createFromDataURL(`data:image/png;base64,
iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAABFUlEQVQ4jZ2TMU7DQBBF3yyWHAMnQIrSpUFKQZMGCQkJCQkJCQmJC3ANTpAj0FBxABoKGqQUKVKkyFIsWd7/KbKWvdiOU/BLI828mf+1O7uzSkQwsy0z2zezQzMbBnvg7IOZjcxsambTRCQFfAQ+gTXQBSrAArhLdg/oAXPgHXgDnoCniIhFxCoiGhGZiMhcRJYiskrjIrIQkVlEpBGRRkSsAHaBc+AKuARGwAQYAw/AHfAKvAAvQXsP3AJT4BG4BobABXAGnAJHQA2UQAsoIiIxs7KqqpOiKM7zPD/Psuw0TdNBkiT9OI57URR1wzBsh2HYCsOwFQRBJwzDThzH3SRJ+lmWDfI8P6+q6sTMSuAb+AJ+gB9JvOQvLcUfBzjy8HMAAAAASUVORK5CYII=`);
    trayInstance = new Tray(icon);
  } else {
    console.log('使用图标文件:', iconPath);
    trayInstance = new Tray(iconPath);
  }

  appState.tray = trayInstance;
  trayInstance.setToolTip('ArroEngine - 文件整理工具');

  updateTrayMenu();

  trayInstance.on('double-click', () => {
    const mainWindow = appState.mainWindow;
    if (!mainWindow) return;

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    updateTrayMenu();
  });

  trayInstance.on('click', () => {
    const mainWindow = appState.mainWindow;
    if (!mainWindow) return;

    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
    updateTrayMenu();
  });
}
