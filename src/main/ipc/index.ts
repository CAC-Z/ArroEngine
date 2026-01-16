import { registerFileHandlers } from './files';
import { registerWorkflowHandlers } from './workflows';
import { registerHistoryHandlers } from './history';
import { registerMonitorHandlers } from './monitor';
import { registerSettingsHandlers } from './settings';
import { registerStorageHandlers } from './storage';

export const registerIpcHandlers = () => {
  registerFileHandlers();
  registerWorkflowHandlers();
  registerHistoryHandlers();
  registerMonitorHandlers();
  registerSettingsHandlers();
  registerStorageHandlers();
};
