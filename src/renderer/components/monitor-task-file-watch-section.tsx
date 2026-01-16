import type { Dispatch, SetStateAction } from "react";
import { ChevronDown, FolderOpen, Settings, X } from "lucide-react";
import type { FileWatchConfig, FileWatchEvent } from "@shared/types";

interface MonitorTaskFileWatchSectionProps {
  t: (key: string) => string;
  config: FileWatchConfig;
  setConfig: Dispatch<SetStateAction<FileWatchConfig>>;
  showAdvancedSettings: boolean;
  setShowAdvancedSettings: Dispatch<SetStateAction<boolean>>;
  onSelectDirectory: (index: number) => void | Promise<void>;
}

export function MonitorTaskFileWatchSection({
  t,
  config,
  setConfig,
  showAdvancedSettings,
  setShowAdvancedSettings,
  onSelectDirectory,
}: MonitorTaskFileWatchSectionProps) {
  const watchPaths = config.watchPaths?.length ? config.watchPaths : [""]; // ensure at least one input
  const ignorePatterns = config.ignorePatterns ?? [];
  const events = config.events ?? [];

  const updateConfig = (updater: (prev: FileWatchConfig) => FileWatchConfig) => {
    setConfig((prev) => updater({ ...prev }));
  };

  const handleWatchPathChange = (index: number, value: string) => {
    updateConfig(prev => {
      const nextPaths = [...(prev.watchPaths ?? [""])];
      nextPaths[index] = value;
      return { ...prev, watchPaths: nextPaths };
    });
  };

  const handleRemoveWatchPath = (index: number) => {
    if (watchPaths.length <= 1) {
      return;
    }
    updateConfig(prev => {
      const nextPaths = (prev.watchPaths ?? [""]).filter((_, i) => i !== index);
      return { ...prev, watchPaths: nextPaths.length ? nextPaths : [""] };
    });
  };

  const handleAddWatchPath = () => {
    updateConfig(prev => ({
      ...prev,
      watchPaths: [...(prev.watchPaths ?? [""]), ""],
    }));
  };

  const handleIgnorePatternChange = (index: number, value: string) => {
    updateConfig(prev => {
      const nextPatterns = [...(prev.ignorePatterns ?? [])];
      nextPatterns[index] = value;
      return { ...prev, ignorePatterns: nextPatterns };
    });
  };

  const handleAddIgnorePattern = () => {
    updateConfig(prev => ({
      ...prev,
      ignorePatterns: [...(prev.ignorePatterns ?? []), ""],
    }));
  };

  const handleRemoveIgnorePattern = (index: number) => {
    updateConfig(prev => {
      const nextPatterns = (prev.ignorePatterns ?? []).filter((_, i) => i !== index);
      return { ...prev, ignorePatterns: nextPatterns };
    });
  };

  const toggleEvent = (event: FileWatchEvent, enabled: boolean) => {
    const updater = (prev: FileWatchConfig): FileWatchConfig => {
      const current = prev.events ?? []
      const nextEvents = enabled ? [...current, event] : current.filter((ev) => ev !== event)
      return { ...prev, events: nextEvents }
    }
    updateConfig(updater)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {t("monitor.create.watchPaths")} *
        </label>
        {watchPaths.map((path, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              type="text"
              value={path}
              onChange={(e) => handleWatchPathChange(index, e.target.value)}
              className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("monitor.create.watchPathPlaceholder")}
            />
            <button
              type="button"
              onClick={() => onSelectDirectory(index)}
              className="px-3 py-2 bg-bg-quaternary hover:bg-bg-tertiary text-text-primary rounded-lg transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
            {watchPaths.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveWatchPath(index)}
                className="px-3 py-2 bg-red-600 hover:bg-red-500 text-text-primary rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={handleAddWatchPath}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          {t("monitor.create.addWatchPath")}
        </button>
      </div>

      {/* 高级设置 */}
      <div className="border border-border-secondary rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 bg-bg-tertiary hover:bg-bg-quaternary transition-colors"
          onClick={() => setShowAdvancedSettings(prev => !prev)}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-text-secondary" />
            <span className="text-sm font-medium text-text-secondary">
              {t("monitor.create.advancedSettings")}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-text-tertiary transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`}
          />
        </button>

        {showAdvancedSettings && (
          <div className="p-4 space-y-4 bg-bg-tertiary">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t("monitor.create.debounceDelay")} (ms)
              </label>
              <input
                type="number"
                value={config.debounceMs}
                onChange={(e) =>
                  updateConfig(prev => ({
                    ...prev,
                    debounceMs: Number.isNaN(Number(e.target.value)) ? 1000 : parseInt(e.target.value, 10),
                  }))
                }
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="100"
                placeholder="1000"
              />
              <p className="text-xs text-text-tertiary mt-1">{t("monitor.create.debounceDelay.desc")}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t("monitor.create.batchSize")}
              </label>
              <input
                type="number"
                value={config.batchSize ?? 100}
                onChange={(e) =>
                  updateConfig(prev => ({
                    ...prev,
                    batchSize: Number.isNaN(Number(e.target.value)) ? 100 : parseInt(e.target.value, 10),
                  }))
                }
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                placeholder="100"
              />
              <p className="text-xs text-text-tertiary mt-1">{t("monitor.create.batchSize.desc")}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t("monitor.create.batchTimeout")} (ms)
              </label>
              <input
                type="number"
                value={config.batchTimeoutMs ?? 5000}
                onChange={(e) =>
                  updateConfig(prev => ({
                    ...prev,
                    batchTimeoutMs: Number.isNaN(Number(e.target.value)) ? 5000 : parseInt(e.target.value, 10),
                  }))
                }
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="100"
                placeholder="5000"
              />
              <p className="text-xs text-text-tertiary mt-1">{t("monitor.create.batchTimeout.desc")}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t("monitor.create.ignorePatterns")}
              </label>

              <div className="space-y-2">
                {ignorePatterns.map((pattern, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={pattern}
                      onChange={(e) => handleIgnorePatternChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t("monitor.create.ignorePatternPlaceholder")}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveIgnorePattern(index)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-500 text-text-primary rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddIgnorePattern}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {t("monitor.create.addIgnorePattern")}
                </button>
              </div>

              <div className="bg-bg-quaternary border border-border-secondary rounded-lg p-3 mt-3">
                <p className="text-xs text-text-secondary mb-3">
                  💡 {t("monitor.create.ignorePatternsDesc")}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-text-secondary mb-2">
                      📋 <strong>{t("monitor.create.scenarioTitle")}</strong>
                    </p>
                    <div className="space-y-2 text-xs text-text-tertiary">
                      <div>
                        <div className="text-text-secondary font-medium">{t("monitor.create.scenario.specificFile")}</div>
                        <div>
                          <code className="bg-bg-tertiary px-1 rounded text-text-secondary">
                            {t("monitor.create.example.importantDoc")}
                          </code>{" "}
                          <code className="bg-bg-tertiary px-1 rounded text-text-secondary">desktop.ini</code>
                        </div>
                      </div>
                      <div>
                        <div className="text-text-secondary font-medium">{t("monitor.create.scenario.specificFolder")}</div>
                        <div>
                          <code className="bg-bg-tertiary px-1 rounded text-text-secondary">
                            {t("monitor.create.example.importantFiles")}
                          </code>{" "}
                          <code className="bg-bg-tertiary px-1 rounded text-text-secondary">
                            {t("monitor.create.example.privateFiles")}
                          </code>
                        </div>
                      </div>
                      <div>
                        <div className="text-text-secondary font-medium">{t("monitor.create.scenario.fileTypes")}</div>
                        <div>
                          <code className="bg-bg-tertiary px-1 rounded text-text-secondary">*.psd</code>{" "}
                          <code className="bg-bg-tertiary px-1 rounded text-text-secondary">{'*.{exe,msi}'}</code>
                        </div>
                      </div>
                      <div>
                        <div className="text-text-secondary font-medium">{t("monitor.create.scenario.nameContains")}</div>
                        <div>
                          <code className="bg-bg-tertiary px-1 rounded text-text-secondary">
                            {t("monitor.create.example.backup")}
                          </code>{" "}
                          <code className="bg-bg-tertiary px-1 rounded text-text-secondary">*~*</code>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-text-secondary mb-2">
                      🔧 <strong>{t("monitor.create.wildcardRulesTitle")}</strong>
                    </p>
                    <div className="space-y-1 text-xs text-text-tertiary">
                      <div>{t("monitor.create.wildcard.star")}</div>
                      <div>{t("monitor.create.wildcard.question")}</div>
                      <div>{t("monitor.create.wildcard.brackets")}</div>
                      <div>{t("monitor.create.wildcard.range")}</div>
                      <div>{t("monitor.create.wildcard.negation")}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t("monitor.create.watchEvents")}
              </label>
              <div className="text-xs text-text-tertiary mb-3 p-2 bg-blue-900/20 rounded-lg border border-blue-500/30">
                💡 {t("monitor.create.watchEventsDesc")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "add", label: t("monitor.create.eventAdd") },
                  { value: "change", label: t("monitor.create.eventChange") },
                  { value: "unlink", label: t("monitor.create.eventDelete") },
                  { value: "addDir", label: t("monitor.create.eventAddDir") },
                  { value: "unlinkDir", label: t("monitor.create.eventDeleteDir") },
                ] as Array<{ value: FileWatchEvent; label: string }>).map((event) => (
                  <label key={event.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={events.includes(event.value as any)}
                      onChange={(e) => toggleEvent(event.value, e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-text-secondary">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
