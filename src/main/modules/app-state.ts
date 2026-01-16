import type { BrowserWindow, Tray } from 'electron';
import type { WorkflowEngine } from './workflow-engine';
import type { MonitorManager } from './monitor-manager';

type SupportedLanguage = 'zh-CN' | 'en-US';

let store: any = null;
let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let currentLanguage: SupportedLanguage = 'zh-CN';
let isDev = false;
let isQuitting = false;
let workflowEngine: WorkflowEngine | null = null;
let monitorManager: MonitorManager | null = null;
let resourceMonitorTimer: NodeJS.Timeout | null = null;

export const appState = {
  get store() {
    return store;
  },
  set store(value: any) {
    store = value;
  },
  get tray() {
    return tray;
  },
  set tray(value: Tray | null) {
    tray = value;
  },
  get mainWindow() {
    return mainWindow;
  },
  set mainWindow(value: BrowserWindow | null) {
    mainWindow = value;
  },
  get currentLanguage(): SupportedLanguage {
    return currentLanguage;
  },
  set currentLanguage(value: SupportedLanguage) {
    currentLanguage = value;
  },
  get isDev() {
    return isDev;
  },
  set isDev(value: boolean) {
    isDev = value;
  },
  get isQuitting() {
    return isQuitting;
  },
  set isQuitting(value: boolean) {
    isQuitting = value;
  },
  get workflowEngine() {
    return workflowEngine;
  },
  set workflowEngine(value: WorkflowEngine | null) {
    workflowEngine = value;
  },
  get monitorManager() {
    return monitorManager;
  },
  set monitorManager(value: MonitorManager | null) {
    monitorManager = value;
  },
  get resourceMonitorTimer() {
    return resourceMonitorTimer;
  },
  set resourceMonitorTimer(value: NodeJS.Timeout | null) {
    resourceMonitorTimer = value;
  }
};

export type { SupportedLanguage };
