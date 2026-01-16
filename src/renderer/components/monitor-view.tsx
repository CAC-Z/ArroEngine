import { useState, useEffect } from "react"
import { 
  Clock, 
  Plus, 
  Play, 
  Pause, 
  Settings, 
  Trash2, 
  Eye, 
  Calendar,
  FolderOpen,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react"
import { MonitorTask, MonitorTaskStatus, MonitorExecutionResult, Workflow } from "@shared/types"
import { CreateMonitorTaskModal } from "./create-monitor-task-modal"
import { MonitorTaskDetailModal } from "./monitor-task-detail-modal"
import { EditMonitorTaskModal } from "./edit-monitor-task-modal"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { useLanguage } from "../contexts/language-context"

// 将技术性错误信息转换为用户友好的信息
const formatUserFriendlyError = (error: string): string => {
  // 移除技术性前缀
  let cleanError = error.replace(/^Error invoking remote method '[^']+': /, '')
  cleanError = cleanError.replace(/^Error: /, '')

  // 常见错误的友好提示
  const errorMappings: Record<string, string> = {
    '没有找到要处理的文件': '监控目录中没有找到符合条件的文件。\n\n建议：\n• 检查监控路径是否正确\n• 确认目录中有文件存在\n• 检查文件过滤条件设置',
    '工作流不存在': '所选的工作流已被删除或不可用。\n\n建议：\n• 重新选择一个有效的工作流\n• 检查工作流是否已被禁用',
    '权限被拒绝': '没有足够的权限访问文件或目录。\n\n建议：\n• 以管理员身份运行程序\n• 检查文件或目录的访问权限',
    '文件或目录不存在': '指定的文件或目录不存在。\n\n建议：\n• 检查路径是否正确\n• 确认文件或目录是否已被移动或删除',
    'Maximum call stack size exceeded': '程序遇到了内部错误。\n\n建议：\n• 重启应用程序\n• 如果问题持续存在，请联系技术支持',
    '监控任务不存在': '指定的监控任务已被删除或不存在。\n\n建议：\n• 刷新页面重新加载任务列表\n• 检查任务是否已被其他用户删除',
    'ENOENT': '文件或目录不存在。\n\n建议：\n• 检查路径是否正确\n• 确认文件或目录是否已被移动或删除',
    'EACCES': '权限不足，无法访问文件或目录。\n\n建议：\n• 以管理员身份运行程序\n• 检查文件或目录的访问权限',
    'EPERM': '操作被系统拒绝。\n\n建议：\n• 以管理员身份运行程序\n• 检查文件是否被其他程序占用'
  }

  // 查找匹配的错误映射
  for (const [key, value] of Object.entries(errorMappings)) {
    if (cleanError.includes(key)) {
      return value
    }
  }

  // 如果没有找到特定映射，返回清理后的错误信息
  return cleanError
}

export function MonitorView() {
  const { t, language } = useLanguage()
  const { showConfirm, ConfirmDialog } = useConfirmDialog()
  const [tasks, setTasks] = useState<MonitorTask[]>([])
  const [taskStatuses, setTaskStatuses] = useState<MonitorTaskStatus[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<MonitorTask | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTask, setEditingTask] = useState<MonitorTask | null>(null)

  // 加载数据
  useEffect(() => {
    loadData()
  }, [])

  // 监听语言变化，重新加载工作流以更新默认工作流的名称和描述
  useEffect(() => {
    loadData()
  }, [language])

  // 监听监控事件
  useEffect(() => {
    let isSubscribed = true

    const handleTaskCreated = (task: MonitorTask) => {
      if (!isSubscribed) return
      setTasks(prev => {
        // 检查是否已存在相同ID的任务，避免重复添加
        if (prev.some(t => t.id === task.id)) {
          return prev
        }
        return [...prev, task]
      })
    }

    const handleTaskUpdated = (task: MonitorTask) => {
      if (!isSubscribed) return
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
    }

    const handleTaskDeleted = (taskId: string) => {
      if (!isSubscribed) return
      setTasks(prev => prev.filter(t => t.id !== taskId))
    }

    const handleExecutionCompleted = ({ result, historyEntry }: { result: MonitorExecutionResult; historyEntry?: any }) => {
      if (!isSubscribed) return
      console.log('任务执行完成:', result, historyEntry)

      // 只更新相关任务的数据，避免整页刷新
      const updateTaskData = async () => {
        try {
          // 获取更新后的任务数据
          const updatedTask = await window.electronAPI.getMonitorTask(result.taskId)
          if (updatedTask) {
            setTasks(prev => prev.map(t => t.id === result.taskId ? updatedTask : t))
          }

          // 更新任务状态
          const updatedStatus = await window.electronAPI.getMonitorTaskStatus(result.taskId)
          if (updatedStatus) {
            setTaskStatuses(prev => prev.map(s => s.taskId === result.taskId ? updatedStatus : s))
          }
        } catch (error) {
          console.error('更新任务数据失败:', error)
        }
      }

      updateTaskData()
    }

    const handleWorkflowsUpdated = (data: { workflow: Workflow; isNew: boolean }) => {
      if (!isSubscribed) return
      console.log('监控视图收到工作流更新事件:', data.workflow.name, '是否新建:', data.isNew)

      // 重新加载工作流列表
      loadData()
    }

    const handleWorkflowsDeleted = (data: { workflowId: string }) => {
      if (!isSubscribed) return
      console.log('监控视图收到工作流删除事件:', data.workflowId)

      // 重新加载工作流列表
      loadData()
    }

    window.electronAPI.onMonitorTaskCreated(handleTaskCreated)
    window.electronAPI.onMonitorTaskUpdated(handleTaskUpdated)
    window.electronAPI.onMonitorTaskDeleted(handleTaskDeleted)
    window.electronAPI.onMonitorExecutionCompleted(handleExecutionCompleted)

    // 监听工作流更新事件
    if (window.electronAPI.onWorkflowsUpdated) {
      window.electronAPI.onWorkflowsUpdated(handleWorkflowsUpdated)
    }
    if (window.electronAPI.onWorkflowsDeleted) {
      window.electronAPI.onWorkflowsDeleted(handleWorkflowsDeleted)
    }

    return () => {
      isSubscribed = false
    }
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [tasksData, statusesData, workflowsData] = await Promise.all([
        window.electronAPI.getAllMonitorTasks(),
        window.electronAPI.getAllMonitorTaskStatuses(),
        window.electronAPI.getAllWorkflows()
      ])
      setTasks(tasksData)
      setTaskStatuses(statusesData)
      setWorkflows(workflowsData)
    } catch (error) {
      console.error('加载监控数据失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadTaskStatuses = async () => {
    try {
      const statusesData = await window.electronAPI.getAllMonitorTaskStatuses()
      setTaskStatuses(statusesData)
    } catch (error) {
      console.error('加载任务状态失败:', error)
    }
  }

  const handleToggleTask = async (task: MonitorTask) => {
    console.log(`[前端] 开始切换任务状态: ${task.name}, 当前状态: ${task.enabled}`)

    try {
      const updatedTask = await window.electronAPI.updateMonitorTask(task.id, { enabled: !task.enabled })
      console.log(`[前端] 任务状态更新结果:`, updatedTask)

      if (updatedTask) {
        // 只更新这个任务的数据
        setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t))

        // 更新任务状态
        const updatedStatus = await window.electronAPI.getMonitorTaskStatus(task.id)
        if (updatedStatus) {
          setTaskStatuses(prev => prev.map(s => s.taskId === task.id ? updatedStatus : s))
        }

        console.log(`[前端] 任务状态切换成功: ${task.name}, 新状态: ${updatedTask.enabled}`)
      } else {
        console.error(`[前端] 任务状态更新失败，返回null`)
      }
    } catch (error) {
      console.error('[前端] 切换任务状态失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      const friendlyError = formatUserFriendlyError(errorMessage)

      showConfirm({
        title: '任务状态切换失败',
        description: `无法切换任务状态，请检查以下信息：\n\n${friendlyError}`,
        variant: 'destructive',
        confirmText: t('common.confirm'),
        onConfirm: () => {}
      })
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    showConfirm({
      title: t('monitor.deleteConfirmTitle'),
      description: t('monitor.deleteConfirmDesc', { name: task?.name || '' }),
      variant: 'destructive',
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        console.log(`[前端] 开始删除任务: ${taskId}`)

        try {
          const result = await window.electronAPI.deleteMonitorTask(taskId)
          console.log(`[前端] 删除任务结果:`, result)

          if (result) {
            // 重新加载数据
            await loadData()
            console.log(`[前端] 任务删除成功，数据已重新加载`)
          } else {
            console.error(`[前端] 任务删除失败，返回false`)
          }
        } catch (error) {
          console.error('[前端] 删除任务失败:', error)
          const errorMessage = error instanceof Error ? error.message : String(error)
          const friendlyError = formatUserFriendlyError(errorMessage)

          showConfirm({
            title: '删除任务失败',
            description: `无法删除监控任务，请检查以下信息：\n\n${friendlyError}`,
            variant: 'destructive',
            confirmText: t('common.confirm'),
            onConfirm: () => {}
          })
        }
      }
    })
  }

  const handleExecuteTask = async (taskId: string) => {
    try {
      await window.electronAPI.executeMonitorTask(taskId)

      // 只更新相关任务的数据，避免整页刷新
      const updatedTask = await window.electronAPI.getMonitorTask(taskId)
      if (updatedTask) {
        setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t))
      }

      const updatedStatus = await window.electronAPI.getMonitorTaskStatus(taskId)
      if (updatedStatus) {
        setTaskStatuses(prev => prev.map(s => s.taskId === taskId ? updatedStatus : s))
      }
    } catch (error) {
      console.error('Failed to execute task:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      const friendlyError = formatUserFriendlyError(errorMessage)

      showConfirm({
        title: t('monitor.executeFailedTitle'),
        description: t('monitor.executeFailedDesc', { error: friendlyError }),
        variant: 'destructive',
        confirmText: t('common.confirm'),
        onConfirm: () => {}
      })
    }
  }

  const handleCreateTask = async (taskData: Omit<MonitorTask, 'id' | 'createdAt' | 'updatedAt' | 'statistics'>) => {
    try {
      await window.electronAPI.createMonitorTask(taskData)
      setShowCreateModal(false)

      // 重新加载数据以确保状态同步
      await loadData()
    } catch (error) {
      console.error('Failed to create task:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      const friendlyError = formatUserFriendlyError(errorMessage)

      showConfirm({
        title: t('monitor.createFailedTitle'),
        description: t('monitor.createFailedDesc', { error: friendlyError }),
        variant: 'destructive',
        confirmText: t('common.confirm'),
        onConfirm: () => {}
      })
    }
  }

  const handleEditTask = (task: MonitorTask) => {
    setEditingTask(task)
    setShowEditModal(true)
    setShowDetailModal(false)
  }

  const handleUpdateTask = async (taskId: string, updates: Partial<MonitorTask>) => {
    try {
      await window.electronAPI.updateMonitorTask(taskId, updates)
      setShowEditModal(false)
      setEditingTask(null)

      // 重新加载数据
      await loadData()
    } catch (error) {
      console.error('Failed to update task:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      const friendlyError = formatUserFriendlyError(errorMessage)

      showConfirm({
        title: t('monitor.updateFailedTitle'),
        description: t('monitor.updateFailedDesc', { error: friendlyError }),
        variant: 'destructive',
        confirmText: t('common.confirm'),
        onConfirm: () => {}
      })
    }
  }

  const handleViewDetails = (task: MonitorTask) => {
    setSelectedTask(task)
    setShowDetailModal(true)
  }

  const getTaskStatus = (taskId: string) => {
    return taskStatuses.find(status => status.taskId === taskId)
  }

  const getWorkflowName = (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId)
    return workflow?.name || t('monitor.unknownWorkflow')
  }

  const getStatusIcon = (task: MonitorTask) => {
    const status = getTaskStatus(task.id)
    
    if (!task.enabled) {
      return <Pause className="w-4 h-4 text-text-tertiary" />
    }
    
    if (status?.isRunning) {
      return <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
    }
    
    if (task.status === 'error') {
      return <XCircle className="w-4 h-4 text-red-400" />
    }
    
    if (task.statistics.successfulExecutions > 0) {
      return <CheckCircle className="w-4 h-4 text-green-400" />
    }
    
    return <Clock className="w-4 h-4 text-text-tertiary" />
  }

  const getStatusText = (task: MonitorTask) => {
    const status = getTaskStatus(task.id)

    if (!task.enabled) return t('monitor.task.disabled')
    if (status?.isRunning) return t('monitor.task.running')
    if (task.status === 'error') return t('monitor.task.error')
    if (task.statistics.totalExecutions === 0) return t('monitor.task.waiting')
    return t('monitor.task.idle')
  }

  const formatNextRun = (nextRun?: string) => {
    if (!nextRun) return '-'
    const date = new Date(nextRun)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    
    if (diff < 0) return t('monitor.expired')
    if (diff < 60000) return t('monitor.aboutToExecute')
    if (diff < 3600000) return t('monitor.minutesLater', { minutes: Math.floor(diff / 60000) })
    if (diff < 86400000) return t('monitor.hoursLater', { hours: Math.floor(diff / 3600000) })
    return t('monitor.daysLater', { days: Math.floor(diff / 86400000) })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Activity className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-400" />
          <p className="text-text-tertiary">{t('monitor.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* 头部 */}
      <div className="flex-shrink-0 px-6 border-b border-gray-200 dark:border-gray-800" style={{ paddingTop: '14px', paddingBottom: '14px' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{t('monitor.title')}</h1>
            <p className="text-text-tertiary mt-1">{t('monitor.description')}</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
{t('monitor.createTask')}
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="flex-shrink-0 p-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-bg-secondary rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-text-tertiary">{t('monitor.stats.totalTasks')}</p>
                <p className="text-xl font-semibold text-text-primary">{tasks.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-bg-secondary rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-text-tertiary">{t('monitor.stats.runningTasks')}</p>
                <p className="text-xl font-semibold text-text-primary">
                  {taskStatuses.filter(s => s.isRunning).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-bg-secondary rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-600/20 rounded-lg flex items-center justify-center">
                <Pause className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-text-tertiary">{t('monitor.task.disabled')}</p>
                <p className="text-xl font-semibold text-text-primary">
                  {tasks.filter(t => !t.enabled).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-bg-secondary rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-text-tertiary">{t('monitor.stats.errorTasks')}</p>
                <p className="text-xl font-semibold text-text-primary">
                  {tasks.filter(t => t.status === 'error').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 min-h-0 p-6">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-tertiary" style={{ marginTop: '-65px' }}>
            <div className="text-center">
              <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">{t('monitor.noTasks')}</h3>
              <p>{t('monitor.createFirst')}</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {tasks.map(task => {
              const status = getTaskStatus(task.id)
              return (
                <div
                  key={task.id}
                  className="bg-bg-secondary rounded-lg p-6 hover:bg-bg-tertiary transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(task)}
                        <h3 className="text-lg font-medium text-text-primary">{task.name}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          task.type === 'file_watch' 
                            ? 'bg-blue-600/20 text-blue-400' 
                            : 'bg-purple-600/20 text-purple-400'
                        }`}>
                          {task.type === 'file_watch' ? t('monitor.fileWatch') : t('monitor.scheduledTask')}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          task.enabled 
                            ? 'bg-green-600/20 text-green-400' 
                            : 'bg-bg-quaternary/20 text-text-tertiary'
                        }`}>
                          {getStatusText(task)}
                        </span>
                      </div>
                      
                      <p className="text-text-tertiary mb-3">{task.description}</p>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-text-tertiary">{t('monitor.associatedRule')}</span>
                          <span className="text-text-secondary ml-1">{getWorkflowName(task.workflowId)}</span>
                        </div>
                        <div>
                          <span className="text-text-tertiary">{t('monitor.executionCount')}</span>
                          <span className="text-text-secondary ml-1">{task.statistics.totalExecutions}</span>
                        </div>
                        {task.type === 'scheduled' && (
                          <div>
                            <span className="text-text-tertiary">{t('monitor.nextExecution')}</span>
                            <span className="text-text-secondary ml-1">{formatNextRun(task.nextExecution)}</span>
                          </div>
                        )}
                        {task.lastExecuted && (
                          <div>
                            <span className="text-text-tertiary">{t('monitor.lastExecution')}</span>
                            <span className="text-text-secondary ml-1">
                              {new Date(task.lastExecuted).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleExecuteTask(task.id)}
                        disabled={!task.enabled || status?.isRunning}
                        className="p-2 text-text-tertiary hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('monitor.execute')}
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => handleToggleTask(task)}
                        className={`p-2 rounded-lg transition-colors ${
                          task.enabled
                            ? 'text-yellow-400 hover:bg-yellow-600/10'
                            : 'text-green-400 hover:bg-green-600/10'
                        }`}
                        title={task.enabled ? t('monitor.disable') : t('monitor.enable')}
                      >
                        {task.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      
                      <button
                        onClick={() => handleViewDetails(task)}
                        className="p-2 text-text-tertiary hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors"
                        title={t('monitor.details')}
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleEditTask(task)}
                        className="p-2 text-text-tertiary hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-colors"
                        title={t('monitor.edit')}
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 text-text-tertiary hover:text-red-400 hover:bg-red-600/10 rounded-lg transition-colors"
                        title={t('monitor.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 创建任务模态框 */}
      <CreateMonitorTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateTask}
      />

      {/* 任务详情模态框 */}
      <MonitorTaskDetailModal
        task={selectedTask}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedTask(null)
        }}
        onEdit={handleEditTask}
        onExecute={handleExecuteTask}
        onToggle={handleToggleTask}
      />

      {/* 编辑任务模态框 */}
      <EditMonitorTaskModal
        task={editingTask}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingTask(null)
        }}
        onSubmit={handleUpdateTask}
      />

      {/* 确认对话框 */}
      <ConfirmDialog />
    </div>
  )
}
