import { useState, useEffect } from "react"
import { X, FolderOpen, Clock, Calendar, Settings, ChevronDown } from "lucide-react"
import { MonitorTask, Workflow, FileWatchConfig, ScheduledConfig } from "@shared/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useConfirmDialog } from "./ui/confirm-dialog"
import { useLanguage } from "../contexts/language-context"
import { MonitorTaskFileWatchSection } from "./monitor-task-file-watch-section"
import {
  MonitorTaskFormData,
  createDefaultFileWatchConfig,
  createDefaultScheduledConfig,
  createInitialFormData,
} from "./monitor-task-config-utils"

interface CreateMonitorTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (taskData: Omit<MonitorTask, 'id' | 'createdAt' | 'updatedAt' | 'statistics'>) => void
}

export function CreateMonitorTaskModal({ isOpen, onClose, onSubmit }: CreateMonitorTaskModalProps) {
  const { t, language } = useLanguage()
  const { showConfirm, ConfirmDialog } = useConfirmDialog()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [formData, setFormData] = useState<MonitorTaskFormData>(() => createInitialFormData())

  // 文件监控配置
  const [fileWatchConfig, setFileWatchConfig] = useState<FileWatchConfig>(() => createDefaultFileWatchConfig())

  // 定时任务配置
  const [scheduledConfig, setScheduledConfig] = useState<ScheduledConfig>(() => createDefaultScheduledConfig())

  // 用户友好的时间选择
  const [scheduleType, setScheduleType] = useState<'daily' | 'hourly' | 'weekly' | 'custom'>('daily')
  const [scheduleTime, setScheduleTime] = useState('00:00')
  const [scheduleWeekday, setScheduleWeekday] = useState('1') // 1=周一
  const [scheduleInterval, setScheduleInterval] = useState('1') // 每N小时

  // 高级设置折叠状态
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  // 将用户友好的选择转换为Cron表达式
  const generateCronExpression = () => {
    const [hour, minute] = scheduleTime.split(':').map(Number)

    switch (scheduleType) {
      case 'daily':
        return `${minute} ${hour} * * *` // 每天指定时间
      case 'hourly':
        return `0 */${scheduleInterval} * * *` // 每N小时（在每小时的第0分钟执行）
      case 'weekly':
        return `${minute} ${hour} * * ${scheduleWeekday}` // 每周指定时间
      case 'custom':
        return scheduledConfig.cronExpression // 使用自定义表达式
      default:
        return '0 0 * * *' // 默认每天午夜
    }
  }

  // 更新Cron表达式
  const updateCronExpression = () => {
    const newCron = generateCronExpression()
    setScheduledConfig(prev => ({ ...prev, cronExpression: newCron }))
  }

  // 当时间选择改变时更新Cron表达式
  useEffect(() => {
    updateCronExpression()
  }, [scheduleType, scheduleTime, scheduleWeekday, scheduleInterval])

  useEffect(() => {
    if (isOpen) {
      loadWorkflows()
    }
  }, [isOpen])

  // 监听语言变化，重新加载工作流以更新默认工作流的名称和描述
  useEffect(() => {
    if (isOpen) {
      loadWorkflows()
    }
  }, [language, isOpen])

  // 监听工作流更新事件
  useEffect(() => {
    if (!isOpen) return

    const handleWorkflowsUpdated = (data: { workflow: Workflow; isNew: boolean }) => {
      console.log('创建监控任务模态框收到工作流更新事件:', data.workflow.name, '是否新建:', data.isNew)

      // 重新加载工作流列表
      loadWorkflows()
    }

    const handleWorkflowsDeleted = (data: { workflowId: string }) => {
      console.log('创建监控任务模态框收到工作流删除事件:', data.workflowId)

      // 如果删除的是当前选中的工作流，清除选择
      if (formData.workflowId === data.workflowId) {
        setFormData(prev => ({ ...prev, workflowId: '' }))
      }

      // 重新加载工作流列表
      loadWorkflows()
    }

    // 添加事件监听器
    if (window.electronAPI.onWorkflowsUpdated) {
      window.electronAPI.onWorkflowsUpdated(handleWorkflowsUpdated)
    }
    if (window.electronAPI.onWorkflowsDeleted) {
      window.electronAPI.onWorkflowsDeleted(handleWorkflowsDeleted)
    }

    return () => {
      // 清理事件监听器（如果有提供清理方法的话）
    }
  }, [isOpen, formData.workflowId])

  const loadWorkflows = async () => {
    try {
      const workflowsData = await window.electronAPI.getAllWorkflows()
      setWorkflows(workflowsData.filter(w => w.enabled))
    } catch (error) {
      console.error('Failed to load workflows:', error)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.workflowId) {
      showConfirm({
        title: t('common.validationError'),
        description: t('monitor.create.fillRequired'),
        variant: 'warning',
        confirmText: t('common.confirm'),
        onConfirm: () => {}
      })
      return
    }

    // 验证配置
    if (formData.type === 'file_watch') {
      if (fileWatchConfig.watchPaths.some(path => !path.trim())) {
        showConfirm({
          title: t('common.validationError'),
          description: t('monitor.create.fillWatchPath'),
          variant: 'warning',
          confirmText: t('common.confirm'),
          onConfirm: () => {}
        })
        return
      }
    } else {
      const inputPaths = scheduledConfig.inputPaths || [scheduledConfig.inputPath]
      if (inputPaths.some(path => !path.trim())) {
        showConfirm({
          title: t('common.validationError'),
          description: t('monitor.create.fillInputPath'),
          variant: 'warning',
          confirmText: t('common.confirm'),
          onConfirm: () => {}
        })
        return
      }
      // 自动生成Cron表达式，无需验证
      const finalCron = scheduleType === 'custom' ? scheduledConfig.cronExpression : generateCronExpression()
      if (!finalCron.trim()) {
        showConfirm({
          title: t('common.validationError'),
          description: t('monitor.create.fillCronExpression'),
          variant: 'warning',
          confirmText: t('common.confirm'),
          onConfirm: () => {}
        })
        return
      }
    }

    // 准备配置数据
    let config = formData.type === 'file_watch' ? fileWatchConfig : scheduledConfig

    // 如果是定时任务，确保使用最新生成的Cron表达式
    if (formData.type === 'scheduled') {
      const finalCron = scheduleType === 'custom' ? scheduledConfig.cronExpression : generateCronExpression()
      config = { ...scheduledConfig, cronExpression: finalCron }
    }

    const taskData: Omit<MonitorTask, 'id' | 'createdAt' | 'updatedAt' | 'statistics'> = {
      ...formData,
      status: 'idle',
      config
    }

    onSubmit(taskData)
    handleClose()
  }

  const handleClose = () => {
    // 重置表单
    setFormData(createInitialFormData())
    setFileWatchConfig(createDefaultFileWatchConfig())
    setScheduledConfig(createDefaultScheduledConfig())
    // 重置时间选择状态
    setScheduleType('daily')
    setScheduleTime('00:00')
    setScheduleWeekday('1')
    setScheduleInterval('1')
    onClose()
  }

  const selectDirectory = async (index?: number) => {
    try {
      const directory = await window.electronAPI.openDirectory()
      if (directory) {
        if (formData.type === 'file_watch' && index !== undefined) {
          const newPaths = [...fileWatchConfig.watchPaths]
          newPaths[index] = directory
          setFileWatchConfig(prev => ({ ...prev, watchPaths: newPaths }))
        } else if (formData.type === 'scheduled') {
          if (index !== undefined) {
            const newPaths = [...(scheduledConfig.inputPaths || [scheduledConfig.inputPath])]
            newPaths[index] = directory
            setScheduledConfig(prev => ({
              ...prev,
              inputPath: newPaths[0] || '', // 保持向后兼容
              inputPaths: newPaths
            }))
          }
        }
      }
    } catch (error) {
      console.error('Failed to select directory:', error)
    }
  }

  const addInputPath = () => {
    const currentPaths = scheduledConfig.inputPaths || [scheduledConfig.inputPath]
    const newPaths = [...currentPaths, '']
    setScheduledConfig(prev => ({
      ...prev,
      inputPath: newPaths[0] || '', // 保持向后兼容
      inputPaths: newPaths
    }))
  }

  const removeInputPath = (index: number) => {
    const currentPaths = scheduledConfig.inputPaths || [scheduledConfig.inputPath]
    if (currentPaths.length > 1) {
      const newPaths = currentPaths.filter((_, i) => i !== index)
      setScheduledConfig(prev => ({
        ...prev,
        inputPath: newPaths[0] || '', // 保持向后兼容
        inputPaths: newPaths
      }))
    }
  }

  // ESC键关闭功能
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
    >
      {/* 背景遮罩 - 虚化效果 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* 悬浮编辑器 */}
      <Card className="relative bg-bg-secondary border-border-primary w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 mx-4">
        <CardHeader className="flex-shrink-0 px-6 py-4 border-b border-border-primary">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-text-primary">{t('monitor.create.title')}</CardTitle>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                form="create-task-form"
                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white rounded-lg transition-colors"
              >
                {t('monitor.create.createTask')}
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          <form id="create-task-form" onSubmit={handleSubmit} className="space-y-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-text-primary">{t('monitor.create.basicInfo')}</h3>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t('monitor.create.taskName')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('monitor.create.taskNamePlaceholder')}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t('monitor.create.taskDescription')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('monitor.create.taskDescriptionPlaceholder')}
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t('monitor.create.taskType')} *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="file_watch"
                    checked={formData.type === 'file_watch'}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'file_watch' }))}
                    className="mr-2"
                  />
                  <FolderOpen className="w-4 h-4 mr-1" />
                  {t('monitor.create.fileWatch')}
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="scheduled"
                    checked={formData.type === 'scheduled'}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'scheduled' }))}
                    className="mr-2"
                  />
                  <Calendar className="w-4 h-4 mr-1" />
                  {t('monitor.create.scheduled')}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {t('monitor.create.associatedRule')} *
              </label>
              <Select
                value={formData.workflowId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, workflowId: value }))}
                required
              >
                <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
                  <SelectValue placeholder={t('monitor.create.selectRule')} />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-secondary">
                  {workflows.map(workflow => (
                    <SelectItem key={workflow.id} value={workflow.id} className="text-text-secondary">
                      {workflow.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 配置信息 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-text-primary">
              {formData.type === 'file_watch' ? t('monitor.create.fileWatchConfig') : t('monitor.create.scheduledConfig')}
            </h3>

            {formData.type === 'file_watch' ? (
              <MonitorTaskFileWatchSection
                t={t}
                config={fileWatchConfig}
                setConfig={setFileWatchConfig}
                showAdvancedSettings={showAdvancedSettings}
                setShowAdvancedSettings={setShowAdvancedSettings}
                onSelectDirectory={(index) => selectDirectory(index)}
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {t('monitor.create.inputPath')} *
                  </label>
                  {(scheduledConfig.inputPaths || [scheduledConfig.inputPath]).map((path, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={path}
                        onChange={(e) => {
                          const currentPaths = scheduledConfig.inputPaths || [scheduledConfig.inputPath]
                          const newPaths = [...currentPaths]
                          newPaths[index] = e.target.value
                          setScheduledConfig(prev => ({
                            ...prev,
                            inputPath: newPaths[0] || '', // 保持向后兼容
                            inputPaths: newPaths
                          }))
                        }}
                        className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('monitor.create.inputPathPlaceholder')}
                      />
                      <button
                        type="button"
                        onClick={() => selectDirectory(index)}
                        className="px-3 py-2 bg-bg-quaternary hover:bg-bg-tertiary text-text-primary rounded-lg transition-colors"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>
                      {(scheduledConfig.inputPaths || [scheduledConfig.inputPath]).length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInputPath(index)}
                          className="px-3 py-2 bg-red-600 hover:bg-red-500 text-text-primary rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addInputPath}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    {t('monitor.create.addWatchPath')}
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {t('monitor.create.scheduleTime')} *
                  </label>

                  {/* 执行频率选择 */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="scheduleType"
                          value="daily"
                          checked={scheduleType === 'daily'}
                          onChange={(e) => setScheduleType(e.target.value as any)}
                          className="mr-2"
                        />
                        {t('monitor.create.daily')}
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="scheduleType"
                          value="hourly"
                          checked={scheduleType === 'hourly'}
                          onChange={(e) => setScheduleType(e.target.value as any)}
                          className="mr-2"
                        />
                        {t('monitor.create.hourly')}
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="scheduleType"
                          value="weekly"
                          checked={scheduleType === 'weekly'}
                          onChange={(e) => setScheduleType(e.target.value as any)}
                          className="mr-2"
                        />
                        {t('monitor.create.weekly')}
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="scheduleType"
                          value="custom"
                          checked={scheduleType === 'custom'}
                          onChange={(e) => setScheduleType(e.target.value as any)}
                          className="mr-2"
                        />
                        {t('monitor.create.custom')}
                      </label>
                    </div>

                    {/* 具体时间设置 */}
                    {scheduleType === 'daily' && (
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">
                          {t('monitor.create.executeTime')}
                        </label>
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {scheduleType === 'hourly' && (
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">
                          {t('monitor.create.everyNHours')}
                        </label>
                        <Select
                          value={scheduleInterval}
                          onValueChange={setScheduleInterval}
                        >
                          <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-bg-tertiary border-border-secondary">
                            <SelectItem value="1" className="text-text-secondary">1 {t('monitor.create.hour')}</SelectItem>
                            <SelectItem value="2" className="text-text-secondary">2 {t('monitor.create.hours')}</SelectItem>
                            <SelectItem value="3" className="text-text-secondary">3 {t('monitor.create.hours')}</SelectItem>
                            <SelectItem value="6" className="text-text-secondary">6 {t('monitor.create.hours')}</SelectItem>
                            <SelectItem value="12" className="text-text-secondary">12 {t('monitor.create.hours')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {scheduleType === 'weekly' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-text-tertiary mb-1">
                            {t('monitor.create.weekday')}
                          </label>
                          <Select
                            value={scheduleWeekday}
                            onValueChange={setScheduleWeekday}
                          >
                            <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-bg-tertiary border-border-secondary">
                              <SelectItem value="1" className="text-text-secondary">{t('monitor.create.monday')}</SelectItem>
                              <SelectItem value="2" className="text-text-secondary">{t('monitor.create.tuesday')}</SelectItem>
                              <SelectItem value="3" className="text-text-secondary">{t('monitor.create.wednesday')}</SelectItem>
                              <SelectItem value="4" className="text-text-secondary">{t('monitor.create.thursday')}</SelectItem>
                              <SelectItem value="5" className="text-text-secondary">{t('monitor.create.friday')}</SelectItem>
                              <SelectItem value="6" className="text-text-secondary">{t('monitor.create.saturday')}</SelectItem>
                              <SelectItem value="0" className="text-text-secondary">{t('monitor.create.sunday')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs text-text-tertiary mb-1">
                            {t('monitor.create.executeTime')}
                          </label>
                          <input
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}

                    {scheduleType === 'custom' && (
                      <div>
                        <label className="block text-xs text-text-tertiary mb-1">
                          {t('monitor.create.cronExpression')}
                        </label>
                        <input
                          type="text"
                          value={scheduledConfig.cronExpression}
                          onChange={(e) => setScheduledConfig(prev => ({ ...prev, cronExpression: e.target.value }))}
                          className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={t('monitor.create.cronPlaceholder')}
                        />
                        <p className="text-xs text-text-tertiary mt-1">
                          {t('monitor.create.cronFormat')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 定时任务高级设置 */}
                <div className="border border-border-secondary rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className={`flex items-center justify-between w-full p-3 bg-bg-tertiary hover:bg-bg-quaternary transition-colors ${
                      showAdvancedSettings ? 'border-b border-border-secondary' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Settings className="w-4 h-4 text-text-secondary" />
                      <span className="text-sm font-medium text-text-secondary">{t('monitor.create.advancedSettings')}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
                  </button>

                  {showAdvancedSettings && (
                    <div className="space-y-4 p-4 bg-bg-quaternary/30">
                      {/* 忽略模式配置 */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          {t('monitor.create.ignorePatterns')}
                        </label>

                        <div className="space-y-2">
                          {(scheduledConfig.ignorePatterns || []).map((pattern, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                value={pattern}
                                onChange={(e) => {
                                  const newPatterns = [...(scheduledConfig.ignorePatterns || [])]
                                  newPatterns[index] = e.target.value
                                  setScheduledConfig(prev => ({ ...prev, ignorePatterns: newPatterns }))
                                }}
                                className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={t('monitor.create.ignorePatternPlaceholder')}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newPatterns = (scheduledConfig.ignorePatterns || []).filter((_, i) => i !== index)
                                  setScheduledConfig(prev => ({ ...prev, ignorePatterns: newPatterns }))
                                }}
                                className="px-3 py-2 bg-red-600 hover:bg-red-500 text-text-primary rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const newPatterns = [...(scheduledConfig.ignorePatterns || []), '']
                              setScheduledConfig(prev => ({ ...prev, ignorePatterns: newPatterns }))
                            }}
                            className="text-sm text-blue-400 hover:text-blue-300"
                          >
                            {t('monitor.create.addIgnorePattern')}
                          </button>
                        </div>

                        {/* 详细的忽略模式提示 */}
                        <div className="bg-bg-quaternary border border-border-secondary rounded-lg p-3 mt-3">
                          <p className="text-xs text-text-secondary mb-3">
                            💡 {t('monitor.create.ignorePatternsDesc')}
                          </p>

                          <div className="grid grid-cols-2 gap-4">
                            {/* 左侧：使用场景 */}
                            <div>
                              <p className="text-xs text-text-secondary mb-2">
                                📋 <strong>{t('monitor.create.scenarioTitle')}</strong>
                              </p>
                              <div className="space-y-2 text-xs text-text-tertiary">
                                <div>
                                  <div className="text-text-secondary font-medium">{t('monitor.create.scenario.specificFile')}</div>
                                  <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{t('monitor.create.example.importantDoc')}</code> <code className="bg-bg-tertiary px-1 rounded text-text-secondary">desktop.ini</code></div>
                                </div>
                                <div>
                                  <div className="text-text-secondary font-medium">{t('monitor.create.scenario.specificFolder')}</div>
                                  <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{t('monitor.create.example.importantFiles')}</code> <code className="bg-bg-tertiary px-1 rounded text-text-secondary">{t('monitor.create.example.privateFiles')}</code></div>
                                </div>
                                <div>
                                  <div className="text-text-secondary font-medium">{t('monitor.create.scenario.fileTypes')}</div>
                                  <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">*.psd</code> <code className="bg-bg-tertiary px-1 rounded text-text-secondary">*.{'{exe,msi}'}</code></div>
                                </div>
                                <div>
                                  <div className="text-text-secondary font-medium">{t('monitor.create.scenario.nameContains')}</div>
                                  <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{t('monitor.create.example.backup')}</code> <code className="bg-bg-tertiary px-1 rounded text-text-secondary">*~*</code></div>
                                </div>
                              </div>
                            </div>

                            {/* 右侧：通配符规则 */}
                            <div>
                              <p className="text-xs text-text-secondary mb-2">
                                🔧 <strong>{t('monitor.create.wildcardRulesTitle')}</strong>
                              </p>
                              <div className="space-y-1 text-xs text-text-tertiary">
                                <div>{t('monitor.create.wildcard.star')}</div>
                                <div>{t('monitor.create.wildcard.question')}</div>
                                <div>{t('monitor.create.wildcard.brackets')}</div>
                                <div>{t('monitor.create.wildcard.range')}</div>
                                <div>{t('monitor.create.wildcard.negation')}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 监控事件配置 */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          {t('monitor.create.watchEvents')}
                        </label>
                        <div className="text-xs text-text-tertiary mb-3 p-2 bg-blue-900/20 rounded-lg border border-blue-500/30">
                          💡 {t('monitor.create.watchEventsDesc')}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'add', label: t('monitor.create.eventAdd') },
                            { value: 'change', label: t('monitor.create.eventChange') },
                            { value: 'unlink', label: t('monitor.create.eventDelete') },
                            { value: 'addDir', label: t('monitor.create.eventAddDir') },
                            { value: 'unlinkDir', label: t('monitor.create.eventDeleteDir') }
                          ].map(event => (
                            <label key={event.value} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={scheduledConfig.events?.includes(event.value as any) || false}
                                onChange={(e) => {
                                  const newEvents = e.target.checked
                                    ? [...(scheduledConfig.events || []), event.value as any]
                                    : (scheduledConfig.events || []).filter(ev => ev !== event.value)
                                  setScheduledConfig(prev => ({ ...prev, events: newEvents }))
                                }}
                                className="mr-2"
                              />
                              <span className="text-sm text-text-secondary">{event.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* 处理间隔 */}
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          {t('monitor.create.debounceDelay')} (ms)
                        </label>
                        <input
                          type="number"
                          value={scheduledConfig.debounceMs}
                          onChange={(e) => setScheduledConfig(prev => ({ ...prev, debounceMs: parseInt(e.target.value) || 1000 }))}
                          className="w-full px-3 py-2 bg-bg-tertiary border border-border-secondary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="100"
                          placeholder="1000"
                        />
                        <p className="text-xs text-text-tertiary mt-1">{t('monitor.create.debounceDelay.desc')}</p>
                      </div>

                      {/* 运行时跳过选项 */}
                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={scheduledConfig.skipIfRunning}
                            onChange={(e) => setScheduledConfig(prev => ({ ...prev, skipIfRunning: e.target.checked }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-text-secondary">{t('monitor.create.skipIfRunning')}</span>
                        </label>
                        <div className="text-xs text-text-tertiary mt-1 ml-6">
                          {t('monitor.create.skipIfRunningDesc')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
          </form>
        </CardContent>
      </Card>
      <ConfirmDialog />
    </div>
  )
}

