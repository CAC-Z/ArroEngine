import { useState } from "react"
import { Plus, ChevronDown, ChevronRight, Trash2, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Condition, ConditionGroup } from '@shared/types'
import { useLanguage } from '../../contexts/language-context'
import { getConditionFields } from './config/field-definitions'
import { getFileTypes } from './config/file-types'
import { getOperators } from './config/operator-definitions'

// 生成唯一ID的工具函数
const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

interface ConditionEditorProps {
  conditionGroup: ConditionGroup
  onChange: (conditionGroup: ConditionGroup) => void
  level?: number
  processTarget?: 'files' | 'folders' | 'all'
}


export function ConditionEditor({ conditionGroup, onChange, level = 0, processTarget }: ConditionEditorProps) {
  const { t } = useLanguage()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // 如果没有选择处理对象，显示提示信息
  if (!processTarget) {
    return (
      <div className="flex items-center justify-center h-full min-h-[350px] text-center">
        <p className="text-red-500 text-base font-medium">
          {t('condition.selectProcessTargetFirst')}
        </p>
      </div>
    )
  }

  // 获取字段类型
  const getFieldType = (field: string): string => {
    const conditionFields = getConditionFields(t, processTarget)
    const fieldConfig = conditionFields.find(f => f.value === field)
    return fieldConfig?.type || 'string'
  }

  // 获取可用操作符
  const getAvailableOperators = (field: string) => {
    const operators = getOperators(t)
    const fieldType = getFieldType(field)
    return operators[fieldType as keyof typeof operators] || operators.string
  }

  // 添加条件
  const addCondition = () => {
    // 根据处理目标选择默认字段
    let defaultField: Condition['field'] = 'fileName';
    let defaultOperator: Condition['operator'] = 'contains';
    let defaultValue: Condition['value'] = '';

    switch (processTarget) {
      case 'folders':
        defaultField = 'folderName';
        break;
      case 'all':
        defaultField = 'itemType';
        defaultValue = 'file';
        break;
      default:
        defaultField = 'fileName';
        break;
    }

    const isSizeField = ['fileSize', 'folderSize'].includes(defaultField as string)
    const isDateField = ['createdDate', 'modifiedDate'].includes(defaultField as string)

    const newCondition: Condition = {
      id: `condition-${generateId()}`,
      field: defaultField,
      operator: defaultOperator,
      value: defaultValue,
      enabled: true,
      // 为文件大小字段设置默认单位
      ...(isSizeField ? { sizeUnit: 'MB' as const } : {}),
      // 为日期字段设置默认配置
      ...(isDateField ? {
        dateType: 'absolute' as const
      } : {})
    }

    onChange({
      ...conditionGroup,
      conditions: [...conditionGroup.conditions, newCondition]
    })
  }

  // 添加条件组
  const addConditionGroup = () => {
    const newGroup: ConditionGroup = {
      id: `group-${generateId()}`,
      operator: 'AND',
      conditions: [],
      groups: []
    }

    onChange({
      ...conditionGroup,
      groups: [...(conditionGroup.groups || []), newGroup]
    })
  }

  // 更新条件
  const updateCondition = (conditionId: string, field: keyof Condition, value: any) => {
    onChange({
      ...conditionGroup,
      conditions: conditionGroup.conditions.map(condition =>
        condition.id === conditionId
          ? { ...condition, [field]: value }
          : condition
      )
    })
  }

  // 删除条件
  const deleteCondition = (conditionId: string) => {
    onChange({
      ...conditionGroup,
      conditions: conditionGroup.conditions.filter(condition => condition.id !== conditionId)
    })
  }

  // 更新子条件组
  const updateChildGroup = (groupId: string, updatedGroup: ConditionGroup) => {
    onChange({
      ...conditionGroup,
      groups: (conditionGroup.groups || []).map(group =>
        group.id === groupId ? updatedGroup : group
      )
    })
  }

  // 删除条件组
  const deleteConditionGroup = (groupId: string) => {
    onChange({
      ...conditionGroup,
      groups: (conditionGroup.groups || []).filter(group => group.id !== groupId)
    })
  }

  // 复制条件
  const duplicateCondition = (condition: Condition) => {
    const newCondition: Condition = {
      ...condition,
      id: `condition-${generateId()}`
    }

    onChange({
      ...conditionGroup,
      conditions: [...conditionGroup.conditions, newCondition]
    })
  }

  // 切换组展开状态
  const toggleGroupExpanded = (groupId: string | undefined) => {
    if (!groupId) return
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  // 渲染条件值输入框
  const renderValueInput = (condition: Condition) => {
    const fieldType = getFieldType(condition.field)

    if (condition.field === 'fileType' && condition.operator === 'in') {
      // 文件类型多选
      return (
        <Select
          value={String(condition.value)}
          onValueChange={(value) => updateCondition(condition.id, 'value', value)}
        >
          <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm">
            <SelectValue placeholder={t('condition.selectFileType')} />
          </SelectTrigger>
          <SelectContent className="bg-bg-tertiary border-border-secondary">
            {getFileTypes(t).map(type => (
              <SelectItem key={type.value} value={type.value} className="text-text-secondary">
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (condition.field === 'fileType') {
      // 文件类型单选
      return (
        <Select
          value={String(condition.value)}
          onValueChange={(value) => updateCondition(condition.id, 'value', value)}
        >
          <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm">
            <SelectValue placeholder={t('condition.selectFileType')} />
          </SelectTrigger>
          <SelectContent className="bg-bg-tertiary border-border-secondary">
            {getFileTypes(t).map(type => (
              <SelectItem key={type.value} value={type.value} className="text-text-secondary">
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (condition.field === 'itemType') {
      // 项目类型选择
      return (
        <Select
          value={String(condition.value)}
          onValueChange={(value) => updateCondition(condition.id, 'value', value)}
        >
          <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm">
            <SelectValue placeholder={t('condition.selectItemType')} />
          </SelectTrigger>
          <SelectContent className="bg-bg-tertiary border-border-secondary">
            <SelectItem value="file" className="text-text-secondary">
              {t('condition.itemType.file')}
            </SelectItem>
            <SelectItem value="folder" className="text-text-secondary">
              {t('condition.itemType.folder')}
            </SelectItem>
          </SelectContent>
        </Select>
      )
    }

    if (condition.field === 'folderIsEmpty') {
      // 布尔值选择 - 简化为直接选择状态
      return (
        <Select
          value={condition.value === true ? 'empty' : 'notEmpty'}
          onValueChange={(value) => updateCondition(condition.id, 'value', value === 'empty')}
        >
          <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm">
            <SelectValue placeholder={t('condition.selectFolderEmptyState')} />
          </SelectTrigger>
          <SelectContent className="bg-bg-tertiary border-border-secondary">
            <SelectItem value="empty" className="text-text-secondary">
              {t('condition.folderState.empty')}
            </SelectItem>
            <SelectItem value="notEmpty" className="text-text-secondary">
              {t('condition.folderState.notEmpty')}
            </SelectItem>
          </SelectContent>
        </Select>
      )
    }

    if (fieldType === 'date') {
      // 日期字段：支持绝对日期和相对日期
      const isRelativeDate = condition.dateType === 'relative';

      return (
        <div className="flex items-center space-x-1 w-full">
          {/* 日期类型选择 */}
          <Select
            value={condition.dateType || 'absolute'}
            onValueChange={(value: 'absolute' | 'relative') => {
              onChange({
                ...conditionGroup,
                conditions: conditionGroup.conditions.map(c =>
                  c.id === condition.id ? {
                    ...c,
                    dateType: value,
                    // 设置默认值
                    ...(value === 'relative' ? {
                      relativeDateValue: 7,
                      relativeDateUnit: 'days' as const,
                      relativeDateDirection: 'ago' as const,
                      value: '' // 清空绝对日期值
                    } : {
                      relativeDateValue: undefined,
                      relativeDateUnit: undefined,
                      relativeDateDirection: undefined
                    })
                  } : c
                )
              })
            }}
          >
            <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm w-20 min-w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-bg-tertiary border-border-secondary">
              <SelectItem value="absolute" className="text-text-secondary">{t('condition.dateType.absolute')}</SelectItem>
              <SelectItem value="relative" className="text-text-secondary">{t('condition.dateType.relative')}</SelectItem>
            </SelectContent>
          </Select>

          {/* 绝对日期输入 */}
          {!isRelativeDate && (
            <Input
              type="date"
              value={String(condition.value)}
              onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
              className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm flex-1"
            />
          )}

          {/* 相对日期配置 */}
          {isRelativeDate && (
            <>
              <Input
                type="number"
                min="1"
                value={condition.relativeDateValue || 7}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  onChange({
                    ...conditionGroup,
                    conditions: conditionGroup.conditions.map(c =>
                      c.id === condition.id ? { ...c, relativeDateValue: value } : c
                    )
                  })
                }}
                className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm w-16 text-center"
                placeholder="7"
              />

              <Select
                value={condition.relativeDateUnit || 'days'}
                onValueChange={(value: 'days' | 'weeks' | 'months' | 'years') => {
                  onChange({
                    ...conditionGroup,
                    conditions: conditionGroup.conditions.map(c =>
                      c.id === condition.id ? { ...c, relativeDateUnit: value } : c
                    )
                  })
                }}
              >
                <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm w-14 min-w-14">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-secondary">
                  <SelectItem value="days" className="text-text-secondary">{t('condition.relativeDateUnit.days')}</SelectItem>
                  <SelectItem value="weeks" className="text-text-secondary">{t('condition.relativeDateUnit.weeks')}</SelectItem>
                  <SelectItem value="months" className="text-text-secondary">{t('condition.relativeDateUnit.months')}</SelectItem>
                  <SelectItem value="years" className="text-text-secondary">{t('condition.relativeDateUnit.years')}</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={condition.relativeDateDirection || 'ago'}
                onValueChange={(value: 'ago' | 'within') => {
                  onChange({
                    ...conditionGroup,
                    conditions: conditionGroup.conditions.map(c =>
                      c.id === condition.id ? { ...c, relativeDateDirection: value } : c
                    )
                  })
                }}
              >
                <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm w-14 min-w-14">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-secondary">
                  <SelectItem value="ago" className="text-text-secondary">{t('condition.relativeDateDirection.ago')}</SelectItem>
                  <SelectItem value="within" className="text-text-secondary">{t('condition.relativeDateDirection.within')}</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      )
    }

    if (fieldType === 'number') {
      // 如果是文件大小字段，显示带单位的输入框
      if (condition.field === 'fileSize' || condition.field === 'folderSize') {
        return (
          <div className="flex space-x-2">
            <Input
              type="number"
              value={String(condition.value)}
              onChange={(e) => {
                const numValue = e.target.value === '' ? '' : Number(e.target.value);
                updateCondition(condition.id, 'value', numValue);
              }}
              className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm flex-1"
              placeholder={t('condition.enterValue')}
            />
            <Select
              value={condition.sizeUnit || 'MB'}
              onValueChange={(value: 'B' | 'KB' | 'MB' | 'GB') => {
                onChange({
                  ...conditionGroup,
                  conditions: conditionGroup.conditions.map(c =>
                    c.id === condition.id ? { ...c, sizeUnit: value } : c
                  )
                })
              }}
            >
              <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-bg-tertiary border-border-secondary">
                <SelectItem value="B" className="text-text-secondary">B</SelectItem>
                <SelectItem value="KB" className="text-text-secondary">KB</SelectItem>
                <SelectItem value="MB" className="text-text-secondary">MB</SelectItem>
                <SelectItem value="GB" className="text-text-secondary">GB</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )
      }

      // 其他数字字段的普通输入框
      return (
        <Input
          type="number"
          value={String(condition.value)}
          onChange={(e) => {
            const numValue = e.target.value === '' ? '' : Number(e.target.value);
            updateCondition(condition.id, 'value', numValue);
          }}
          className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm"
          placeholder={t('condition.enterValue')}
        />
      )
    }

    // 默认文本输入
    return (
      <Input
        value={String(condition.value)}
        onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
        className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm"
        placeholder={t('condition.enterConditionValue')}
      />
    )
  }

  const indentClass = level > 0 ? (level === 1 ? 'ml-4' : level === 2 ? 'ml-8' : level === 3 ? 'ml-12' : 'ml-16') : ''

  return (
    <div className={`space-y-1 ${indentClass}`}>
      {/* 说明文字 */}
      {level === 0 && conditionGroup.conditions.length === 0 && (!conditionGroup.groups || conditionGroup.groups.length === 0) && (
        <div className="bg-bg-quaternary border border-border-secondary rounded-lg p-3">
          <p className="text-xs text-text-secondary">
            💡 <strong>{processTarget === 'files' ? t('condition.explanation.files.title') : t('condition.explanation.folders.title')}</strong>
          </p>
          <ul className="text-xs text-text-tertiary mt-1 space-y-1">
            {processTarget === 'files' ? (
              <>
                <li>• {t('condition.explanation.files.noCondition')}</li>
                <li>• {t('condition.explanation.files.withCondition')}</li>
                <li>• {t('condition.explanation.files.examples')}</li>
                <li>• {t('condition.explanation.files.combination')}</li>
              </>
            ) : (
              <>
                <li>• {t('condition.explanation.folders.noCondition')}</li>
                <li>• {t('condition.explanation.folders.withCondition')}</li>
                <li>• {t('condition.explanation.folders.examples')}</li>
                <li>• {t('condition.explanation.folders.combination')}</li>
              </>
            )}
          </ul>
        </div>
      )}

      {/* 条件组操作符选择 */}
      {(conditionGroup.conditions.length > 1 || (conditionGroup.groups && conditionGroup.groups.length > 0)) && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-text-tertiary">{t('condition.relationship')}</span>
          <Select
            value={conditionGroup.operator}
            onValueChange={(value: 'AND' | 'OR') => onChange({ ...conditionGroup, operator: value })}
          >
            <SelectTrigger className="w-40 bg-bg-tertiary border-border-secondary text-text-secondary h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-bg-tertiary border-border-secondary">
              <SelectItem value="AND" className="text-text-secondary">{t('condition.relationship.and')}</SelectItem>
              <SelectItem value="OR" className="text-text-secondary">{t('condition.relationship.or')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 条件列表 */}
      {conditionGroup.conditions.map((condition, index) => (
        <Card key={condition.id} className="bg-bg-secondary border-border-secondary shadow-lg backdrop-blur-sm">
          <CardContent className="p-2">
            <div className="flex items-center gap-2">
              {/* 条件序号 */}
              <div className="flex-shrink-0">
                <Badge variant="outline" className="text-xs px-1.5 py-0.5 min-w-[20px] justify-center">
                  {index + 1}
                </Badge>
              </div>

              {/* 字段选择 */}
              <div className="min-w-[140px] max-w-[180px] flex-shrink-0 relative">
                <Select
                  value={condition.field}
                  onValueChange={(value) => {
                    // 检查当前操作符是否与新字段类型兼容
                    const availableOps = getAvailableOperators(value)
                    const currentOpCompatible = availableOps.some(op => op.value === condition.operator)

                    // 同时更新字段和操作符（如果需要）
                    const updatedCondition = {
                      ...condition,
                      field: value as Condition['field'],
                      operator: currentOpCompatible ? condition.operator : (availableOps[0]?.value || 'contains') as Condition['operator']
                    }

                    onChange({
                      ...conditionGroup,
                      conditions: conditionGroup.conditions.map(c =>
                        c.id === condition.id ? updatedCondition : c
                      )
                    })
                  }}
                >
                  <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-bg-tertiary border-border-secondary z-50">
                    {getConditionFields(t, processTarget).map(field => (
                      <SelectItem key={field.value} value={field.value} className="text-text-secondary">
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 操作符选择 */}
              <div className="w-40 flex-shrink-0">
                <Select
                  value={condition.operator}
                  onValueChange={(value) => updateCondition(condition.id, 'operator', value)}
                >
                  <SelectTrigger className="bg-bg-tertiary border-border-secondary text-text-secondary h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-bg-tertiary border-border-secondary">
                    {getAvailableOperators(condition.field).map(op => (
                      <SelectItem key={op.value} value={op.value} className="text-text-secondary">
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 条件值 */}
              <div className="flex-1 min-w-0">
                {renderValueInput(condition)}
              </div>

              {/* 操作按钮 */}
              <div className="flex-shrink-0 flex items-center space-x-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => duplicateCondition(condition)}
                  className="p-1 h-6 w-6"
                  title={t('condition.duplicateCondition')}
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteCondition(condition.id)}
                  className="p-1 h-6 w-6 text-red-400 hover:text-red-300"
                  title={t('condition.deleteCondition')}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* 子条件组 */}
      {conditionGroup.groups && conditionGroup.groups.length > 0 && conditionGroup.groups.map((group) => {
        const groupId = group.id || `group-${generateId()}`;
        return (
          <Card key={groupId} className="bg-bg-tertiary border-border-secondary shadow-lg backdrop-blur-sm">
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => toggleGroupExpanded(groupId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {expandedGroups.has(groupId) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span className="text-base font-medium text-text-primary">
                    {t('condition.conditionGroup', { count: group.conditions.length })}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {group.operator === 'AND' ? t('condition.relationship.and') : t('condition.relationship.or')}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConditionGroup(groupId);
                  }}
                  className="p-1 h-6 w-6 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
            {expandedGroups.has(groupId) && (
              <CardContent className="pt-0">
                <ConditionEditor
                  conditionGroup={group}
                  onChange={(updatedGroup) => updateChildGroup(groupId, updatedGroup)}
                  level={level + 1}
                  processTarget={processTarget}
                />
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* 添加按钮 */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={addCondition}
          className="bg-bg-tertiary border-border-secondary hover:bg-bg-quaternary h-8 text-sm"
        >
          <Plus className="w-3 h-3 mr-1" />
          {t('condition.addCondition')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={addConditionGroup}
          className="bg-bg-tertiary border-border-secondary hover:bg-bg-quaternary h-8 text-sm"
        >
          <Plus className="w-3 h-3 mr-1" />
          {t('condition.addConditionGroup')}
        </Button>
      </div>


    </div>
  )
}
