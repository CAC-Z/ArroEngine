import { useState } from "react"
import { Plus, Trash2, Copy, FolderOpen, FileText, Settings, ChevronDown, ChevronUp, Type, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"


import { Label } from "@/components/ui/label"
import type { Action, AdvancedNamingRule } from '@shared/types'
import { useLanguage } from '../../contexts/language-context'
import { getActionTypeConfig, getActionTypes } from './config/action-types'
import { getClassifyOptions, getDateGroupingOptions, getSizePresetOptions } from './config/classify-options'
import { DATE_FORMATS } from './config/date-formats'
import { getCaseTypes, getNamingPatterns } from './config/naming-patterns'

interface ActionEditorProps {
  actions: Action[]
  onChange: (actions: Action[]) => void
  processTarget?: 'files' | 'folders'
}

// 获取深度描述的辅助函数
const getDepthDescription = (selectedDepth: number, processTarget: 'files' | 'folders', t: (key: string) => string): string => {
  const targetText = processTarget === 'folders'
    ? t('common.folders') || '文件夹'
    : t('common.files') || '文件';

  switch (selectedDepth) {
    case -1:
      return t('action.allLevelsDesc').replace('{{target}}', targetText);

    case 1:
      return t('action.rootLevelDesc').replace('{{target}}', targetText);

    default:
      return t('action.levelDesc')
        .replace('{{level}}', (selectedDepth - 1).toString())
        .replace('{{target}}', targetText);
  }
};

export function ActionEditor({ actions, onChange, processTarget }: ActionEditorProps) {
  const { t } = useLanguage()
  // 折叠状态管理
  const [collapsedActions, setCollapsedActions] = useState<Set<string>>(new Set())

  // 如果没有选择处理对象，显示提示信息
  if (!processTarget) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px] text-center">
        <p className="text-red-500 text-base font-medium">
          {t('action.selectProcessTargetFirst')}
        </p>
      </div>
    )
  }

  // 切换折叠状态
  const toggleCollapse = (actionId: string) => {
    setCollapsedActions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(actionId)) {
        newSet.delete(actionId)
      } else {
        newSet.add(actionId)
      }
      return newSet
    })
  }

  // 添加动作
  const addAction = () => {
    // 根据处理目标选择默认动作类型
    const availableActionTypes = getActionTypes(t, processTarget);
    const defaultActionType = availableActionTypes.length > 0 ? availableActionTypes[0].value : 'move';

    const newAction: Action = {
      id: `action-${Date.now()}`,
      type: defaultActionType as Action['type'],
      enabled: true, // 默认启用，但不在UI中显示控制
      config: {
        targetPath: '',
        targetPathType: 'input_folder', // 默认为输入文件夹
        createSubfolders: false, // 默认不启用按文件类型自动分类
        preserveFolderStructure: processTarget === 'files', // 处理文件时默认保持文件夹结构
        namingPattern: 'original'
      }
    }

    onChange([...actions, newAction])
  }

  // 更新动作
  const updateAction = (actionId: string, field: keyof Action, value: any) => {
    onChange(
      actions.map(action =>
        action.id === actionId
          ? { ...action, [field]: value }
          : action
      )
    )
  }

  // 更新动作配置
  const updateActionConfig = (actionId: string, configField: string, value: any) => {
    onChange(
      actions.map(action =>
        action.id === actionId
          ? {
              ...action,
              config: {
                ...(action.config || {}),
                [configField]: value
              }
            }
          : action
      )
    )
  }

  // 高级规则管理函数
  const addAdvancedRule = (actionId: string) => {
    const action = actions.find(a => a.id === actionId)
    const currentRules = action?.config?.advancedRules || []
    const newRule: AdvancedNamingRule = {
      id: Date.now().toString(),
      type: 'prefix',
      value: '',
      enabled: true,
      order: currentRules.length + 1,
      config: {}
    }

    updateActionConfig(actionId, 'advancedRules', [...currentRules, newRule])
  }

  const removeAdvancedRule = (actionId: string, ruleId: string) => {
    const action = actions.find(a => a.id === actionId)
    const currentRules = action?.config?.advancedRules || []
    const updatedRules = currentRules
      .filter((rule: AdvancedNamingRule) => rule.id !== ruleId)
      .map((rule: AdvancedNamingRule, index: number) => ({ ...rule, order: index + 1 }))

    updateActionConfig(actionId, 'advancedRules', updatedRules)
  }

  const updateAdvancedRule = (actionId: string, ruleId: string, key: string, value: any) => {
    const action = actions.find(a => a.id === actionId)
    const currentRules = action?.config?.advancedRules || []
    const updatedRules = currentRules.map((rule: AdvancedNamingRule) =>
      rule.id === ruleId ? { ...rule, [key]: value } : rule
    )

    updateActionConfig(actionId, 'advancedRules', updatedRules)
  }

  const moveAdvancedRule = (actionId: string, ruleId: string, direction: 'up' | 'down') => {
    const action = actions.find(a => a.id === actionId)
    const currentRules = action?.config?.advancedRules || []
    const ruleIndex = currentRules.findIndex((rule: AdvancedNamingRule) => rule.id === ruleId)

    if (ruleIndex === -1) return

    const newRules = [...currentRules]
    const targetIndex = direction === 'up' ? ruleIndex - 1 : ruleIndex + 1

    if (targetIndex >= 0 && targetIndex < newRules.length) {
      [newRules[ruleIndex], newRules[targetIndex]] = [newRules[targetIndex], newRules[ruleIndex]]

      // 更新order
      const reorderedRules = newRules.map((rule, index) => ({ ...rule, order: index + 1 }))
      updateActionConfig(actionId, 'advancedRules', reorderedRules)
    }
  }

  // 删除动作
  const deleteAction = (actionId: string) => {
    onChange(actions.filter(action => action.id !== actionId))
  }

  // 复制动作
  const duplicateAction = (action: Action) => {
    const newAction: Action = {
      ...action,
      id: `action-${Date.now()}`
    }
    onChange([...actions, newAction])
  }



  // 渲染路径选择器
  const renderPathSelector = (action: Action) => {
    const typeConfig = getActionTypeConfig(t, processTarget, action.type)
    if (!typeConfig.requiresPath) return null

    return (
      <div className="space-y-3">
        <Label className="text-text-secondary">{t('action.targetPath')}</Label>

        {/* 目标路径类型选择器 */}
        <div className="space-y-2">
          <Label className="text-xs text-text-tertiary">{t('action.targetPathType')}</Label>
          <Select
            value={action.config?.targetPathType || (action.config?.targetPath ? 'specific_path' : 'input_folder')}
            onValueChange={(value: 'input_folder' | 'specific_path') => {
              // 原子性更新：同时更新 targetPathType 和 targetPath
              onChange(
                actions.map(a =>
                  a.id === action.id
                    ? {
                        ...a,
                        config: {
                          ...(a.config || {}),
                          targetPathType: value,
                          // 如果切换到输入文件夹，清空目标路径
                          targetPath: value === 'input_folder' ? '' : (a.config?.targetPath || '')
                        }
                      }
                    : a
                )
              )
            }}
          >
            <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-bg-secondary border-border-secondary">
              <SelectItem value="input_folder" className="text-text-primary">
                {t('action.targetPathType.inputFolder')}
              </SelectItem>
              <SelectItem value="specific_path" className="text-text-primary">
                {t('action.targetPathType.specificPath')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 只有选择指定路径时才显示路径输入框 */}
        {action.config?.targetPathType === 'specific_path' && (
          <div className="flex space-x-2">
            <Input
              value={action.config?.targetPath || ''}
              onChange={(e) => updateActionConfig(action.id, 'targetPath', e.target.value)}
              className="bg-bg-tertiary border-border-secondary text-text-secondary"
              placeholder={t('action.targetPathPlaceholder')}
            />
            <Button
              size="sm"
              variant="outline"
              className="bg-bg-tertiary border-border-secondary hover:bg-bg-quaternary"
              onClick={async () => {
                try {
                  const path = await window.electronAPI.openDirectory()
                  if (path) {
                    updateActionConfig(action.id, 'targetPath', path)
                  }
                } catch (error) {
                  console.error(t('error.selectPathFailed'), error)
                }
              }}
          >
            <FolderOpen className="w-4 h-4" />
          </Button>
        </div>
        )}

        {/* 分类方式选择 - 只在处理文件时显示 */}
        {processTarget === 'files' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-text-secondary">{t('action.classifyBy')}</Label>
              <Select
                value={action.config?.classifyBy ||
                       (action.config?.createSubfolders ? 'fileType' : 'none') ||
                       (action.config?.preserveFolderStructure ? 'preserveStructure' : 'none')}
                onValueChange={(classifyBy) => {
                  const actualClassifyBy = classifyBy === 'none' ? undefined : classifyBy;
                  onChange(
                    actions.map(a =>
                      a.id === action.id
                        ? {
                            ...a,
                            config: {
                              ...a.config,
                              classifyBy: actualClassifyBy as any,
                              // 向后兼容：同步更新 createSubfolders 和 preserveFolderStructure
                              createSubfolders: classifyBy === 'fileType',
                              preserveFolderStructure: classifyBy === 'preserveStructure'
                            }
                          }
                        : a
                    )
                  )
                }}
              >
                <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-secondary">
                  {getClassifyOptions(t, processTarget).map(option => (
                    <SelectItem key={option.value} value={option.value} className="text-text-secondary">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 日期分类配置 */}
            {(action.config?.classifyBy === 'createdDate' || action.config?.classifyBy === 'modifiedDate') && (
              <div className="space-y-2">
                <Label className="text-text-secondary">日期分组方式</Label>
                <Select
                  value={action.config?.dateGrouping || 'yearMonth'}
                  onValueChange={(dateGrouping) => {
                    onChange(
                      actions.map(a =>
                        a.id === action.id
                          ? {
                              ...a,
                              config: {
                                ...a.config,
                                dateGrouping: dateGrouping as any
                              }
                            }
                          : a
                      )
                    )
                  }}
                >
                  <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-bg-tertiary border-border-secondary">
                    {getDateGroupingOptions(t).map(option => (
                      <SelectItem key={option.value} value={option.value} className="text-text-secondary">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 文件大小分类配置 */}
            {action.config?.classifyBy === 'fileSize' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-text-secondary">{t('action.classify.sizeMode')}</Label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name={`sizeMode-${action.id}`}
                        value="preset"
                        checked={action.config?.sizeClassifyMode !== 'custom'}
                        onChange={() => {
                          onChange(
                            actions.map(a =>
                              a.id === action.id
                                ? {
                                    ...a,
                                    config: {
                                      ...a.config,
                                      sizeClassifyMode: 'preset',
                                      sizePreset: a.config?.sizePreset || 'general'
                                    }
                                  }
                                : a
                            )
                          )
                        }}
                        className="w-4 h-4 text-green-600"
                      />
                      <span className="text-text-secondary">{t('action.classify.usePresetRanges')}</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name={`sizeMode-${action.id}`}
                        value="custom"
                        checked={action.config?.sizeClassifyMode === 'custom'}
                        onChange={() => {
                          onChange(
                            actions.map(a =>
                              a.id === action.id
                                ? {
                                    ...a,
                                    config: {
                                      ...a.config,
                                      sizeClassifyMode: 'custom'
                                    }
                                  }
                                : a
                            )
                          )
                        }}
                        className="w-4 h-4 text-green-600"
                      />
                      <span className="text-text-secondary">{t('action.classify.useCustomRanges')}</span>
                    </label>
                  </div>
                </div>

                {/* 预设范围选择 */}
                {action.config?.sizeClassifyMode !== 'custom' && (
                  <div className="space-y-2">
                    <Label className="text-text-secondary">{t('action.classify.presetScenario')}</Label>
                    <Select
                      value={action.config?.sizePreset || 'general'}
                      onValueChange={(sizePreset) => {
                        onChange(
                          actions.map(a =>
                            a.id === action.id
                              ? {
                                  ...a,
                                  config: {
                                    ...a.config,
                                    sizePreset: sizePreset as any
                                  }
                                }
                              : a
                          )
                        )
                      }}
                    >
                      <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-bg-tertiary border-border-secondary">
                        {getSizePresetOptions(t).map(option => (
                          <SelectItem key={option.value} value={option.value} className="text-text-secondary">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 自定义范围配置 */}
                {action.config?.sizeClassifyMode === 'custom' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-text-secondary">{t('action.classify.customSizeRanges')}</Label>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const defaultRanges = [
                              { id: '1', minSize: 0, maxSize: 1, unit: 'MB' as const, folderName: t('action.classify.smallFiles') },
                              { id: '2', minSize: 1, maxSize: 100, unit: 'MB' as const, folderName: t('action.classify.mediumFiles') },
                              { id: '3', minSize: 100, maxSize: 1, unit: 'GB' as const, folderName: t('action.classify.largeFiles') },
                              { id: '4', minSize: 1, maxSize: -1, unit: 'GB' as const, folderName: t('action.classify.extraLargeFiles') }
                            ];
                            onChange(
                              actions.map(a =>
                                a.id === action.id
                                  ? {
                                      ...a,
                                      config: {
                                        ...a.config,
                                        customSizeRanges: defaultRanges
                                      }
                                    }
                                  : a
                              )
                            );
                          }}
                          className="bg-bg-tertiary border-border-secondary hover:bg-bg-quaternary text-xs"
                        >
                          <Settings className="w-3 h-3 mr-1" />
                          {t('action.classify.useDefault')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newRange = {
                              id: Date.now().toString(),
                              minSize: 0,
                              maxSize: 1,
                              unit: 'MB' as const,
                              folderName: t('action.classify.newRange')
                            };
                            const currentRanges = action.config?.customSizeRanges || [];
                            onChange(
                              actions.map(a =>
                                a.id === action.id
                                  ? {
                                      ...a,
                                      config: {
                                        ...a.config,
                                        customSizeRanges: [...currentRanges, newRange]
                                      }
                                    }
                                  : a
                              )
                            );
                          }}
                          className="bg-bg-tertiary border-border-secondary hover:bg-bg-quaternary text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          {t('action.classify.addRange')}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {(action.config?.customSizeRanges || []).map((range, index) => (
                        <div key={range.id} className="bg-bg-quaternary border border-border-secondary rounded-lg p-3">
                          <div className="grid grid-cols-12 gap-2 items-center">
                            {/* 文件夹名称 */}
                            <div className="col-span-3">
                              <Label className="text-text-secondary text-xs">{t('action.classify.folderName')}</Label>
                              <Input
                                value={range.folderName}
                                onChange={(e) => {
                                  const updatedRanges = [...(action.config?.customSizeRanges || [])];
                                  updatedRanges[index] = { ...range, folderName: e.target.value };
                                  onChange(
                                    actions.map(a =>
                                      a.id === action.id
                                        ? {
                                            ...a,
                                            config: {
                                              ...a.config,
                                              customSizeRanges: updatedRanges
                                            }
                                          }
                                        : a
                                    )
                                  );
                                }}
                                className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-xs"
                                placeholder={t('action.classify.folderName')}
                              />
                            </div>

                            {/* 最小大小 */}
                            <div className="col-span-2">
                              <Label className="text-text-secondary text-xs">{t('action.classify.minSize')}</Label>
                              <Input
                                type="number"
                                value={range.minSize}
                                onChange={(e) => {
                                  const updatedRanges = [...(action.config?.customSizeRanges || [])];
                                  updatedRanges[index] = { ...range, minSize: parseFloat(e.target.value) || 0 };
                                  onChange(
                                    actions.map(a =>
                                      a.id === action.id
                                        ? {
                                            ...a,
                                            config: {
                                              ...a.config,
                                              customSizeRanges: updatedRanges
                                            }
                                          }
                                        : a
                                    )
                                  );
                                }}
                                className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-xs"
                                placeholder="0"
                              />
                            </div>

                            {/* 最大大小 */}
                            <div className="col-span-2">
                              <Label className="text-text-secondary text-xs">{t('action.classify.maxSize')}</Label>
                              <Input
                                type="number"
                                value={range.maxSize === -1 ? '' : range.maxSize}
                                onChange={(e) => {
                                  const updatedRanges = [...(action.config?.customSizeRanges || [])];
                                  const value = e.target.value === '' ? -1 : parseFloat(e.target.value) || 0;
                                  updatedRanges[index] = { ...range, maxSize: value };
                                  onChange(
                                    actions.map(a =>
                                      a.id === action.id
                                        ? {
                                            ...a,
                                            config: {
                                              ...a.config,
                                              customSizeRanges: updatedRanges
                                            }
                                          }
                                        : a
                                    )
                                  );
                                }}
                                className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-xs"
                                placeholder={t('action.classify.unlimited')}
                              />
                            </div>

                            {/* 单位选择 */}
                            <div className="col-span-2">
                              <Label className="text-text-secondary text-xs">{t('action.classify.unit')}</Label>
                              <Select
                                value={range.unit}
                                onValueChange={(value: 'B' | 'KB' | 'MB' | 'GB') => {
                                  const updatedRanges = [...(action.config?.customSizeRanges || [])];
                                  updatedRanges[index] = { ...range, unit: value };
                                  onChange(
                                    actions.map(a =>
                                      a.id === action.id
                                        ? {
                                            ...a,
                                            config: {
                                              ...a.config,
                                              customSizeRanges: updatedRanges
                                            }
                                          }
                                        : a
                                    )
                                  );
                                }}
                              >
                                <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-bg-tertiary border-border-secondary">
                                  <SelectItem value="B" className="text-text-secondary text-xs">B</SelectItem>
                                  <SelectItem value="KB" className="text-text-secondary text-xs">KB</SelectItem>
                                  <SelectItem value="MB" className="text-text-secondary text-xs">MB</SelectItem>
                                  <SelectItem value="GB" className="text-text-secondary text-xs">GB</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* 删除按钮 */}
                            <div className="col-span-1 flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const updatedRanges = (action.config?.customSizeRanges || []).filter((_, i) => i !== index);
                                  onChange(
                                    actions.map(a =>
                                      a.id === action.id
                                        ? {
                                            ...a,
                                            config: {
                                              ...a.config,
                                              customSizeRanges: updatedRanges
                                            }
                                          }
                                        : a
                                    )
                                  );
                                }}
                                className="bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400 h-8 w-8 p-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          {/* 范围说明 */}
                          <div className="mt-2 text-xs text-text-tertiary">
                            {range.minSize} {range.unit} - {range.maxSize === -1 ? t('action.classify.unlimited') : `${range.maxSize} ${range.unit}`}
                          </div>
                        </div>
                      ))}

                      {(!action.config?.customSizeRanges || action.config.customSizeRanges.length === 0) && (
                        <div className="bg-bg-quaternary border border-border-secondary rounded-lg p-3 text-center">
                          <p className="text-xs text-text-secondary mb-2">
                            {t('action.classify.noCustomRanges')}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            {t('action.classify.customRangesTip')}
                          </p>
                        </div>
                      )}

                      {/* 帮助信息 */}
                      {action.config?.customSizeRanges && action.config.customSizeRanges.length > 0 && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                          <p className="text-xs text-blue-400 mb-1">
                            <strong>{t('action.classify.configHelp')}</strong>
                          </p>
                          <ul className="text-xs text-blue-300 space-y-1">
                            <li>{t('action.classify.configHelpItem1')}</li>
                            <li>{t('action.classify.configHelpItem2')}</li>
                            <li>{t('action.classify.configHelpItem3')}</li>
                            <li>{t('action.classify.configHelpItem4')}</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 文件类型分类说明 */}
            {(action.config?.createSubfolders || action.config?.classifyBy === 'fileType') && (
              <div className="bg-bg-quaternary border border-border-secondary rounded-lg p-3">
                <p className="text-xs text-text-secondary mb-2">
                  💡 <strong>{t('action.autoClassificationTitle')}</strong>
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-text-tertiary">
                  <div>📸 <strong>{t('action.autoClassification.image')}</strong> {t('action.autoClassification.imageTypes')}</div>
                  <div>📄 <strong>{t('action.autoClassification.document')}</strong> {t('action.autoClassification.documentTypes')}</div>
                  <div>🎬 <strong>{t('action.autoClassification.video')}</strong> {t('action.autoClassification.videoTypes')}</div>
                  <div>🎵 <strong>{t('action.autoClassification.audio')}</strong> {t('action.autoClassification.audioTypes')}</div>
                  <div>📦 <strong>{t('action.autoClassification.archive')}</strong> {t('action.autoClassification.archiveTypes')}</div>
                  <div>💻 <strong>{t('action.autoClassification.code')}</strong> {t('action.autoClassification.codeTypes')}</div>
                </div>
                <p className="text-xs text-text-secondary mt-2">
                  {t('action.autoClassificationDesc')}
                </p>
              </div>
            )}

            {/* 路径预览示例 */}
            {action.config?.targetPath && (
              <div className="bg-bg-tertiary/50 border border-border-secondary rounded-lg p-3">
                <p className="text-xs text-text-secondary mb-2">📁 <strong>{t('action.pathPreview')}</strong></p>
                <div className="space-y-1 text-xs text-text-tertiary">
                  {action.config?.createSubfolders ? (
                    <>
                      <div>• {t('action.pathPreview.imageFiles', { path: action.config.targetPath })}</div>
                      <div>• {t('action.pathPreview.documentFiles', { path: action.config.targetPath })}</div>
                      <div>• {t('action.pathPreview.videoFiles', { path: action.config.targetPath })}</div>
                      <div>• {t('action.pathPreview.otherFiles', { path: action.config.targetPath })}</div>
                    </>
                  ) : (
                    <div>• {t('action.pathPreview.allFiles', { path: action.config.targetPath })}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // 渲染命名规则配置
  const renderNamingConfig = (action: Action) => {
    const typeConfig = getActionTypeConfig(t, processTarget, action.type)
    if (!typeConfig.supportsNaming) return null

    return (
      <div className="space-y-3">
        <Label className="text-text-secondary">{t('action.namingRule')}</Label>
        
        <Select
          value={action.config?.namingPattern || 'original'}
          onValueChange={(value) => updateActionConfig(action.id, 'namingPattern', value)}
        >
          <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-bg-tertiary border-border-secondary">
            {getNamingPatterns(t).map(pattern => (
              <SelectItem key={pattern.value} value={pattern.value} className="text-text-secondary">
                {pattern.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 日期格式选择 */}
        {(action.config?.namingPattern === 'date' || action.config?.namingPattern === 'timestamp' ||
          action.config?.namingPattern === 'file-created' || action.config?.namingPattern === 'file-modified') && (
          <div className="space-y-3">
            <div>
              <Label className="text-text-secondary">{t('action.dateFormatLabel')}</Label>
              <Select
                value={action.config?.dateFormat || 'YYYY-MM-DD'}
                onValueChange={(value) => updateActionConfig(action.id, 'dateFormat', value)}
              >
                <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-secondary">
                  {DATE_FORMATS.map(format => (
                    <SelectItem key={format.value} value={format.value} className="text-text-secondary">
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpaces-date-${action.id}`}
                  checked={action.config?.removeSpaces || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpaces', checked)}
                />
                <Label htmlFor={`removeSpaces-date-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpacesLabel')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpecialChars-date-${action.id}`}
                  checked={action.config?.removeSpecialChars || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpecialChars', checked)}
                />
                <Label htmlFor={`removeSpecialChars-date-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpecialCharsLabel')}
                </Label>
              </div>
            </div>
          </div>
        )}

        {/* 自定义命名模式 */}
        {action.config?.namingPattern === 'custom' && (
          <div className="space-y-3">
            <Label className="text-text-secondary">{t('action.customModeTitle')}</Label>
            <Input
              value={action.config?.customPattern || ''}
              onChange={(e) => updateActionConfig(action.id, 'customPattern', e.target.value)}
              className="bg-bg-tertiary border-border-secondary text-text-secondary"
              placeholder={t('action.customPatternPlaceholder')}
            />

            {/* Counter配置 - 仅在使用{counter}时显示 */}
            {action.config?.customPattern?.includes('{counter}') && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-bg-quaternary rounded-lg border border-border-secondary">
                <div>
                  <Label className="text-text-secondary text-xs">{t('action.counterStartNumber')}</Label>
                  <Input
                    type="number"
                    value={action.config?.counterStart || 1}
                    onChange={(e) => updateActionConfig(action.id, 'counterStart', parseInt(e.target.value) || 1)}
                    className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-xs"
                    placeholder="1"
                  />
                </div>
                <div>
                  <Label className="text-text-secondary text-xs">{t('action.counterDigitsNumber')}</Label>
                  <Input
                    type="number"
                    value={action.config?.counterPadding || 3}
                    onChange={(e) => updateActionConfig(action.id, 'counterPadding', parseInt(e.target.value) || 3)}
                    className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-xs"
                    placeholder="3"
                  />
                </div>
                <div className="col-span-2 text-xs text-text-tertiary">
                  {t('action.counterExample')}
                </div>
              </div>
            )}

            {/* removeSpaces和removeSpecialChars选项 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpaces-custom-${action.id}`}
                  checked={action.config?.removeSpaces || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpaces', checked)}
                />
                <Label htmlFor={`removeSpaces-custom-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpacesLabel')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpecialChars-custom-${action.id}`}
                  checked={action.config?.removeSpecialChars || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpecialChars', checked)}
                />
                <Label htmlFor={`removeSpecialChars-custom-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpecialCharsLabel')}
                </Label>
              </div>
            </div>

            {/* 可用变量说明 */}
            <div className="bg-bg-quaternary border border-border-secondary rounded-lg p-3">
              <p className="text-xs text-text-secondary mb-2">
                🏷️ <strong>{t('action.availableVariablesTitle')}</strong>
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-text-tertiary">
                <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{'{name}'}</code> - {t('action.variable.name')}</div>
                <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{'{ext}'}</code> - {t('action.variable.ext')}</div>
                <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{'{date}'}</code> - {t('action.variable.date')}</div>
                <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{'{time}'}</code> - {t('action.variable.time')}</div>
                <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{'{counter}'}</code> - {t('action.variable.counter')}</div>
                <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{'{type}'}</code> - {t('action.variable.type')}</div>
                <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{'{year}'}</code> - {t('action.variable.year')}</div>
                <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{'{month}'}</code> - {t('action.variable.month')}</div>
                <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{'{day}'}</code> - {t('action.variable.day')}</div>
                <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{'{hour}'}</code> - {t('action.variable.hour')}</div>
                <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{'{minute}'}</code> - {t('action.variable.minute')}</div>
                <div><code className="bg-bg-tertiary px-1 rounded text-text-secondary">{'{second}'}</code> - {t('action.variable.second')}</div>
              </div>

              {/* 示例预览 */}
              {action.config?.customPattern && action.config.customPattern.trim() && (
                <div className="mt-3 pt-2 border-t border-border-secondary">
                  <p className="text-xs text-text-secondary mb-1">📝 <strong>{t('action.examplePreviewTitle')}</strong></p>
                  <div className="text-xs text-text-tertiary bg-bg-quaternary rounded p-2">
                    <div>{t('action.originalFile')} <span className="text-text-secondary">photo.jpg</span></div>
                    <div>{t('action.newFile')} <span className="text-green-400">
                      {(() => {
                        try {
                          // 使用配置的counter起始值和位数
                          const counterStart = action.config?.counterStart || 1;
                          const counterPadding = action.config?.counterPadding || 3;
                          const counterValue = counterStart.toString().padStart(counterPadding, '0');

                          // 应用removeSpaces和removeSpecialChars到原始文件名
                          let fileName = 'photo';
                          if (action.config?.removeSpaces) {
                            fileName = fileName.replace(/\s+/g, '');
                          }
                          if (action.config?.removeSpecialChars) {
                            fileName = fileName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
                          }

                          return action.config.customPattern
                            .replace('{name}', fileName)
                            .replace('{ext}', 'jpg')
                            .replace('{date}', '2024-12-03')
                            .replace('{time}', '14-30-25')
                            .replace('{counter}', counterValue)
                            .replace('{type}', '图片')
                            .replace('{year}', '2024')
                            .replace('{month}', '12')
                            .replace('{day}', '03')
                            .replace('{hour}', '14')
                            .replace('{minute}', '30')
                            .replace('{second}', '25')
                        } catch (error) {
                          return '预览错误'
                        }
                      })()}.jpg
                    </span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 序号配置 */}
        {action.config?.namingPattern === 'counter' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-text-secondary">{t('action.counterStartLabel')}</Label>
                <Input
                  type="number"
                  value={action.config?.counterStart || 1}
                  onChange={(e) => updateActionConfig(action.id, 'counterStart', parseInt(e.target.value) || 1)}
                  className="bg-bg-tertiary border-border-secondary text-text-secondary"
                />
              </div>
              <div>
                <Label className="text-text-secondary">{t('action.counterDigitsLabel')}</Label>
                <Input
                  type="number"
                  value={action.config?.counterPadding || 3}
                  onChange={(e) => updateActionConfig(action.id, 'counterPadding', parseInt(e.target.value) || 3)}
                  className="bg-bg-tertiary border-border-secondary text-text-secondary"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpaces-counter-${action.id}`}
                  checked={action.config?.removeSpaces || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpaces', checked)}
                />
                <Label htmlFor={`removeSpaces-counter-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpacesLabel')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpecialChars-counter-${action.id}`}
                  checked={action.config?.removeSpecialChars || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpecialChars', checked)}
                />
                <Label htmlFor={`removeSpecialChars-counter-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpecialCharsLabel')}
                </Label>
              </div>
            </div>
          </div>
        )}

        {/* 前缀模式 */}
        {action.config?.namingPattern === 'prefix' && (
          <div className="space-y-3">
            <Label className="text-text-secondary">{t('action.prefixContentLabel')}</Label>
            <Input
              value={action.config?.prefix || ''}
              onChange={(e) => updateActionConfig(action.id, 'prefix', e.target.value)}
              className="bg-bg-tertiary border-border-secondary text-text-secondary"
              placeholder={t('action.prefixPlaceholder')}
            />
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpaces-prefix-${action.id}`}
                  checked={action.config?.removeSpaces || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpaces', checked)}
                />
                <Label htmlFor={`removeSpaces-prefix-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpacesLabel')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpecialChars-prefix-${action.id}`}
                  checked={action.config?.removeSpecialChars || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpecialChars', checked)}
                />
                <Label htmlFor={`removeSpecialChars-prefix-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpecialCharsLabel')}
                </Label>
              </div>
            </div>
            <div className="text-xs text-text-tertiary">
              {t('action.prefixExample')}
            </div>
          </div>
        )}

        {/* 后缀模式 */}
        {action.config?.namingPattern === 'suffix' && (
          <div className="space-y-3">
            <Label className="text-text-secondary">{t('action.suffixContentLabel')}</Label>
            <Input
              value={action.config?.suffix || ''}
              onChange={(e) => updateActionConfig(action.id, 'suffix', e.target.value)}
              className="bg-bg-tertiary border-border-secondary text-text-secondary"
              placeholder={t('action.suffixPlaceholder')}
            />
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpaces-suffix-${action.id}`}
                  checked={action.config?.removeSpaces || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpaces', checked)}
                />
                <Label htmlFor={`removeSpaces-suffix-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpacesLabel')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpecialChars-suffix-${action.id}`}
                  checked={action.config?.removeSpecialChars || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpecialChars', checked)}
                />
                <Label htmlFor={`removeSpecialChars-suffix-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpecialCharsLabel')}
                </Label>
              </div>
            </div>
            <div className="text-xs text-text-tertiary">
              {t('action.suffixExample')}
            </div>
          </div>
        )}

        {/* 查找替换模式 */}
        {action.config?.namingPattern === 'replace' && (
          <div className="space-y-3">
            <div>
              <Label className="text-text-secondary">{t('action.replaceFromLabel')}</Label>
              <Input
                value={action.config?.replaceFrom || ''}
                onChange={(e) => updateActionConfig(action.id, 'replaceFrom', e.target.value)}
                className="bg-bg-tertiary border-border-secondary text-text-secondary"
                placeholder={t('action.replaceFromPlaceholder')}
              />
            </div>
            <div>
              <Label className="text-text-secondary">{t('action.replaceToLabel')}</Label>
              <Input
                value={action.config?.replaceTo || ''}
                onChange={(e) => updateActionConfig(action.id, 'replaceTo', e.target.value)}
                className="bg-bg-tertiary border-border-secondary text-text-secondary"
                placeholder={t('action.replaceToPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpaces-replace-${action.id}`}
                  checked={action.config?.removeSpaces || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpaces', checked)}
                />
                <Label htmlFor={`removeSpaces-replace-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpacesLabel')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpecialChars-replace-${action.id}`}
                  checked={action.config?.removeSpecialChars || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpecialChars', checked)}
                />
                <Label htmlFor={`removeSpecialChars-replace-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpecialCharsLabel')}
                </Label>
              </div>
            </div>
            <div className="text-xs text-text-tertiary">
              {t('action.replaceExampleText')}
            </div>
          </div>
        )}

        {/* 大小写转换模式 */}
        {action.config?.namingPattern === 'case' && (
          <div className="space-y-3">
            <Label className="text-text-secondary">{t('action.caseTypeLabel')}</Label>
            <Select
              value={action.config?.caseType || 'lower'}
              onValueChange={(value) => updateActionConfig(action.id, 'caseType', value)}
            >
              <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-bg-tertiary border-border-secondary">
                {getCaseTypes(t).map(caseType => (
                  <SelectItem key={caseType.value} value={caseType.value} className="text-text-secondary">
                    {caseType.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpaces-${action.id}`}
                  checked={action.config?.removeSpaces || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpaces', checked)}
                />
                <Label htmlFor={`removeSpaces-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpacesLabel')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`removeSpecialChars-${action.id}`}
                  checked={action.config?.removeSpecialChars || false}
                  onCheckedChange={(checked) => updateActionConfig(action.id, 'removeSpecialChars', checked)}
                />
                <Label htmlFor={`removeSpecialChars-${action.id}`} className="text-text-secondary text-sm">
                  {t('action.removeSpecialCharsLabel')}
                </Label>
              </div>
            </div>
            <div className="text-xs text-text-tertiary">
              {t('action.caseExampleText')}
            </div>
          </div>
        )}

        {/* 高级组合模式 */}
        {action.config?.namingPattern === 'advanced' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-text-secondary">{t('action.advancedRulesLabel')}</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addAdvancedRule(action.id)}
                className="bg-bg-tertiary border-border-secondary hover:bg-bg-quaternary text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                {t('action.addRuleButton')}
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(action.config?.advancedRules || []).map((rule: AdvancedNamingRule, index: number) => (
                <div key={rule.id} className="bg-bg-secondary/50 border border-border-secondary rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={rule.enabled}
                        onCheckedChange={(checked) => updateAdvancedRule(action.id, rule.id, 'enabled', checked)}
                      />
                      <span className="text-xs text-text-tertiary">#{rule.order}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveAdvancedRule(action.id, rule.id, 'up')}
                        disabled={index === 0}
                        className="h-6 w-6 p-0"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveAdvancedRule(action.id, rule.id, 'down')}
                        disabled={index === (action.config?.advancedRules || []).length - 1}
                        className="h-6 w-6 p-0"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeAdvancedRule(action.id, rule.id)}
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-text-tertiary">{t('action.ruleType')}</Label>
                      <Select
                        value={rule.type}
                        onValueChange={(value) => updateAdvancedRule(action.id, rule.id, 'type', value)}
                      >
                        <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-bg-tertiary border-border-secondary">
                          <SelectItem value="prefix" className="text-text-secondary text-xs">{t('action.advancedRuleTypes.prefix')}</SelectItem>
                          <SelectItem value="suffix" className="text-text-secondary text-xs">{t('action.advancedRuleTypes.suffix')}</SelectItem>
                          <SelectItem value="replace" className="text-text-secondary text-xs">{t('action.advancedRuleTypes.replace')}</SelectItem>
                          <SelectItem value="case" className="text-text-secondary text-xs">{t('action.advancedRuleTypes.case')}</SelectItem>
                          <SelectItem value="counter" className="text-text-secondary text-xs">{t('action.advancedRuleTypes.counter')}</SelectItem>
                          <SelectItem value="date" className="text-text-secondary text-xs">{t('action.advancedRuleTypes.date')}</SelectItem>
                          <SelectItem value="custom" className="text-text-secondary text-xs">{t('action.advancedRuleTypes.custom')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-text-tertiary">{t('action.ruleValue')}</Label>
                      <Input
                        value={rule.value}
                        onChange={(e) => updateAdvancedRule(action.id, rule.id, 'value', e.target.value)}
                        className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-xs"
                        placeholder={t('action.ruleValuePlaceholder')}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {(action.config?.advancedRules || []).length === 0 && (
              <div className="text-center text-text-tertiary py-4 border border-dashed border-border-secondary rounded-lg">
                <Type className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('action.advancedRulesEmpty')}</p>
                <p className="text-xs mt-1">{t('action.advancedRulesEmptyDesc')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* 整体说明 */}
      {actions.length === 0 && (
        <div className="bg-bg-quaternary border border-border-secondary rounded-lg p-4">
          <h4 className="text-base font-medium text-text-primary mb-4 flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            {processTarget === 'files' ? t('action.configGuide.files') : t('action.configGuide.folders')}
          </h4>
          <div className="space-y-2 text-xs text-text-tertiary">
            {processTarget === 'files' ? (
              <>
                <p>• <strong>{t('action.guide.files.classification')}</strong></p>
                <p>• <strong>{t('action.guide.files.naming')}</strong></p>
                <p>• <strong>{t('action.guide.files.filtering')}</strong></p>
                <p>• <strong>{t('action.guide.files.preview')}</strong></p>
              </>
            ) : (
              <>
                <p>• <strong>{t('action.guide.folders.organization')}</strong></p>
                <p>• <strong>{t('action.guide.folders.cleanup')}</strong></p>
                <p>• <strong>{t('action.guide.folders.structure')}</strong></p>
                <p>• <strong>{t('action.guide.folders.preview')}</strong></p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 动作列表 */}
      {actions.map((action, index) => {
        const typeConfig = getActionTypeConfig(t, processTarget, action.type)
        const Icon = typeConfig.icon

        const isCollapsed = collapsedActions.has(action.id)

        return (
          <Card key={action.id} className="bg-bg-secondary border-border-secondary shadow-lg backdrop-blur-sm">
            <CardHeader className={`${isCollapsed ? 'py-3' : 'pb-3'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  {/* 组合的序号+箭头按钮 */}
                  <div
                    className="flex items-center cursor-pointer hover:bg-bg-tertiary/50 rounded-md p-1 transition-colors"
                    onClick={() => toggleCollapse(action.id)}
                  >
                    <Badge variant="outline" className="text-xs pr-1 flex items-center">
                      {index + 1}
                      {isCollapsed ? (
                        <ChevronDown className="w-3 h-3 ml-1" />
                      ) : (
                        <ChevronUp className="w-3 h-3 ml-1" />
                      )}
                    </Badge>
                  </div>

                  <Icon className="w-5 h-5 text-text-secondary" />
                  <div>
                    <h4 className="text-base font-medium text-text-primary">{typeConfig.label}</h4>
                    <p className="text-xs text-text-tertiary">{typeConfig.description}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1 ml-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      duplicateAction(action)
                    }}
                    className="p-1 h-6 w-6"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteAction(action.id)
                    }}
                    className="p-1 h-6 w-6 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="space-y-3">
              {/* 动作类型选择 */}
              <div className="space-y-2">
                <Label className="text-text-secondary">{t('action.actionType')}</Label>
                <Select
                  value={action.type}
                  onValueChange={(value) => updateAction(action.id, 'type', value)}
                >
                  <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-bg-tertiary border-border-secondary">
                    {getActionTypes(t, processTarget).map(type => (
                      <SelectItem key={type.value} value={type.value} className="text-text-secondary">
                        <div className="flex items-center space-x-2">
                          <type.icon className="w-4 h-4" />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 子文件夹处理配置 */}
              <div className="space-y-3 bg-bg-quaternary border border-border-secondary rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-text-secondary font-medium">{t('action.subfolderProcessing')}</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`processSubfolders-${action.id}`}
                      checked={action.config?.processSubfolders !== false}
                      onChange={(e) => updateActionConfig(action.id, 'processSubfolders', e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <Label htmlFor={`processSubfolders-${action.id}`} className="text-text-secondary text-sm cursor-pointer">
                      {t('action.includeSubfolders')}
                    </Label>
                  </div>
                </div>

                {action.config?.processSubfolders !== false && (
                  <div className="space-y-2">
                    <Label className="text-text-secondary text-sm">{t('action.maxDepth')}</Label>
                    <Select
                      value={action.config?.maxDepth?.toString() || '-1'}
                      onValueChange={(value) => updateActionConfig(action.id, 'maxDepth', parseInt(value))}
                    >
                      <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-bg-tertiary border-border-secondary">
                        <SelectItem value="-1" className="text-text-secondary">{t('action.allLevels')}</SelectItem>
                        <SelectItem value="1" className="text-text-secondary">{t('action.level1')}</SelectItem>
                        <SelectItem value="2" className="text-text-secondary">{t('action.level2')}</SelectItem>
                        <SelectItem value="3" className="text-text-secondary">{t('action.level3')}</SelectItem>
                        <SelectItem value="4" className="text-text-secondary">{t('action.level4')}</SelectItem>
                        <SelectItem value="5" className="text-text-secondary">{t('action.level5')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-text-tertiary">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                        <div className="text-blue-700 dark:text-blue-300">
                          {getDepthDescription(action.config?.maxDepth || -1, processTarget || 'files', t)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 路径配置 */}
              {renderPathSelector(action)}



              {/* 命名规则配置 */}
              {renderNamingConfig(action)}





              {/* 删除配置 */}
              {action.type === 'delete' && processTarget !== 'files' && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={action.config?.deleteNonEmptyFolders || false}
                      onChange={(e) => updateActionConfig(action.id, 'deleteNonEmptyFolders', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <Label className="text-red-300">{t('action.deleteNonEmptyFolders')}</Label>
                  </div>
                </div>
              )}

              {/* 删除提示 */}
              {action.type === 'delete' && (
                <div className="p-3 bg-blue-900/20 dark:bg-blue-900/20 bg-blue-100/50 border border-blue-500/30 dark:border-blue-500/30 border-blue-400/40 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-400 dark:bg-blue-400 bg-blue-500 rounded-full"></div>
                    <span className="text-blue-300 dark:text-blue-300 text-blue-700 text-sm font-medium">{t('action.deleteRecycleTip')}</span>
                  </div>
                </div>
              )}
            </CardContent>
            )}
          </Card>
        )
      })}

      {/* 添加动作按钮 */}
      <Button
        variant="outline"
        onClick={addAction}
        className="w-full bg-bg-tertiary border-border-secondary hover:bg-bg-quaternary"
      >
        <Plus className="w-4 h-4 mr-2" />
{t('action.addAction')}
      </Button>

      {/* 动作说明 */}
      {actions.length === 0 && (
        <div className="text-center text-text-tertiary py-8">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t('action.noActions')}</p>
          <p className="text-xs mt-2">{t('action.noActionsDesc')}</p>
        </div>
      )}


    </div>
  )
}
