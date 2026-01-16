import React, { useEffect, useState } from 'react'
import { Settings, X, Loader2, AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react'
import logoImage from "./ui/logo.png"
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Button } from './ui/button'
import { useConfirmDialog } from './ui/confirm-dialog'
import { useLanguage, Language } from '../contexts/language-context'
import { useTheme, Theme, UIScale } from '../contexts/theme-context'

interface SettingsViewProps {
  onClose: () => void
}

// 格式化文件大小的辅助函数
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function SettingsView({ onClose }: SettingsViewProps) {
  const { language, setLanguage, t } = useLanguage()
  const { theme, setTheme, uiScale, setUIScale } = useTheme()
  const { showConfirm, ConfirmDialog } = useConfirmDialog()

  // 设置状态
  const [minimizeToTray, setMinimizeToTray] = useState(false)
  const [autoLaunch, setAutoLaunch] = useState(false)
  
  // 存储相关状态
  const [storageUsage, setStorageUsage] = useState({
    appDataSize: 0,
    historySize: 0,
    tempSize: 0,
    totalSize: 0
  })
  const [isLoadingStorage, setIsLoadingStorage] = useState(false)
  const [isCleaningTemp, setIsCleaningTemp] = useState(false)
  const [isResettingWindow, setIsResettingWindow] = useState(false)

  // 历史记录相关状态
  const [historySettings, setHistorySettings] = useState({
    maxEntries: 1000,
    autoCleanupDays: 30
  })

  // 工作流处理相关状态
  const [workflowProcessingSettings, setWorkflowProcessingSettings] = useState({
    maxItems: 1000,        // 处理上限
    batchSize: 100,        // 批处理大小
    batchInterval: 100     // 处理间隔 (ms)
  })
  const [isClearingHistory, setIsClearingHistory] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [clearSuccess, setClearSuccess] = useState(false)

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const minimizeToTrayValue = await window.electronAPI.getSetting('minimizeToTray')
        setMinimizeToTray(minimizeToTrayValue || false)
        
        // 加载开机自启动设置
        const autoLaunchValue = await window.electronAPI.getAutoLaunch()
        setAutoLaunch(autoLaunchValue || false)
        
        // 加载存储使用情况
        await loadStorageUsage()
        
        // 加载历史记录设置
        await loadHistorySettings()

        // 加载工作流处理设置
        await loadWorkflowProcessingSettings()
        // 不再需要加载历史记录统计
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }

    loadSettings()
  }, [])
  
  // 加载存储使用情况
  const loadStorageUsage = async () => {
    try {
      setIsLoadingStorage(true)
      const usage = await window.electronAPI.getStorageUsage()
      setStorageUsage(usage)
    } catch (error) {
      console.error('Failed to load storage usage:', error)
    } finally {
      setIsLoadingStorage(false)
    }
  }
  
  // 加载历史记录设置
  const loadHistorySettings = async () => {
    try {
      const settings = await window.electronAPI.getHistorySettings()
      setHistorySettings(settings)
    } catch (error) {
      console.error('Failed to load history settings:', error)
    }
  }

  // 加载工作流处理设置
  const loadWorkflowProcessingSettings = async () => {
    try {
      const maxItems = await window.electronAPI.getSetting('workflow.processing.maxItems') || 1000
      const batchSize = await window.electronAPI.getSetting('workflow.processing.batchSize') || 100
      const batchInterval = await window.electronAPI.getSetting('workflow.processing.batchInterval') || 100

      setWorkflowProcessingSettings({
        maxItems,
        batchSize,
        batchInterval
      })
    } catch (error) {
      console.error('Failed to load workflow processing settings:', error)
    }
  }
  
  // 更新历史记录设置
  const updateHistorySettings = async (changes: Partial<typeof historySettings>) => {
    try {
      const updatedSettings = { ...historySettings, ...changes };
      const success = await window.electronAPI.updateHistorySettings(updatedSettings);

      if (success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);

        // 加载存储使用情况
        await loadStorageUsage();
      }
    } catch (error) {
      console.error('Failed to update history settings:', error);
    }
  };

  // 更新工作流处理设置
  const updateWorkflowProcessingSettings = async (changes: Partial<typeof workflowProcessingSettings>) => {
    try {
      const updatedSettings = { ...workflowProcessingSettings, ...changes };

      // 保存到设置
      await window.electronAPI.setSetting('workflow.processing.maxItems', updatedSettings.maxItems);
      await window.electronAPI.setSetting('workflow.processing.batchSize', updatedSettings.batchSize);
      await window.electronAPI.setSetting('workflow.processing.batchInterval', updatedSettings.batchInterval);

      setWorkflowProcessingSettings(updatedSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to update workflow processing settings:', error);
    }
  };
  
  // 清空历史记录
  const clearHistory = async () => {
    try {
      setIsClearingHistory(true)
      const success = await window.electronAPI.clearHistory()
      
      if (success) {
        setShowClearConfirm(false)
        setClearSuccess(true)
        setTimeout(() => setClearSuccess(false), 3000)
        
        // 加载存储使用情况
        await loadStorageUsage()
      }
    } catch (error) {
      console.error('Failed to clear history:', error)
    } finally {
      setIsClearingHistory(false)
    }
  }
  
  // 清理临时文件
  const handleCleanTempFiles = async () => {
    try {
      setIsCleaningTemp(true)
      const success = await window.electronAPI.cleanTempFiles()
      
      if (success) {
        // 清理成功后重新加载存储信息
        await loadStorageUsage()
      }
    } catch (error) {
      console.error('Failed to clean temp files:', error)
    } finally {
      setIsCleaningTemp(false)
    }
  }

  // 保存设置的函数
  const saveSetting = async (key: string, value: any) => {
    try {
      await window.electronAPI.setSetting(key, value)
    } catch (error) {
      console.error('Failed to save setting:', error)
    }
  }

  // 重置窗口大小
  const handleResetWindowSize = async () => {
    setIsResettingWindow(true)
    try {
      const success = await window.electronAPI.resetWindowToDefaultSize()
      if (success) {
        // 可以添加成功提示
        console.log(t('settings.resetWindowSize.success'))
      } else {
        console.error(t('settings.resetWindowSize.failed'))
      }
    } catch (error) {
      console.error('Failed to reset window size:', error)
    } finally {
      setIsResettingWindow(false)
    }
  }

  // ESC键关闭功能
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* 设置悬浮窗 */}
      <Card className="relative bg-bg-secondary border-border-primary w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 mx-4">
        {/* 标题栏 */}
        <CardHeader className="flex-shrink-0 px-6 py-4 border-b border-border-primary">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-text-primary">{t('settings.title')}</CardTitle>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-bg-tertiary rounded transition-colors"
            >
              <X className="w-4 h-4 text-text-tertiary" />
            </button>
          </div>
        </CardHeader>

        {/* 设置内容区域 */}
        <CardContent className="flex-1 p-6 overflow-y-auto scrollbar-hide space-y-8">
          {/* 常规设置 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text-primary mb-4">{t('settings.general')}</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-text-secondary">{t('settings.autoLaunch')}</label>
                  <p className="text-xs text-text-tertiary">{t('settings.autoLaunch.desc')}</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle"
                  checked={autoLaunch}
                  onChange={(e) => {
                    const value = e.target.checked
                    setAutoLaunch(value)
                    window.electronAPI.setAutoLaunch(value)
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-text-secondary">{t('settings.minimizeToTray')}</label>
                  <p className="text-xs text-text-tertiary">{t('settings.minimizeToTray.desc')}</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle"
                  checked={minimizeToTray}
                  onChange={(e) => {
                    const value = e.target.checked
                    setMinimizeToTray(value)
                    saveSetting('minimizeToTray', value)
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('settings.language')}</label>
                <Select
                  value={language}
                  onValueChange={(value) => setLanguage(value as Language)}
                >
                  <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-bg-tertiary border-border-secondary">
                    <SelectItem value="zh-CN" className="text-text-secondary">{t('language.zh-CN')}</SelectItem>
                    <SelectItem value="en-US" className="text-text-secondary">{t('language.en-US')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 外观设置 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text-primary mb-4">{t('settings.appearance')}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('settings.theme')}</label>
                <Select
                  value={theme}
                  onValueChange={(value) => setTheme(value as Theme)}
                >
                  <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-bg-tertiary border-border-secondary">
                    <SelectItem value="dark" className="text-text-secondary">{t('settings.theme.dark')}</SelectItem>
                    <SelectItem value="light" className="text-text-secondary">{t('settings.theme.light')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('settings.uiScale')}</label>
                <Select
                  value={uiScale}
                  onValueChange={(value) => setUIScale(value as UIScale)}
                >
                  <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-bg-tertiary border-border-secondary">
                    <SelectItem value="0.8" className="text-text-secondary">80%</SelectItem>
                    <SelectItem value="0.9" className="text-text-secondary">90%</SelectItem>
                    <SelectItem value="1.0" className="text-text-secondary">100%</SelectItem>
                    <SelectItem value="1.1" className="text-text-secondary">110%</SelectItem>
                    <SelectItem value="1.2" className="text-text-secondary">120%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-text-secondary">{t('settings.resetWindowSize')}</label>
                    <p className="text-xs text-text-tertiary">{t('settings.resetWindowSize.desc')}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResetWindowSize}
                    disabled={isResettingWindow}
                    className="bg-bg-tertiary border-border-secondary hover:bg-bg-quaternary text-text-secondary"
                  >
                    {isResettingWindow ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 工作流处理设置 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">{t('settings.workflowProcessing')}</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('settings.workflowProcessing.maxItems')}
                </label>
                <Select
                  value={workflowProcessingSettings.maxItems.toString()}
                  onValueChange={(value) => updateWorkflowProcessingSettings({ maxItems: parseInt(value) })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="1000">1000</SelectItem>
                    <SelectItem value="2000">2000</SelectItem>
                    <SelectItem value="3000">3000</SelectItem>
                    <SelectItem value="5000">5000</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-text-tertiary mt-1">{t('settings.workflowProcessing.maxItems.desc')}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {t('settings.workflowProcessing.batchSize')}
                  </label>
                  <Select
                    value={workflowProcessingSettings.batchSize.toString()}
                    onValueChange={(value) => updateWorkflowProcessingSettings({ batchSize: parseInt(value) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="300">300</SelectItem>
                      <SelectItem value="400">400</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                      <SelectItem value="600">600</SelectItem>
                      <SelectItem value="700">700</SelectItem>
                      <SelectItem value="800">800</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-text-tertiary mt-1">{t('settings.workflowProcessing.batchSize.desc')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {t('settings.workflowProcessing.batchInterval')} (ms)
                  </label>
                  <Select
                    value={workflowProcessingSettings.batchInterval.toString()}
                    onValueChange={(value) => updateWorkflowProcessingSettings({ batchInterval: parseInt(value) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                      <SelectItem value="1000">1000</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-text-tertiary mt-1">{t('settings.workflowProcessing.batchInterval.desc')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 历史记录设置 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">{t('settings.history')}</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('settings.maxHistoryEntries')}</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary"
                  value={historySettings.maxEntries}
                  onChange={(e) => {
                    const value = Math.max(100, Math.min(10000, parseInt(e.target.value) || 1000));
                    setHistorySettings({...historySettings, maxEntries: value});
                    updateHistorySettings({maxEntries: value});
                  }}
                  min={100}
                  max={10000}
                />
                <p className="text-xs text-text-tertiary mt-1">{t('settings.maxHistoryEntries.desc')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">{t('settings.autoCleanupDays')}</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary"
                  value={historySettings.autoCleanupDays}
                  onChange={(e) => {
                    const value = Math.max(1, Math.min(365, parseInt(e.target.value) || 30));
                    setHistorySettings({...historySettings, autoCleanupDays: value});
                    updateHistorySettings({autoCleanupDays: value});
                  }}
                  min={1}
                  max={365}
                />
                <p className="text-xs text-text-tertiary mt-1">{t('settings.autoCleanupDays.desc')}</p>
              </div>

              {/* 成功消息 */}
              {saveSuccess && (
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-900 text-green-800 dark:text-green-200 p-3 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>{t('settings.saved')}</span>
                </div>
              )}

              {/* 清除历史记录确认 */}
              {showClearConfirm ? (
                <div className="pt-4 border-t border-border-secondary">
                  <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 p-3 rounded-lg mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-semibold">{t('settings.history.confirmClear')}</span>
                    </div>
                    <p className="text-sm">{t('settings.history.confirmClearDesc')}</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={clearHistory}
                        disabled={isClearingHistory}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex items-center gap-1"
                      >
                        {isClearingHistory && <Loader2 className="w-3 h-3 animate-spin" />}
                        {t('settings.history.confirmYes')}
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm"
                      >
                        {t('settings.history.confirmNo')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t border-border-secondary">
                  {clearSuccess ? (
                    <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-900 text-green-800 dark:text-green-200 p-3 rounded-lg flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5" />
                      <span>{t('settings.history.clearSuccess')}</span>
                    </div>
                  ) : null}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-text-primary rounded-lg transition-colors"
                    >
                      {t('settings.clearAllHistory')}
                    </button>
                    <p className="text-xs text-text-tertiary mt-2 text-center">{t('settings.clearAllHistory.desc')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 存储管理 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">{t('settings.storage')}</h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg-tertiary p-4 rounded-lg">
                  <div className="text-sm text-text-tertiary">{t('settings.appData')}</div>
                  <div className="text-2xl font-bold text-text-primary">
                    {isLoadingStorage ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">加载中...</span>
                      </div>
                    ) : (
                      formatFileSize(storageUsage.appDataSize)
                    )}
                  </div>
                </div>
                <div className="bg-bg-tertiary p-4 rounded-lg">
                  <div className="text-sm text-text-tertiary">{t('settings.historyData')}</div>
                  <div className="text-2xl font-bold text-text-primary">
                    {isLoadingStorage ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">加载中...</span>
                      </div>
                    ) : (
                      formatFileSize(storageUsage.historySize)
                    )}
                  </div>
                </div>
              </div>
              
              <div className="bg-bg-tertiary p-4 rounded-lg mt-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-text-tertiary">{t('settings.tempFiles')}</div>
                    <div className="text-xl font-bold text-text-primary">
                      {isLoadingStorage ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">加载中...</span>
                        </div>
                      ) : (
                        formatFileSize(storageUsage.tempSize)
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={handleCleanTempFiles}
                    disabled={isCleaningTemp || storageUsage.tempSize === 0}
                    className={`px-3 py-1.5 rounded-lg transition-colors text-sm ${
                      storageUsage.tempSize === 0 
                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isCleaningTemp ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>{t('settings.cleaning')}</span>
                      </div>
                    ) : (
                      t('settings.cleanTempFiles')
                    )}
                  </button>
                </div>
                <p className="text-xs text-text-tertiary mt-2">{t('settings.cleanTempFiles.desc')}</p>
              </div>
            </div>
          </div>

          {/* 关于 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-text-primary mb-4">{t('settings.about')}</h3>

            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4 overflow-hidden">
                  <img
                    src={logoImage}
                    alt="Arro Engine Logo"
                    className="w-16 h-16 object-contain"
                    onError={(e) => {
                      // 如果图片加载失败，显示默认图标
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center" style={{ display: 'none' }}>
                    <Settings className="w-8 h-8 text-text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-text-primary mb-2">{t('app.title')}</h3>
                <p className="text-text-tertiary mb-4">{t('settings.about.subtitle')}</p>
                <div className="text-sm text-text-tertiary space-y-1">
                  <p>{t('settings.about.version')}: 1.0.2</p>
                  <p>{t('settings.about.author')}: <span className="text-text-secondary font-medium">{t('settings.about.authorName')}</span></p>
                </div>
              </div>

              <div className="border-t border-border-secondary pt-4">
                <h4 className="text-text-primary font-medium mb-2">{t('settings.about.features')}</h4>
                <ul className="text-sm text-text-tertiary space-y-1">
                  <li>• {t('settings.about.feature1')}</li>
                  <li>• {t('settings.about.feature2')}</li>
                  <li>• {t('settings.about.feature3')}</li>
                  <li>• {t('settings.about.feature4')}</li>
                  <li>• {t('settings.about.feature5')}</li>
                </ul>
              </div>

              <div className="border-t border-border-secondary pt-4 text-center">
                <button
                  onClick={() => showConfirm({
                    title: t('settings.about.checkUpdate'),
                    description: t('settings.about.updateNotice'),
                    variant: 'default',
                    confirmText: t('common.confirm'),
                    onConfirm: () => {}
                  })}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-text-primary rounded-lg transition-colors"
                >
                  {t('settings.about.checkUpdate')}
                </button>
                <p className="text-xs text-text-tertiary mt-2">{t('settings.about.checkUpdate.desc')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog />
    </div>
  )
}
