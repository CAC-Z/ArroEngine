import { useState, useEffect } from "react"
import { 
  X, 
  Clock, 
  Calendar, 
  FolderOpen, 
  Activity, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Play,
  Pause,
  BarChart3,
  FileText,
  Settings
} from "lucide-react"
import { MonitorTask, MonitorTaskStatus, Workflow, FileWatchConfig, ScheduledConfig } from "@shared/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "../contexts/language-context"

interface MonitorTaskDetailModalProps {
  task: MonitorTask | null
  isOpen: boolean
  onClose: () => void
  onEdit: (task: MonitorTask) => void
  onExecute: (taskId: string) => void
  onToggle: (task: MonitorTask) => void
}

export function MonitorTaskDetailModal({
  task,
  isOpen,
  onClose,
  onEdit,
  onExecute,
  onToggle
}: MonitorTaskDetailModalProps) {
  const { t, language } = useLanguage()
  const [taskStatus, setTaskStatus] = useState<MonitorTaskStatus | null>(null)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && task) {
      loadTaskDetails()
    }
  }, [isOpen, task])

  // 监听语言变化，重新加载工作流以更新默认工作流的名称和描述
  useEffect(() => {
    if (isOpen && task) {
      loadTaskDetails()
    }
  }, [language, isOpen, task])

  // ESC键关闭功能
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const loadTaskDetails = async () => {
    if (!task) return
    
    try {
      setIsLoading(true)
      const [statusData, workflowsData] = await Promise.all([
        window.electronAPI.getMonitorTaskStatus(task.id),
        window.electronAPI.getAllWorkflows()
      ])
      
      setTaskStatus(statusData)
      const foundWorkflow = workflowsData.find(w => w.id === task.workflowId)
      setWorkflow(foundWorkflow || null)
    } catch (error) {
      console.error('Failed to load task details:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(2)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}min`
    return `${(ms / 3600000).toFixed(1)}h`
  }

  const formatNextRun = (nextRun?: string) => {
    if (!nextRun) return '-'
    const date = new Date(nextRun)
    const now = new Date()
    const diff = date.getTime() - now.getTime()

    if (diff < 0) return t('monitor.detail.expired')
    if (diff < 60000) return t('monitor.detail.aboutToRun')
    if (diff < 3600000) return t('monitor.detail.minutesLater', { minutes: Math.floor(diff / 60000) })
    if (diff < 86400000) return t('monitor.detail.hoursLater', { hours: Math.floor(diff / 3600000) })
    return t('monitor.detail.daysLater', { days: Math.floor(diff / 86400000) })
  }

  const getStatusIcon = () => {
    if (!task) return null
    
    if (!task.enabled) {
      return <Pause className="w-5 h-5 text-text-tertiary" />
    }
    
    if (taskStatus?.isRunning) {
      return <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
    }
    
    if (task.status === 'error') {
      return <XCircle className="w-5 h-5 text-red-400" />
    }
    
    if (task.statistics.successfulExecutions > 0) {
      return <CheckCircle className="w-5 h-5 text-green-400" />
    }
    
    return <Clock className="w-5 h-5 text-text-tertiary" />
  }

  const getStatusText = () => {
    if (!task) return ''

    if (!task.enabled) return t('monitor.detail.disabled')
    if (taskStatus?.isRunning) return t('monitor.detail.running')
    if (task.status === 'error') return t('monitor.detail.error')
    if (task.statistics.totalExecutions === 0) return t('monitor.detail.waiting')
    return t('monitor.detail.idle')
  }

  const renderConfig = () => {
    if (!task) return null

    if (task.type === 'file_watch') {
      const config = task.config as FileWatchConfig
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-text-secondary">{t('monitor.detail.fileWatchConfig')}</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-tertiary">{t('monitor.detail.watchPaths')}</span>
              <div className="text-text-secondary mt-1">
                {config.watchPaths.map((path, index) => (
                  <div key={index} className="truncate">{path}</div>
                ))}
              </div>
            </div>
            <div>
              <span className="text-text-tertiary">{t('monitor.detail.watchEvents')}</span>
              <div className="text-text-secondary mt-1">
                {config.events.join(', ')}
              </div>
            </div>
            <div>
              <span className="text-text-tertiary">{t('monitor.detail.includeSubfolders')}</span>
              <span className="text-text-secondary ml-1">{config.recursive ? t('common.yes') : t('common.no')}</span>
            </div>
            <div>
              <span className="text-text-tertiary">{t('monitor.detail.debounceDelay')}</span>
              <span className="text-text-secondary ml-1">{config.debounceMs}ms</span>
            </div>
            <div>
              <span className="text-text-tertiary">{t('monitor.detail.batchSize')}</span>
              <span className="text-text-secondary ml-1">{config.batchSize || t('monitor.detail.unlimited')}</span>
            </div>
          </div>
        </div>
      )
    } else {
      const config = task.config as ScheduledConfig
      return (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-text-secondary">{t('monitor.detail.scheduledConfig')}</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-tertiary">{t('monitor.detail.inputPath')}</span>
              <div className="text-text-secondary mt-1 truncate">{config.inputPath}</div>
            </div>
            <div>
              <span className="text-text-tertiary">{t('monitor.detail.cronExpression')}</span>
              <div className="text-text-secondary mt-1">{config.cronExpression}</div>
            </div>
            <div>
              <span className="text-text-tertiary">{t('monitor.detail.timezone')}</span>
              <span className="text-text-secondary ml-1">{config.timezone}</span>
            </div>
            <div>
              <span className="text-text-tertiary">{t('monitor.detail.recursive')}</span>
              <span className="text-text-secondary ml-1">{config.recursive ? t('common.yes') : t('common.no')}</span>
            </div>
            <div>
              <span className="text-text-tertiary">{t('monitor.detail.skipIfRunning')}</span>
              <span className="text-text-secondary ml-1">{config.skipIfRunning ? t('common.yes') : t('common.no')}</span>
            </div>
          </div>
        </div>
      )
    }
  }

  // ESC键关闭功能
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !task) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* 详情面板 */}
      <Card className="relative bg-bg-secondary border-border-primary w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 mx-4">
        <CardHeader className="flex-shrink-0 px-6 py-4 border-b border-border-primary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <CardTitle className="text-xl font-semibold text-text-primary">{task.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    task.type === 'file_watch' 
                      ? 'bg-blue-600/20 text-blue-400' 
                      : 'bg-purple-600/20 text-purple-400'
                  }`}>
                    {task.type === 'file_watch' ? t('monitor.detail.fileWatch') : t('monitor.detail.scheduled')}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    task.enabled 
                      ? 'bg-green-600/20 text-green-400' 
                      : 'bg-bg-quaternary/20 text-text-tertiary'
                  }`}>
                    {getStatusText()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onExecute(task.id)}
                disabled={!task.enabled || taskStatus?.isRunning}
                className="p-2 text-text-tertiary hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('monitor.detail.executeNow')}
              >
                <Play className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => onToggle(task)}
                className={`p-2 rounded-lg transition-colors ${
                  task.enabled
                    ? 'text-yellow-400 hover:bg-yellow-600/10'
                    : 'text-green-400 hover:bg-green-600/10'
                }`}
                title={task.enabled ? t('monitor.detail.disableTask') : t('monitor.detail.enableTask')}
              >
                {task.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              
              <button
                onClick={() => onEdit(task)}
                className="p-2 text-text-tertiary hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors"
                title={t('monitor.detail.editTask')}
              >
                <Settings className="w-4 h-4" />
              </button>
              
              <button
                onClick={onClose}
                className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Activity className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-text-primary flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {t('monitor.detail.basicInfo')}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-tertiary">{t('monitor.detail.taskDescription')}</span>
                    <p className="text-text-secondary mt-1">{task.description || t('monitor.detail.noDescription')}</p>
                  </div>
                  <div>
                    <span className="text-text-tertiary">{t('monitor.detail.associatedRule')}</span>
                    <p className="text-text-secondary mt-1">{workflow?.name || t('monitor.detail.unknownRule')}</p>
                  </div>
                  <div>
                    <span className="text-text-tertiary">{t('monitor.detail.createdAt')}</span>
                    <p className="text-text-secondary mt-1">{new Date(task.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-text-tertiary">{t('monitor.detail.updatedAt')}</span>
                    <p className="text-text-secondary mt-1">{new Date(task.updatedAt).toLocaleString()}</p>
                  </div>
                  {task.lastExecuted && (
                    <div>
                      <span className="text-text-tertiary">{t('monitor.detail.lastExecuted')}</span>
                      <p className="text-text-secondary mt-1">{new Date(task.lastExecuted).toLocaleString()}</p>
                    </div>
                  )}
                  {task.nextExecution && (
                    <div>
                      <span className="text-text-tertiary">{t('monitor.detail.nextExecution')}</span>
                      <p className="text-text-secondary mt-1">{formatNextRun(task.nextExecution)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 执行统计 */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-text-primary flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  {t('monitor.detail.executionStats')}
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-bg-tertiary rounded-lg p-4">
                    <div className="text-2xl font-bold text-text-primary">{task.statistics.totalExecutions}</div>
                    <div className="text-sm text-text-tertiary">{t('monitor.detail.totalExecutions')}</div>
                  </div>
                  <div className="bg-bg-tertiary rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-400">{task.statistics.successfulExecutions}</div>
                    <div className="text-sm text-text-tertiary">{t('monitor.detail.successfulExecutions')}</div>
                  </div>
                  <div className="bg-bg-tertiary rounded-lg p-4">
                    <div className="text-2xl font-bold text-red-400">{task.statistics.failedExecutions}</div>
                    <div className="text-sm text-text-tertiary">{t('monitor.detail.failedExecutions')}</div>
                  </div>
                  <div className="bg-bg-tertiary rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-400">{task.statistics.totalFilesProcessed}</div>
                    <div className="text-sm text-text-tertiary">{t('monitor.detail.processedFiles')}</div>
                  </div>
                </div>
                
                {task.statistics.averageExecutionTime && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-text-tertiary">{t('monitor.detail.averageExecutionTime')}</span>
                      <span className="text-text-secondary ml-1">{formatDuration(task.statistics.averageExecutionTime)}</span>
                    </div>
                    {task.statistics.lastExecutionDuration && (
                      <div>
                        <span className="text-text-tertiary">{t('monitor.detail.lastExecutionDuration')}</span>
                        <span className="text-text-secondary ml-1">{formatDuration(task.statistics.lastExecutionDuration)}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {task.statistics.lastError && (
                  <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">{t('monitor.detail.recentError')}</span>
                    </div>
                    <p className="text-sm text-red-300">{task.statistics.lastError}</p>
                    {task.statistics.lastErrorTime && (
                      <p className="text-xs text-red-400 mt-1">
                        {new Date(task.statistics.lastErrorTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 配置信息 */}
              {renderConfig()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
