import type { FileWatchConfig, ScheduledConfig } from "@shared/types";

export type MonitorTaskFormData = {
  name: string;
  description: string;
  type: "file_watch" | "scheduled";
  workflowId: string;
  enabled: boolean;
};

export const createInitialFormData = (): MonitorTaskFormData => ({
  name: "",
  description: "",
  type: "file_watch",
  workflowId: "",
  enabled: true,
});

export const createDefaultFileWatchConfig = (): FileWatchConfig => ({
  watchPaths: [""],
  ignorePatterns: [],
  debounceMs: 1000,
  events: ["add", "change"],
  autoExecute: true,
  batchSize: 100,
  batchTimeoutMs: 5000,
});

export const createDefaultScheduledConfig = (): ScheduledConfig => ({
  cronExpression: "0 0 * * *",
  timezone: "Asia/Shanghai",
  inputPath: "",
  inputPaths: [""],
  skipIfRunning: true,
  ignorePatterns: [],
  debounceMs: 1000,
  events: ["add", "change"],
  batchSize: 100,
  batchTimeoutMs: 5000,
});

export const ensureFileWatchConfig = (config: FileWatchConfig): FileWatchConfig => ({
  ...config,
  autoExecute: true,
  watchPaths: config.watchPaths?.length ? config.watchPaths : [""],
  ignorePatterns: config.ignorePatterns ?? [],
  debounceMs: config.debounceMs ?? 1000,
  events: config.events?.length ? config.events : ["add", "change"],
  batchSize: config.batchSize ?? 100,
  batchTimeoutMs: config.batchTimeoutMs ?? 5000,
});

export const normalizeScheduledConfig = (config: ScheduledConfig): ScheduledConfig => {
  const inputPaths = config.inputPaths?.length ? config.inputPaths : [config.inputPath].filter(Boolean);

  return {
    ...config,
    inputPath: inputPaths[0] ?? "",
    inputPaths: inputPaths.length ? inputPaths : [""],
    skipIfRunning: config.skipIfRunning !== false,
    ignorePatterns: config.ignorePatterns ?? [],
    debounceMs: config.debounceMs ?? 1000,
    events: config.events?.length ? config.events : ["add", "change"],
    batchSize: config.batchSize ?? 100,
    batchTimeoutMs: config.batchTimeoutMs ?? 5000,
    timezone: config.timezone ?? "Asia/Shanghai",
  };
};
