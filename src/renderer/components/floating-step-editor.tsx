import { useState, useEffect } from "react"
import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ConditionEditor } from "./condition-editor/index"
import { ActionEditor } from "./action-editor/index"
import { useConfirmDialog } from "./ui/confirm-dialog"
import type { Workflow, ProcessStep, ConditionGroup, Action } from '@shared/types'
import { useLanguage } from '../contexts/language-context'

// 标签页配置
interface TabConfig {
  id: string
  number: string
  name: string
  title: string
  description: string
}



interface FloatingStepEditorProps {
  workflow: Workflow
  step: ProcessStep
  isOpen: boolean
  onSave: (updatedWorkflow: Workflow) => void
  onCancel: () => void
}

export function FloatingStepEditor({ workflow, step, isOpen, onSave, onCancel }: FloatingStepEditorProps) {
  const { t } = useLanguage()
  const { showConfirm, ConfirmDialog } = useConfirmDialog()
  const [editingStep, setEditingStep] = useState<ProcessStep>({
    ...step
    // 不提供默认的processTarget，让用户必须选择
  })
  const [isTextSelecting, setIsTextSelecting] = useState(false)
  const [currentTab, setCurrentTab] = useState(0)

  // 动态生成tabs配置，使用翻译
  const dynamicTabs: TabConfig[] = [
    {
      id: 'basic',
      number: '1',
      name: t('stepEditor.tabBasic'),
      title: t('stepEditor.basicSettings'),
      description: t('stepEditor.basicSettingsDesc')
    },
    {
      id: 'conditions',
      number: '2',
      name: t('stepEditor.tabConditions'),
      title: t('stepEditor.filterConditions'),
      description: t('stepEditor.filterConditionsDesc')
    },
    {
      id: 'actions',
      number: '3',
      name: t('stepEditor.tabActions'),
      title: t('stepEditor.processActions'),
      description: t('stepEditor.processActionsDesc')
    }
  ]

  // 处理对象类型切换处理函数
  const handleProcessTargetChange = (newTarget: 'files' | 'folders') => {
    setEditingStep(prev => {
      // 清理不兼容的条件
      const filteredConditions = prev.conditions.conditions.filter(condition => {
        if (newTarget === 'files') {
          // 只保留文件相关的条件
          return !['folderName', 'folderSize', 'folderFileCount', 'folderSubfolderCount', 'folderIsEmpty', 'itemType'].includes(condition.field);
        } else if (newTarget === 'folders') {
          // 只保留文件夹相关的条件
          return !['fileName', 'fileExtension', 'fileSize', 'fileType', 'filePath'].includes(condition.field);
        }
        return true;
      });

      // 清理不兼容的动作
      const filteredActions = prev.actions.filter(action => {
        if (newTarget === 'files') {
          // 文件支持所有基本动作
          return !['createFolder', 'compress'].includes(action.type);
        } else if (newTarget === 'folders') {
          // 文件夹支持的动作
          return ['move', 'copy', 'rename', 'delete', 'createFolder', 'compress'].includes(action.type);
        }
        return true;
      });

      return {
        ...prev,
        processTarget: newTarget,
        conditions: {
          ...prev.conditions,
          conditions: filteredConditions
        },
        actions: filteredActions
      };
    });
  };

  // ESC键关闭功能
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onCancel])

  // 更新步骤属性
  const updateStep = (field: keyof ProcessStep, value: any) => {
    setEditingStep(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 更新条件
  const updateConditions = (conditions: ConditionGroup) => {
    setEditingStep(prev => ({
      ...prev,
      conditions
    }))
  }

  // 更新动作
  const updateActions = (actions: Action[]) => {
    setEditingStep(prev => ({
      ...prev,
      actions
    }))
  }

  // 保存步骤
  const handleSave = () => {
    // 验证必填字段
    if (!editingStep.processTarget) {
      // 切换到基本设置页面
      setCurrentTab(0);
      showConfirm({
        title: t('common.validationError'),
        description: t('stepEditor.validation.processTargetRequired'),
        variant: 'warning',
        confirmText: t('common.confirm'),
        onConfirm: () => {}
      });
      return;
    }

    // 验证是否有动作
    if (!editingStep.actions || editingStep.actions.length === 0) {
      // 切换到处理动作页面
      setCurrentTab(2);
      showConfirm({
        title: t('common.validationError'),
        description: t('stepEditor.validation.actionsRequired'),
        variant: 'warning',
        confirmText: t('common.confirm'),
        onConfirm: () => {}
      });
      return;
    }

    // 验证动作配置
    for (const action of editingStep.actions) {
      if ((action.type === 'move' || action.type === 'copy' || action.type === 'createFolder') &&
          action.config?.targetPathType === 'specific_path' &&
          !action.config?.targetPath) {
        setCurrentTab(2);
        showConfirm({
          title: t('common.validationError'),
          description: t('stepEditor.validation.targetPathRequired'),
          variant: 'warning',
          confirmText: t('common.confirm'),
          onConfirm: () => {}
        });
        return;
      }
    }

    const updatedWorkflow = {
      ...workflow,
      steps: workflow.steps.map(s => s.id === editingStep.id ? editingStep : s),
      updatedAt: new Date().toISOString()
    }
    onSave(updatedWorkflow)
  }

  // 处理背景点击
  const handleBackdropClick = (e: React.MouseEvent) => {
    // 如果正在进行文本选择，不关闭悬浮框
    if (isTextSelecting) {
      return
    }

    if (e.target === e.currentTarget) {
      onCancel()
    }
  }

  // 监听全局鼠标事件来跟踪文本选择状态
  useEffect(() => {
    if (!isOpen) return

    let isMouseDownInInput = false
    let mouseDownPosition: { x: number; y: number } | null = null

    const handleMouseDown = (e: MouseEvent) => {
      // 记录鼠标按下位置
      mouseDownPosition = { x: e.clientX, y: e.clientY }

      // 检查是否在悬浮框内的可选择元素中开始选择
      const target = e.target as HTMLElement
      const floatingEditor = document.querySelector('[data-floating-editor]')

      if (target && floatingEditor && floatingEditor.contains(target) && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('[contenteditable="true"]') ||
        // 也包括普通文本元素，用户可能想选择标签文本等
        target.closest('label') ||
        target.closest('p') ||
        target.closest('span') ||
        target.closest('div')
      )) {
        isMouseDownInInput = true
        setIsTextSelecting(true)
      } else {
        isMouseDownInInput = false
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      // 如果鼠标在悬浮框内按下，并且移动了一定距离，说明可能在进行文本选择
      if (isMouseDownInInput && mouseDownPosition) {
        const distance = Math.sqrt(
          Math.pow(e.clientX - mouseDownPosition.x, 2) +
          Math.pow(e.clientY - mouseDownPosition.y, 2)
        )
        // 如果移动距离超过5像素，认为是在进行选择操作
        if (distance > 5) {
          setIsTextSelecting(true)
        }
      }
    }

    const handleMouseUp = () => {
      // 检查是否有实际的文本选择
      const selection = window.getSelection()
      const hasSelection = selection && selection.toString().length > 0

      // 如果有文本选择，延长保护时间
      const delay = hasSelection ? 200 : 100

      setTimeout(() => {
        setIsTextSelecting(false)
        isMouseDownInInput = false
        mouseDownPosition = null
      }, delay)
    }

    const handleSelectStart = (e: Event) => {
      // 开始选择文本时设置状态
      const target = e.target as HTMLElement
      const floatingEditor = document.querySelector('[data-floating-editor]')

      if (target && floatingEditor && floatingEditor.contains(target)) {
        setIsTextSelecting(true)
      }
    }

    const handleSelectionChange = () => {
      // 当选择发生变化时，如果有选择内容，保持选择状态
      const selection = window.getSelection()
      if (selection && selection.toString().length > 0) {
        setIsTextSelecting(true)
      }
    }

    document.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('mousemove', handleMouseMove, true)
    document.addEventListener('mouseup', handleMouseUp, true)
    document.addEventListener('selectstart', handleSelectStart, true)
    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('mousemove', handleMouseMove, true)
      document.removeEventListener('mouseup', handleMouseUp, true)
      document.removeEventListener('selectstart', handleSelectStart, true)
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [isOpen])

  // 早期返回必须在所有hooks调用之后
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      {/* 背景遮罩 - 虚化效果 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* 主容器 - 动态高度，跟随窗口大小，使用em单位响应缩放 */}
      <div className={`relative transition-all duration-300 ${
        currentTab === 0 ? 'w-[56.25em] h-[72vh] min-h-[46.875em]' :  // 基本设置 - 900px -> 56.25em, 750px -> 46.875em
        currentTab === 1 ? 'w-[56.25em] h-[65vh] min-h-[43.75em]' :   // 筛选条件 - 700px -> 43.75em
        'w-[56.25em] h-[92vh] min-h-[57.5em]'                         // 处理动作 - 920px -> 57.5em
      } max-w-[90vw] max-h-[95vh]`}>
        {/* 左侧标签 - 紧贴页面，从分割线开始 */}
        <div className="absolute left-0 top-[4.8rem] flex flex-col z-20" style={{
          transform: 'translateX(-2.92em)'
        }}>
          {dynamicTabs.map((tab, index) => (
            <button
              key={tab.id}
              className={`
                w-[3.4em] h-[3.8em] rounded-l-md border-l border-t border-b last:border-b
                transition-all duration-200 ease-in-out
                flex items-center justify-center text-sm
                relative overflow-hidden
                ${currentTab === index
                  ? 'bg-white dark:bg-bg-secondary border-border-primary text-text-primary shadow-lg'
                  : 'bg-bg-quaternary border-border-secondary text-text-tertiary hover:bg-bg-tertiary shadow-inner'
                }
              `}
              onClick={() => setCurrentTab(index)}
              style={{
                borderRight: currentTab === index ? 'none' : '1px solid rgb(var(--border-secondary))',
                borderRightColor: currentTab === index ? 'transparent' : undefined,
                marginRight: currentTab === index ? '1px' : '0'
              }}
            >
              {/* 选中状态的左边缘高亮渐变效果 */}
              {currentTab === index && (
                <div
                  className="absolute left-0 top-0 w-full h-full pointer-events-none"
                  style={{
                    background: document.documentElement.classList.contains('dark')
                      ? 'linear-gradient(to right, rgba(96, 165, 250, 0.7) 0%, rgba(96, 165, 250, 0.4) 20%, rgba(96, 165, 250, 0.15) 40%, transparent 60%)'
                      : 'linear-gradient(to right, rgba(59, 130, 246, 0.6) 0%, rgba(59, 130, 246, 0.3) 20%, rgba(59, 130, 246, 0.1) 40%, transparent 60%)',
                    borderRadius: '0.375rem 0 0 0.375rem'
                  }}
                />
              )}
              <span className="text-xs leading-tight text-center whitespace-pre-line font-medium relative z-10">{tab.name}</span>
            </button>
          ))}
        </div>

        {/* 悬浮编辑器 */}
        <Card data-floating-editor className="relative bg-bg-secondary border-border-primary w-full h-full flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex-shrink-0 px-6 py-3 border-b border-border-primary/30">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-text-primary">
                {t('stepEditor.title', { name: editingStep.name })}
              </h2>
              <p className="text-sm text-text-tertiary/70 mt-1">
                {t('stepEditor.rule', { name: workflow.name })}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors text-sm"
              >
                {t('stepEditor.cancel')}
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white rounded-lg transition-colors text-sm font-medium"
              >
                {t('stepEditor.save')}
              </button>
            </div>
          </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {/* 页面切换容器 */}
            <div className="h-full relative">
            {/* 页面1：基本设置 */}
            <div className={`absolute inset-0 transition-all duration-500 ease-in-out ${
              currentTab === 0
                ? 'opacity-100 translate-x-0 scale-100 z-20'
                : currentTab > 0
                  ? 'opacity-0 -translate-x-8 scale-95 z-0 pointer-events-none'
                  : 'opacity-0 translate-x-8 scale-95 z-0 pointer-events-none'
            }`}>
              <div className="h-full overflow-y-auto scrollbar-hide bg-bg-secondary">
              <div className="p-4">
                {/* 页面标题 */}
                <div className="text-center mb-6">
                  <h3 className="text-lg font-medium text-text-primary mb-2">{dynamicTabs[0].title}</h3>
                  <p className="text-sm text-text-tertiary">{dynamicTabs[0].description}</p>
                </div>

                <div className="max-w-2xl mx-auto space-y-3">
                  {/* 基本信息 - 紧凑布局 */}
                  <div className="bg-bg-tertiary/20 rounded-lg p-3 border-0">
                    <h4 className="text-base font-medium text-text-primary mb-4">{t('stepEditor.stepName')}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-text-secondary mb-2 block">{t('stepEditor.stepName')}</Label>
                        <Input
                          value={editingStep.name}
                          onChange={(e) => updateStep('name', e.target.value)}
                          className="bg-bg-secondary border-border-secondary text-text-primary h-9"
                          placeholder={t('stepEditor.stepNamePlaceholder')}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-text-secondary mb-2 block">{t('stepEditor.stepDesc')}</Label>
                        <Input
                          value={editingStep.description}
                          onChange={(e) => updateStep('description', e.target.value)}
                          className="bg-bg-secondary border-border-secondary text-text-primary h-9"
                          placeholder={t('stepEditor.stepDescPlaceholder')}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 处理对象和输入来源 - 垂直布局 */}
                  <div className="space-y-3">
                    {/* 处理对象选择 */}
                    <div className={`bg-bg-tertiary/20 rounded-lg p-5 border-0 ${!editingStep.processTarget ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-medium text-text-primary">{t('stepEditor.processTarget')}</h4>
                        <span className="text-xs text-red-400 font-medium">{t('stepEditor.required')}</span>
                      </div>
                      {!editingStep.processTarget && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {t('stepEditor.processTargetRequired')}
                          </p>
                        </div>
                      )}
                      <div className="space-y-3">
                        <label className="flex items-center space-x-3 p-3 border border-border-secondary rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                          <input
                            type="radio"
                            name="targetType"
                            value="files"
                            className="w-4 h-4"
                            checked={editingStep.processTarget === 'files'}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleProcessTargetChange('files')
                              }
                            }}
                          />
                          <div>
                            <span className="text-sm font-medium text-text-primary block">{t('stepEditor.processTarget.files')}</span>
                            <span className="text-xs text-text-tertiary">{t('stepEditor.processTarget.filesDesc')}</span>
                          </div>
                        </label>
                        <label className="flex items-center space-x-3 p-3 border border-border-secondary rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                          <input
                            type="radio"
                            name="targetType"
                            value="folders"
                            className="w-4 h-4"
                            checked={editingStep.processTarget === 'folders'}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleProcessTargetChange('folders')
                              }
                            }}
                          />
                          <div>
                            <span className="text-sm font-medium text-text-primary block">{t('stepEditor.processTarget.folders')}</span>
                            <span className="text-xs text-text-tertiary">{t('stepEditor.processTarget.foldersDesc')}</span>
                          </div>
                        </label>

                      </div>
                    </div>

                    {/* 输入来源 */}
                    <div className="bg-bg-tertiary/20 rounded-lg p-5 border-0">
                      <h4 className="text-base font-medium text-text-primary mb-4">{t('stepEditor.inputSourceTitle')}</h4>
                      <div className="space-y-4">
                        <div>
                          <Select
                            value={editingStep.inputSource.type}
                            onValueChange={(value) => updateStep('inputSource', { type: value })}
                          >
                            <SelectTrigger className="bg-bg-secondary border-border-secondary text-text-primary h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-bg-secondary border-border-secondary">
                              <SelectItem value="original" className="text-text-primary">{t('stepEditor.inputSource.original')}</SelectItem>
                              <SelectItem value="previous_step" className="text-text-primary">{t('stepEditor.inputSource.previousStep')}</SelectItem>
                              <SelectItem value="specific_path" className="text-text-primary">{t('stepEditor.inputSource.specificPath')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 指定步骤输出配置 */}
                        {editingStep.inputSource.type === 'previous_step' && (
                          <div className="mt-4 p-3 bg-bg-quaternary/30 rounded-lg border border-border-secondary/50">
                            <Label className="text-xs text-text-secondary mb-2 block">{t('stepEditor.selectStep')}</Label>
                            <Select
                              value={editingStep.inputSource.stepId || 'last_step'}
                              onValueChange={(value) => updateStep('inputSource', {
                                ...editingStep.inputSource,
                                stepId: value === 'last_step' ? undefined : value
                              })}
                            >
                              <SelectTrigger className="bg-bg-secondary border-border-secondary text-text-primary h-9">
                                <SelectValue placeholder={t('stepEditor.selectStepPlaceholder')} />
                              </SelectTrigger>
                              <SelectContent className="bg-bg-secondary border-border-secondary">
                                <SelectItem value="last_step" className="text-text-primary">{t('stepEditor.lastStep')}</SelectItem>
                                {workflow?.steps
                                  .filter((s: ProcessStep) => s.id !== editingStep.id) // 排除当前步骤
                                  .sort((a: ProcessStep, b: ProcessStep) => a.order - b.order)
                                  .map((step: ProcessStep) => {
                                    // 如果步骤名称就是默认的"步骤 X"格式，只显示步骤名称
                                    // 否则显示"步骤 X: 自定义名称"格式
                                    const stepText = t('stepEditor.step');
                                    const defaultName = `${stepText} ${step.order}`;
                                    const displayName = step.name === defaultName ? step.name : `${stepText} ${step.order}: ${step.name}`;

                                    return (
                                      <SelectItem key={step.id} value={step.id} className="text-text-primary">
                                        {displayName}
                                      </SelectItem>
                                    );
                                  })}
                              </SelectContent>
                            </Select>
                            <div className="mt-2 pl-2 border-l-2 border-blue-300 dark:border-blue-700">
                              <p className="text-xs text-text-tertiary">
                                {t('stepEditor.previousStepDesc')}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* 指定路径配置 */}
                        {editingStep.inputSource.type === 'specific_path' && (
                          <div className="mt-4 p-3 bg-bg-quaternary/30 rounded-lg border border-border-secondary/50">
                            <Label className="text-xs text-text-secondary mb-2 block">{t('stepEditor.targetPath')}</Label>
                            <div className="flex gap-2">
                              <Input
                                value={editingStep.inputSource.path || ''}
                                onChange={(e) => updateStep('inputSource', {
                                  ...editingStep.inputSource,
                                  path: e.target.value
                                })}
                                placeholder={t('stepEditor.targetPathPlaceholder')}
                                className="bg-bg-secondary border-border-secondary text-text-primary h-9"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const path = await window.electronAPI.openDirectory()
                                  if (path) {
                                    updateStep('inputSource', {
                                      ...editingStep.inputSource,
                                      path
                                    })
                                  }
                                }}
                                className="bg-bg-secondary border-border-secondary text-text-primary hover:bg-bg-tertiary h-9 px-3"
                              >
                                <FolderOpen className="w-4 h-4" />
                              </Button>
                            </div>

                            {!editingStep.inputSource.path && (
                              <div className="mt-2 text-xs text-yellow-400">
                                ⚠️ {t('stepEditor.specificPathRequired')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                </div>
              </div>
            </div>

            {/* 页面2：筛选条件 */}
            <div className={`absolute inset-0 transition-all duration-500 ease-in-out ${
              currentTab === 1
                ? 'opacity-100 translate-x-0 scale-100 z-20'
                : currentTab > 1
                  ? 'opacity-0 -translate-x-8 scale-95 z-0 pointer-events-none'
                  : 'opacity-0 translate-x-8 scale-95 z-0 pointer-events-none'
            }`}>
              <div className="h-full overflow-y-auto scrollbar-hide bg-bg-secondary">
                <div className="p-5">
                  {/* 页面标题 */}
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-medium text-text-primary mb-2">{dynamicTabs[1].title}</h3>
                    <p className="text-sm text-text-tertiary">{dynamicTabs[1].description}</p>
                  </div>

                  {/* 条件编辑器容器 - 跟随内容高度 */}
                  <div className="bg-bg-tertiary/20 rounded-lg border-0">
                    <div className="p-6">
                      <ConditionEditor
                        conditionGroup={editingStep.conditions}
                        onChange={updateConditions}
                        processTarget={editingStep.processTarget}
                      />
                    </div>
                  </div>


                </div>
              </div>
            </div>

            {/* 页面3：处理动作 */}
            <div className={`absolute inset-0 transition-all duration-500 ease-in-out ${
              currentTab === 2
                ? 'opacity-100 translate-x-0 scale-100 z-20'
                : currentTab > 2
                  ? 'opacity-0 -translate-x-8 scale-95 z-0 pointer-events-none'
                  : 'opacity-0 translate-x-8 scale-95 z-0 pointer-events-none'
            }`}>
              <div className="h-full overflow-y-auto scrollbar-hide bg-bg-secondary">
                <div className="p-6">
                  {/* 页面标题 */}
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-medium text-text-primary mb-2">{dynamicTabs[2].title}</h3>
                    <p className="text-sm text-text-tertiary">{dynamicTabs[2].description}</p>
                  </div>

                  {/* 动作编辑器容器 - 跟随内容高度 */}
                  <div className="bg-bg-tertiary/20 rounded-lg border-0">
                    <div className="p-6">
                      <ActionEditor
                        actions={editingStep.actions || []}
                        onChange={updateActions}
                        processTarget={editingStep.processTarget}
                      />
                    </div>
                  </div>


                </div>
              </div>
            </div>
            </div>
          </div>
        </Card>
      </div>
      <ConfirmDialog />
    </div>
  )
}
