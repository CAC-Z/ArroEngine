import { app } from 'electron';
import { appState } from './modules/app-state';
import { bootstrapApplication } from './app/bootstrap';
import { registerAppEvents } from './app/events';
import { registerIpcHandlers } from './ipc';

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
appState.isDev = isDev;
appState.isQuitting = false;

bootstrapApplication();
registerAppEvents();
registerIpcHandlers();
