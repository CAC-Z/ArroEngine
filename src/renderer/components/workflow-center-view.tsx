import { useState, useEffect } from "react"
import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import { Plus, Play, Settings, Trash2, Edit3, RotateCcw, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FloatingStepEditor } from "./floating-step-editor"

import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Workflow, ProcessStep } from '@shared/types'
import { useLanguage } from '../contexts/language-context'

// 可拖拽的规则卡片组件
interface DraggableRuleCardProps {
  rule: Workflow
  displayOrder?: number
  isSelected: boolean
  onSelect: () => void
  onToggleEnabled: (enabled: boolean) => void
  onDelete: () => void
  onDoubleClickEdit: (field: 'name' | 'description', value: string) => void
  editingRuleId: string | null
  editingField: 'name' | 'description' | null
  editingValue: string
  onEditValueChange: (value: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onKeyDown: (e: ReactKeyboardEvent) => void
}

function DraggableRuleCard({
  rule,
  displayOrder,
  isSelected,
  onSelect,
  onToggleEnabled,
  onDelete,
  onDoubleClickEdit,
  editingRuleId,
  editingField,
  editingValue,
  onEditValueChange,
  onSaveEdit,
  onCancelEdit,
  onKeyDown
}: DraggableRuleCardProps) {
  const { t } = useLanguage()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition, // 拖拽时禁用过渡动画
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer transition-all duration-200 shadow-lg backdrop-blur-sm ${
        isSelected
          ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-500'
          : 'bg-bg-secondary border-border-primary hover:bg-bg-tertiary'
      } ${
        !rule.enabled
          ? 'opacity-60 saturate-50'
          : ''
      } ${
        isDragging ? 'opacity-50 z-50' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            {/* 拖拽手柄 */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-bg-quaternary/30 rounded flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4 text-text-tertiary" />
            </div>
            <span className="text-xs text-text-tertiary bg-bg-quaternary px-2 py-1 rounded flex-shrink-0">
              #{displayOrder ?? rule.order}
            </span>
            {editingRuleId === rule.id && editingField === 'name' ? (
              <div className="min-w-0 flex-1">
                <Input
                  value={editingValue}
                  onChange={(e) => onEditValueChange(e.target.value)}
                  onBlur={onSaveEdit}
                  onKeyDown={onKeyDown}
                  className="text-sm h-6 px-2 bg-bg-tertiary border-border-secondary text-text-primary w-full"
                  autoFocus
                  maxLength={60}
                  placeholder={t('rule.center.nameMaxLength', { max: 60 })}
                />
                <div className="text-xs text-text-tertiary mt-1">
                  {editingValue.length}/60
                </div>
              </div>
            ) : (
              <CardTitle
                className={`text-sm truncate cursor-pointer hover:bg-bg-quaternary/30 px-1 py-0.5 rounded min-w-0 flex-1 ${
                  rule.enabled ? 'text-text-secondary' : 'text-text-tertiary'
                }`}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  onDoubleClickEdit('name', rule.name)
                }}
                title={rule.name}
              >
                {rule.name}
              </CardTitle>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-text-tertiary hover:text-red-400 p-1"
            title={t('rule.center.deleteRuleTooltip')}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {editingRuleId === rule.id && editingField === 'description' ? (
          <div className="mb-3">
            <Input
              value={editingValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              onBlur={onSaveEdit}
              onKeyDown={onKeyDown}
              className="text-xs h-6 px-2 bg-bg-tertiary border-border-secondary text-text-tertiary w-full"
              autoFocus
              maxLength={200}
              placeholder={t('rule.center.descMaxLength', { max: 200 })}
            />
            <div className="text-xs text-text-tertiary mt-1">
              {editingValue.length}/200
            </div>
          </div>
        ) : (
          <p
            className={`text-xs mb-3 cursor-pointer hover:bg-bg-quaternary/30 px-1 py-0.5 rounded ${
              rule.enabled ? 'text-text-tertiary' : 'text-text-tertiary'
            }`}
            onDoubleClick={(e) => {
              e.stopPropagation()
              onDoubleClickEdit('description', rule.description)
            }}
            title={t('rule.center.doubleClickEditDesc')}
          >
            {rule.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary">
            {t('rule.center.stepsCount', { count: rule.steps.length })}
          </span>
          <div className="flex flex-col items-center">
            <Switch
              checked={rule.enabled}
              onCheckedChange={onToggleEnabled}
              onClick={(e) => e.stopPropagation()}
              className="scale-75 data-[state=checked]:bg-green-500 dark:data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-bg-quaternary"
            />
            <span className="text-xs text-text-tertiary mt-1">
              {rule.enabled ? t('rule.center.enabled') : t('rule.center.disabled')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 可拖拽的步骤卡片组件
interface DraggableStepCardProps {
  step: ProcessStep
  workflow: Workflow
  displayOrder?: number
  onToggleEnabled: (stepId: string, enabled: boolean) => void
  onEdit: (stepId: string) => void
  onDelete: (stepId: string) => void
}

function DraggableStepCard({ step, workflow, displayOrder, onToggleEnabled, onEdit, onDelete }: DraggableStepCardProps) {
  const { t } = useLanguage()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition, // 拖拽时禁用过渡动画
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`bg-bg-secondary border-border-secondary transition-all duration-200 shadow-lg backdrop-blur-sm ${
        !step.enabled ? 'opacity-60 saturate-50' : ''
      } ${
        isDragging ? 'opacity-50 z-50' : ''
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* 拖拽手柄 */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-bg-quaternary/30 rounded"
            >
              <GripVertical className="w-4 h-4 text-text-tertiary" />
            </div>
            <span className="text-xs text-text-tertiary bg-bg-quaternary px-2 py-1 rounded">
              #{displayOrder ?? step.order}
            </span>
            <CardTitle className={`text-sm ${
              step.enabled ? 'text-text-secondary' : 'text-text-tertiary'
            }`}>
              {step.name}
            </CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            {/* 启用/禁用按钮 */}
            <Button
              size="sm"
              variant="outline"
              className={`text-xs px-2 py-1 ${
                step.enabled
                  ? 'bg-green-100 border-green-300 hover:bg-green-200 text-green-800 dark:bg-green-700 dark:border-green-600 dark:hover:bg-green-600 dark:text-green-200'
                  : 'bg-bg-tertiary border-border-secondary hover:bg-bg-quaternary text-text-secondary'
              }`}
              onClick={() => onToggleEnabled(step.id, !step.enabled)}
            >
              {step.enabled ? t('rule.center.enabled') : t('rule.center.disabled')}
            </Button>

            {/* 编辑按钮 */}
            <Button
              size="sm"
              variant="outline"
              className="bg-blue-100 border-blue-300 hover:bg-blue-200 text-blue-800 dark:bg-blue-700 dark:border-blue-600 dark:hover:bg-blue-600 dark:text-blue-200 text-xs px-2 py-1"
              onClick={() => onEdit(step.id)}
            >
              <Edit3 className="w-3 h-3 mr-1" />
              {t('rule.center.edit')}
            </Button>

            {/* 删除按钮 */}
            <Button
              size="sm"
              variant="outline"
              className="bg-red-100 border-red-300 hover:bg-red-200 text-red-800 dark:bg-red-700 dark:border-red-600 dark:hover:bg-red-600 dark:text-red-200 text-xs px-2 py-1"
              onClick={() => onDelete(step.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        {/* 紧凑的信息布局 */}
        <div className="space-y-2">
          {/* 步骤描述 - 如果有的话 */}
          {step.description && step.description !== step.name && (
            <div className="text-xs text-text-secondary opacity-80">
              {step.description}
            </div>
          )}

          {/* 处理对象 */}
          <div className="text-xs text-text-tertiary">
            <span className="font-medium text-text-secondary">{t('rule.center.processTarget')}：</span>
            {step.processTarget === 'files' && (
              <span className="text-blue-400">📄 {t('rule.center.processTarget.files')}</span>
            )}
            {step.processTarget === 'folders' && (
              <span className="text-yellow-400">📁 {t('rule.center.processTarget.folders')}</span>
            )}
            {!step.processTarget && (
              <span className="text-red-400">⚠️ {t('rule.center.notConfigured')}</span>
            )}
          </div>

          {/* 输入源 */}
          <div className="text-xs text-text-tertiary">
            <span className="font-medium text-text-secondary">{t('rule.center.inputSource')}：</span>
            {step.inputSource.type === 'original' && t('rule.center.inputSource.original')}
            {step.inputSource.type === 'previous_step' && (
              <span>
                {step.inputSource.stepId ? (
                  <span>
                    {t('rule.center.inputSource.previousStep')} - {
                      workflow.steps.find(s => s.id === step.inputSource.stepId)?.name || '未知步骤'
                    }
                  </span>
                ) : (
                  <span>{t('rule.center.inputSource.previousStep')}</span>
                )}
              </span>
            )}
            {step.inputSource.type === 'specific_path' && (
              <span>
                {step.inputSource.path ? (
                  <span title={step.inputSource.path}>
                    📁 {step.inputSource.path.split(/[/\\]/).pop()}
                  </span>
                ) : (
                  <span className="text-yellow-400">⚠️ {t('rule.center.notConfigured')}</span>
                )}
              </span>
            )}
          </div>

          {/* 条件详情 */}
          <div className="text-xs text-text-tertiary">
            <span className="font-medium text-text-secondary">{t('rule.center.conditions')}：</span>
            {step.conditions.conditions.length > 0 ? (
              <span>
                {step.conditions.conditions.slice(0, 2).map((condition, index) => (
                  <span key={index}>
                    {index > 0 && '，'}
                    {t(`condition.field.${condition.field}`)}
                    {t(`condition.operator.${condition.operator}`)}
                    "{condition.value}"
                  </span>
                ))}
                {step.conditions.conditions.length > 2 && (
                  <span className="opacity-60">
                    ，...{t('rule.center.andMore', { count: step.conditions.conditions.length - 2 })}
                  </span>
                )}
              </span>
            ) : (
              <span className="opacity-75">{t('rule.center.noConditions')}</span>
            )}
          </div>

          {/* 动作详情 */}
          <div className="text-xs text-text-tertiary">
            <span className="font-medium text-text-secondary">{t('rule.center.actions')}：</span>
            {step.actions.length > 0 ? (
              <span>
                {step.actions.slice(0, 2).map((action, index) => (
                  <span key={index}>
                    {index > 0 && '，'}
                    {action.type === 'move' && t('rule.center.actionType.move')}
                    {action.type === 'copy' && t('rule.center.actionType.copy')}
                    {action.type === 'rename' && t('rule.center.actionType.rename')}
                    {action.type === 'delete' && t('rule.center.actionType.delete')}
                    {action.config.targetPath && (
                      <span className="opacity-75">
                        → {action.config.targetPath.split(/[/\\]/).pop() || action.config.targetPath}
                      </span>
                    )}
                    {action.config.namingPattern && action.config.namingPattern !== 'original' && (
                      <span className="opacity-60">
                        ({t(`action.naming.${action.config.namingPattern}`) || action.config.namingPattern})
                      </span>
                    )}
                  </span>
                ))}
                {step.actions.length > 2 && (
                  <span className="opacity-60">
                    ，...{t('rule.center.andMore', { count: step.actions.length - 2 })}
                  </span>
                )}
              </span>
            ) : (
              <span className="opacity-75">{t('rule.center.noActions')}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function WorkflowCenterView() {
  const { t, language } = useLanguage()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [isLoading, setIsLoading] = useState(true)



  // 悬浮步骤编辑器状态
  const [isFloatingEditorOpen, setIsFloatingEditorOpen] = useState(false)
  const [floatingEditingWorkflow, setFloatingEditingWorkflow] = useState<Workflow | null>(null)
  const [floatingEditingStep, setFloatingEditingStep] = useState<ProcessStep | null>(null)



  // 双击编辑状态
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'name' | 'description' | null>(null)
  const [editingValue, setEditingValue] = useState('')

  // 字数限制常量
  const MAX_NAME_LENGTH = 60
  const MAX_DESCRIPTION_LENGTH = 200

  // 带字数限制的编辑值更新函数
  const handleEditValueChange = (value: string) => {
    if (editingField === 'name') {
      if (value.length <= MAX_NAME_LENGTH) {
        setEditingValue(value)
      }
    } else if (editingField === 'description') {
      if (value.length <= MAX_DESCRIPTION_LENGTH) {
        setEditingValue(value)
      }
    } else {
      setEditingValue(value)
    }
  }

  // 拖拽传感器设置 - 优化流畅性
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 减少激活距离，提高响应性
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 确认对话框
  const { showConfirm, ConfirmDialog } = useConfirmDialog()

  // 加载工作流（优化性能）
  const loadWorkflows = async () => {
    try {
      setIsLoading(true)
      console.log('开始加载工作流 - 工作流中心')

      const startTime = performance.now()
      const allWorkflows = await window.electronAPI.getAllWorkflows()
      const loadTime = performance.now() - startTime
      console.log(`工作流加载耗时: ${loadTime.toFixed(2)}ms`)

      setWorkflows(allWorkflows)
      console.log(`总工作流数量: ${allWorkflows.length}`)
    } catch (error) {
      console.error('Failed to load workflows:', error)
      setWorkflows([])
    } finally {
      setIsLoading(false)
    }
  }

  // 切换工作流启用状态
  const toggleWorkflowEnabled = async (workflowId: string, enabled: boolean) => {
    try {
      const workflow = workflows.find(w => w.id === workflowId)
      if (workflow) {
        const updatedWorkflow = {
          ...workflow,
          enabled,
          updatedAt: new Date().toISOString()
        }

        await window.electronAPI.saveWorkflow(updatedWorkflow)

        // 直接更新本地状态，避免重新加载整个列表
        setWorkflows(prev => prev.map(w => w.id === workflowId ? updatedWorkflow : w))

        // 如果当前选中的工作流被更新，也要更新选中状态
        if (selectedWorkflow?.id === workflowId) {
          setSelectedWorkflow(updatedWorkflow)
        }
      }
    } catch (error) {
      console.error('Failed to toggle workflow:', error)
    }
  }

  // 切换工作流自动清理空文件夹功能
  const toggleWorkflowCleanupEmptyFolders = async (workflowId: string, cleanupEmptyFolders: boolean) => {
    try {
      const workflow = workflows.find(w => w.id === workflowId)
      if (workflow) {
        const updatedWorkflow = {
          ...workflow,
          cleanupEmptyFolders,
          updatedAt: new Date().toISOString()
        }

        await window.electronAPI.saveWorkflow(updatedWorkflow)

        // 直接更新本地状态，避免重新加载整个列表
        setWorkflows(prev => prev.map(w => w.id === workflowId ? updatedWorkflow : w))

        // 如果当前选中的工作流被更新，也要更新选中状态
        if (selectedWorkflow?.id === workflowId) {
          setSelectedWorkflow(updatedWorkflow)
        }
      }
    } catch (error) {
      console.error('Failed to toggle cleanup empty folders:', error)
    }
  }



  // 创建新工作流
  const handleCreateWorkflow = async () => {
    try {
      // 生成唯一的规则名称，使用序号避免重复
      const baseRuleName = t('rule.center.newRule')
      let uniqueName = baseRuleName
      let counter = 1

      // 检查是否存在重复名称，如果存在则添加序号
      while (workflows.some(w => w.name === uniqueName)) {
        uniqueName = `${baseRuleName}${counter}`
        counter++
      }

      // 创建新工作流对象（用户创建的工作流使用 'user-' 前缀）
      const newWorkflow: Workflow = {
        id: `user-workflow-${Date.now()}`,
        name: uniqueName,
        description: t('rule.center.newRuleDesc'),
        enabled: true,
        order: workflows.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: [],
        cleanupEmptyFolders: true // 默认清理空文件夹
      }

      // 保存到后端
      await window.electronAPI.saveWorkflow(newWorkflow)

      // 更新本地状态
      setWorkflows(prev => [...prev, newWorkflow])

      // 自动选择新创建的工作流
      setSelectedWorkflow(newWorkflow)

      // 自动进入名称编辑状态
      setEditingRuleId(newWorkflow.id)
      setEditingField('name')
      setEditingValue(newWorkflow.name)

    } catch (error) {
      console.error(t('error.createWorkflowFailed'), error)
      showConfirm({
        title: t('rule.center.createFailed'),
        description: t('rule.center.createFailedDesc'),
        variant: 'destructive',
        confirmText: t('confirm.default.confirm'),
        onConfirm: () => {}
      })
    }
  }





  // 编辑步骤 - 使用悬浮编辑器
  const handleEditStep = (workflow: Workflow, stepId: string) => {
    const step = workflow.steps.find(s => s.id === stepId)
    if (step) {
      setFloatingEditingWorkflow(workflow)
      setFloatingEditingStep(step)
      setIsFloatingEditorOpen(true)
    }
  }



  // 保存悬浮编辑器的步骤
  const handleSaveFloatingStep = async (updatedWorkflow: Workflow) => {
    try {
      await window.electronAPI.saveWorkflow(updatedWorkflow)

      // 更新本地状态
      setWorkflows(prev => prev.map(w => w.id === updatedWorkflow.id ? updatedWorkflow : w))

      // 如果当前选中的工作流被更新，也要更新选中状态
      if (selectedWorkflow?.id === updatedWorkflow.id) {
        setSelectedWorkflow(updatedWorkflow)
      }

      // 关闭悬浮编辑器
      setIsFloatingEditorOpen(false)
      setFloatingEditingWorkflow(null)
      setFloatingEditingStep(null)
    } catch (error) {
      console.error(t('error.saveStepFailed'), error)
      showConfirm({
        title: t('rule.center.saveFailed'),
        description: t('rule.center.saveFailedDesc'),
        variant: 'destructive',
        confirmText: t('confirm.default.confirm'),
        onConfirm: () => {}
      })
    }
  }

  // 取消悬浮编辑器
  const handleCancelFloatingStep = () => {
    setIsFloatingEditorOpen(false)
    setFloatingEditingWorkflow(null)
    setFloatingEditingStep(null)
  }

  // 添加步骤
  const handleAddStep = async (workflow: Workflow) => {
    try {
      // 创建新步骤
      const newStep: ProcessStep = {
        id: `step-${Date.now()}`,
        name: t('rule.center.stepName', { number: workflow.steps.length + 1 }),
        description: t('rule.center.stepDesc'),
        enabled: true,
        order: workflow.steps.length + 1,
        inputSource: { type: 'original' },
      conditions: {
        operator: 'AND',
        conditions: [],
        groups: []
      },
      actions: [],
      processTarget: 'files'
      }

      // 更新工作流，添加新步骤
      const updatedWorkflow = {
        ...workflow,
        steps: [...workflow.steps, newStep],
        updatedAt: new Date().toISOString()
      }

      // 保存到后端
      await window.electronAPI.saveWorkflow(updatedWorkflow)

      // 直接更新本地状态，不刷新整个列表
      setWorkflows(prev => prev.map(w => w.id === workflow.id ? updatedWorkflow : w))
      setSelectedWorkflow(updatedWorkflow)

    } catch (error) {
      console.error(t('error.addStepFailed'), error)
    }
  }

  // 切换步骤启用状态
  const handleToggleStepEnabled = async (workflow: Workflow, stepId: string, enabled: boolean) => {
    try {
      const updatedWorkflow = {
        ...workflow,
        steps: workflow.steps.map(step =>
          step.id === stepId ? { ...step, enabled } : step
        ),
        updatedAt: new Date().toISOString()
      }

      await window.electronAPI.saveWorkflow(updatedWorkflow)
      setWorkflows(prev => prev.map(w => w.id === workflow.id ? updatedWorkflow : w))
      setSelectedWorkflow(updatedWorkflow)
    } catch (error) {
      console.error(t('error.toggleStepStatusFailed'), error)
    }
  }

  // 双击编辑处理函数
  const handleDoubleClickEdit = (ruleId: string, field: 'name' | 'description', currentValue: string) => {
    setEditingRuleId(ruleId)
    setEditingField(field)
    setEditingValue(currentValue)
  }

  // 保存双击编辑
  const handleSaveInlineEdit = async (clearEditState = true) => {
    if (!editingRuleId || !editingField) return

    try {
      const workflow = workflows.find(w => w.id === editingRuleId)
      if (!workflow) return

      const trimmedValue = editingValue.trim()
      if (!trimmedValue) {
        // 如果值为空，取消编辑
        handleCancelInlineEdit()
        return
      }

      const updatedWorkflow = {
        ...workflow,
        [editingField]: trimmedValue,
        updatedAt: new Date().toISOString()
      }

      await window.electronAPI.saveWorkflow(updatedWorkflow)
      setWorkflows(prev => prev.map(w => w.id === editingRuleId ? updatedWorkflow : w))

      if (selectedWorkflow?.id === editingRuleId) {
        setSelectedWorkflow(updatedWorkflow)
      }

      // 只有在明确要求时才清除编辑状态
      if (clearEditState) {
        setEditingRuleId(null)
        setEditingField(null)
        setEditingValue('')
      }

      return updatedWorkflow
    } catch (error) {
      console.error(t('error.saveWorkflowFailed'), error)
      throw error
    }
  }

  // 取消双击编辑
  const handleCancelInlineEdit = () => {
    setEditingRuleId(null)
    setEditingField(null)
    setEditingValue('')
  }

  // 处理键盘事件
  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveInlineEdit()
    } else if (e.key === 'Escape') {
      handleCancelInlineEdit()
    }
  }

  // 处理工作流拖拽结束
  const handleWorkflowDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = workflows.findIndex(w => w.id === active.id)
      const newIndex = workflows.findIndex(w => w.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newWorkflows = arrayMove(workflows, oldIndex, newIndex)

        // 更新order字段
        const updatedWorkflows = newWorkflows.map((workflow, index) => ({
          ...workflow,
          order: index + 1,
          updatedAt: new Date().toISOString()
        }))

        // 更新本地状态
        setWorkflows(updatedWorkflows)

        // 保存到后端
        try {
          for (const workflow of updatedWorkflows) {
            await window.electronAPI.saveWorkflow(workflow)
          }
        } catch (error) {
          console.error(t('error.saveWorkflowOrderFailed'), error)
          // 如果保存失败，恢复原来的顺序
          await loadWorkflows()
        }
      }
    }
  }

  // 处理步骤拖拽结束
  const handleStepDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id && selectedWorkflow) {
      const oldIndex = selectedWorkflow.steps.findIndex(s => s.id === active.id)
      const newIndex = selectedWorkflow.steps.findIndex(s => s.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newSteps = arrayMove(selectedWorkflow.steps, oldIndex, newIndex)

        // 更新order字段
        const updatedSteps = newSteps.map((step, index) => ({
          ...step,
          order: index + 1
        }))

        const updatedWorkflow = {
          ...selectedWorkflow,
          steps: updatedSteps,
          updatedAt: new Date().toISOString()
        }

        // 更新本地状态
        setSelectedWorkflow(updatedWorkflow)
        setWorkflows(prev => prev.map(w => w.id === selectedWorkflow.id ? updatedWorkflow : w))

        // 保存到后端
        try {
          await window.electronAPI.saveWorkflow(updatedWorkflow)
        } catch (error) {
          console.error(t('error.saveStepOrderFailed'), error)
          // 如果保存失败，恢复原来的顺序
          await loadWorkflows()
        }
      }
    }
  }

  // 删除步骤
  const handleDeleteStep = (workflow: Workflow, stepId: string) => {
    const step = workflow.steps.find(s => s.id === stepId)
    showConfirm({
      title: t('rule.center.deleteStep'),
      description: t('rule.center.deleteStepDesc', { name: step?.name || t('rule.center.unknownStep') }),
      variant: 'destructive',
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        try {
          const updatedWorkflow = {
            ...workflow,
            steps: workflow.steps.filter(step => step.id !== stepId),
            updatedAt: new Date().toISOString()
          }

          await window.electronAPI.saveWorkflow(updatedWorkflow)
          setWorkflows(prev => prev.map(w => w.id === workflow.id ? updatedWorkflow : w))
          setSelectedWorkflow(updatedWorkflow)
        } catch (error) {
          console.error(t('error.deleteStepFailed'), error)
        }
      }
    })
  }

  // 删除工作流
  const handleDeleteWorkflow = (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId)
    showConfirm({
      title: t('rule.center.deleteRule'),
      description: t('rule.center.deleteRuleDesc', { name: workflow?.name || t('rule.center.unknownRule') }),
      variant: 'destructive',
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        try {
          await window.electronAPI.deleteWorkflow(workflowId)
          await loadWorkflows()
          if (selectedWorkflow?.id === workflowId) {
            setSelectedWorkflow(null)
          }
        } catch (error) {
          console.error('Failed to delete workflow:', error)
        }
      }
    })
  }

  // 重置为默认工作流
  const handleResetToDefault = () => {
    showConfirm({
      title: t('rule.center.resetTitle'),
      description: t('rule.center.resetDesc'),
      variant: 'warning',
      confirmText: t('rule.center.resetConfirm'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        try {
          const success = await window.electronAPI.resetToDefaultWorkflows(language)
          if (success) {
            await loadWorkflows()
            setSelectedWorkflow(null)
          }
        } catch (error) {
          console.error(t('error.resetFailed'), error)
        }
      }
    })
  }

  useEffect(() => {
    loadWorkflows()
  }, [])

  // 自动保存编辑内容（防抖）
  useEffect(() => {
    if (!editingRuleId || !editingField || !editingValue.trim()) return

    const autoSaveTimer = setTimeout(async () => {
      try {
        await handleSaveInlineEdit(false) // 不清除编辑状态
        console.log('自动保存成功:', editingField, editingValue.trim())
      } catch (error) {
        console.error('自动保存失败:', error)
      }
    }, 1000) // 1秒后自动保存

    return () => clearTimeout(autoSaveTimer)
  }, [editingRuleId, editingField, editingValue])

  // 监听页面可见性变化，在页面隐藏时保存编辑内容
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden && editingRuleId && editingField && editingValue.trim()) {
        try {
          await handleSaveInlineEdit(false)
          console.log('页面隐藏时自动保存成功')
        } catch (error) {
          console.error('页面隐藏时自动保存失败:', error)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [editingRuleId, editingField, editingValue])

  // 监听语言变化，重新加载工作流以更新默认工作流的名称和描述
  useEffect(() => {
    const updateWorkflowsLanguage = async () => {
      try {
        // 保存当前选中的工作流ID
        const currentSelectedId = selectedWorkflow?.id

        // 等待后端更新默认工作流语言完成
        await window.electronAPI.updateDefaultWorkflowLanguage(language)
        // 再等待一小段时间确保文件写入完成
        await new Promise(resolve => setTimeout(resolve, 200))
        // 重新加载工作流数据
        await loadWorkflows()

        // 如果之前有选中的工作流，重新选中它以确保显示最新的翻译
        if (currentSelectedId) {
          // 等待状态更新完成后再重新选中
          setTimeout(async () => {
            try {
              // 重新获取最新的工作流数据
              const latestWorkflows = await window.electronAPI.getAllWorkflows()
              const updatedWorkflow = latestWorkflows.find(w => w.id === currentSelectedId)
              if (updatedWorkflow) {
                setSelectedWorkflow(updatedWorkflow)
              }
            } catch (error) {
              console.error('重新选中工作流失败:', error)
            }
          }, 100)
        }
      } catch (error) {
        console.error('重新加载工作流失败:', error)
      }
    }

    updateWorkflowsLanguage()
  }, [language])



  return (
    <div className="h-full p-6">
      <div className="flex h-full space-x-6">
        {/* 左侧：工作流列表 */}
        <div className="w-80 bg-bg-secondary rounded-lg p-6 flex flex-col h-full min-h-0 shadow-lg border border-border-primary backdrop-blur-sm">
          <div className="mb-6 flex-shrink-0">
            <h2 className="text-lg font-semibold text-text-primary mb-4">{t('rule.center.title')}</h2>
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                className="bg-bg-tertiary border-border-secondary hover:bg-bg-quaternary text-xs"
                onClick={handleResetToDefault}
              >
                {t('rule.center.resetDefault')}
              </Button>
              <Button
                size="sm"
                className="bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
                onClick={handleCreateWorkflow}
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('rule.center.createRule')}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center text-text-tertiary py-8">{t('rule.center.loading')}</div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleWorkflowDragEnd}
              >
                <SortableContext
                  items={workflows.map(w => w.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {workflows
                      .sort((a, b) => a.order - b.order)
                      .map((workflow, index) => (
                        <DraggableRuleCard
                          key={workflow.id}
                          rule={workflow}
                          displayOrder={index + 1}
                          isSelected={selectedWorkflow?.id === workflow.id}
                          onSelect={() => setSelectedWorkflow(workflow)}
                          onToggleEnabled={(enabled) => toggleWorkflowEnabled(workflow.id, enabled)}
                          onDelete={() => handleDeleteWorkflow(workflow.id)}
                          onDoubleClickEdit={(field, value) => handleDoubleClickEdit(workflow.id, field, value)}
                          editingRuleId={editingRuleId}
                          editingField={editingField}
                          editingValue={editingValue}
                          onEditValueChange={handleEditValueChange}
                          onSaveEdit={handleSaveInlineEdit}
                          onCancelEdit={handleCancelInlineEdit}
                          onKeyDown={handleKeyDown}
                        />
                      ))}
                    {workflows.length === 0 && (
                      <div className="text-center text-text-tertiary py-8">
                        <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{t('rule.center.noRules')}</p>
                        <p className="text-xs mt-2">{t('rule.center.noRulesDesc')}</p>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>

        {/* 右侧：工作流详情 */}
        <div className="flex-1 bg-bg-secondary rounded-lg p-6 flex flex-col h-full min-h-0 shadow-lg border border-border-primary backdrop-blur-sm">
          {selectedWorkflow ? (
            <div className="flex flex-col h-full min-h-0">
              {/* 固定头部信息 */}
              <div className="flex items-center justify-between mb-6 flex-shrink-0">
                <div>
                  <h3 className={`text-xl font-semibold ${
                    selectedWorkflow.enabled ? 'text-text-secondary' : 'text-text-tertiary'
                  }`}>
                    {selectedWorkflow.name}
                  </h3>
                  <p className={`mt-1 ${
                    selectedWorkflow.enabled ? 'text-text-tertiary' : 'text-text-tertiary'
                  }`}>
                    {selectedWorkflow.description}
                  </p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-sm text-text-tertiary">
                      {t('rule.center.stepsCount', { count: selectedWorkflow.steps.length })}
                    </span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      selectedWorkflow.enabled
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : 'bg-bg-quaternary text-text-tertiary'
                    }`}>
                      {selectedWorkflow.enabled ? t('rule.center.enabled') : t('rule.center.disabled')}
                    </span>
                    <button
                      className={`text-sm px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${
                        selectedWorkflow.cleanupEmptyFolders !== false
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-bg-quaternary text-text-tertiary'
                      }`}
                      onClick={() => toggleWorkflowCleanupEmptyFolders(selectedWorkflow.id, selectedWorkflow.cleanupEmptyFolders === false)}
                    >
                      {selectedWorkflow.cleanupEmptyFolders !== false ? `✓ ${t('rule.center.autoCleanupEnabled')}` : t('rule.center.autoCleanupDisabled')}
                    </button>

                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    className="bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-600 dark:hover:bg-green-700 dark:text-white"
                    onClick={() => {
                      // 通过事件通知应用切换到工作区并选择当前工作流
                      window.dispatchEvent(new CustomEvent('navigateToWorkspace', {
                        detail: { workflowId: selectedWorkflow.id }
                      }))
                    }}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {t('rule.center.goToWorkspace')}
                  </Button>
                </div>
              </div>

              {/* 可滚动的步骤区域 */}
              <div className="flex-1 min-h-0 flex flex-col">
                {/* 步骤标题 - 固定 */}
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <h4 className="text-lg font-medium text-text-secondary">{t('rule.center.processSteps')}</h4>
                  <Button
                    size="sm"
                    className="bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
                    onClick={() => handleAddStep(selectedWorkflow)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t('rule.center.addStep')}
                  </Button>
                </div>

                {/* 步骤列表 - 可滚动 */}
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                  <div className="space-y-4">
                
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleStepDragEnd}
                >
                  <SortableContext
                    items={selectedWorkflow.steps.map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {selectedWorkflow.steps
                      .sort((a, b) => a.order - b.order)
                      .map((step, index) => (
                        <DraggableStepCard
                          key={step.id}
                          step={step}
                          workflow={selectedWorkflow}
                          displayOrder={index + 1}
                          onToggleEnabled={(stepId, enabled) => handleToggleStepEnabled(selectedWorkflow, stepId, enabled)}
                          onEdit={(stepId) => handleEditStep(selectedWorkflow, stepId)}
                          onDelete={(stepId) => handleDeleteStep(selectedWorkflow, stepId)}
                        />
                      ))}
                  </SortableContext>
                </DndContext>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Settings className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-text-secondary mb-2">{t('rule.center.selectRule')}</h3>
                <p className="text-text-tertiary">{t('rule.center.selectRuleDesc')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog />

      {/* 悬浮步骤编辑器 */}
      {isFloatingEditorOpen && floatingEditingWorkflow && floatingEditingStep && (
        <FloatingStepEditor
          workflow={floatingEditingWorkflow}
          step={floatingEditingStep}
          isOpen={isFloatingEditorOpen}
          onSave={handleSaveFloatingStep}
          onCancel={handleCancelFloatingStep}
        />
      )}
    </div>
  )
}
