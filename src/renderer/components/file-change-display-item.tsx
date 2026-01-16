import React from 'react'
import { FileText, Folder, Edit3, Trash2, Copy, Plus, Move } from 'lucide-react'
import type { FileChange, FileChangeType } from '../../shared/types'
import { useLanguage } from '../contexts/language-context'
import { translateErrorMessage } from '../utils/error-translation'

interface FileChangeDisplayItemProps {
  change: FileChange
  isPreview?: boolean
  isMobile?: boolean
}

export function FileChangeDisplayItem({ change, isPreview = false, isMobile = false }: FileChangeDisplayItemProps) {
  const { t, language } = useLanguage()

  // 根据文件变化类型获取图标和样式
  const getChangeTypeInfo = (changeType: FileChangeType, isPreview: boolean = false) => {
    switch (changeType) {
      case 'modified':
        return {
          icon: Edit3,
          label: isPreview ? t('workspace.contentWillBeModified') : t('workspace.contentModified'),
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-200 dark:border-blue-500/30'
        }
      case 'deleted':
        return {
          icon: Trash2,
          label: isPreview ? t('workspace.willBeDeleted') : t('workspace.deleted'),
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-200 dark:border-red-500/30'
        }
      case 'copied':
        return {
          icon: Copy,
          label: isPreview ? t('workspace.willBeCopied') : t('workspace.copied'),
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-200 dark:border-green-500/30'
        }
      case 'created':
        return {
          icon: Plus,
          label: isPreview ? t('workspace.willBeCreated') : t('workspace.created'),
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-200 dark:border-emerald-500/30'
        }
      case 'moved':
        return {
          icon: Move,
          label: isPreview ? t('workspace.willBeMoved') : t('workspace.moved'),
          color: 'text-purple-500',
          bgColor: 'bg-purple-500/10',
          borderColor: 'border-purple-200 dark:border-purple-500/30'
        }
      case 'renamed':
        return {
          icon: Edit3,
          label: isPreview ? t('workspace.willBeRenamed') : t('workspace.renamed'),
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-200 dark:border-orange-500/30'
        }
      default:
        return {
          icon: FileText,
          label: t('workspace.changed'),
          color: 'text-gray-500',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-200 dark:border-gray-500/30'
        }
    }
  }

  const currentFile = change.file
  const originalFile = change.originalFile
  const changeTypeInfo = getChangeTypeInfo(change.type, isPreview)
  const ChangeIcon = changeTypeInfo.icon

  // 移动端使用更紧凑的样式
  const containerClass = isMobile 
    ? `rounded-lg p-2 border ${changeTypeInfo.bgColor} ${changeTypeInfo.borderColor}`
    : `rounded-lg p-3 border ${changeTypeInfo.bgColor} ${changeTypeInfo.borderColor}`
  
  const textSizeClass = isMobile ? 'text-xs' : 'text-xs'
  const iconSizeClass = isMobile ? 'w-3 h-3' : 'w-4 h-4'
  const spacingClass = isMobile ? 'mb-1' : 'mb-2'

  return (
    <div className={containerClass}>
      <div className={textSizeClass}>
        {/* 变化类型标识 */}
        <div className={`flex items-center space-x-2 ${spacingClass}`}>
          <ChangeIcon className={`${iconSizeClass} ${changeTypeInfo.color}`} />
          <span className={`font-medium ${changeTypeInfo.color} ${textSizeClass}`}>
            {changeTypeInfo.label}
          </span>
        </div>

        {/* 根据变化类型显示不同的内容 */}
        {change.type === 'deleted' && originalFile ? (
          // 删除操作：显示被删除的文件信息
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              {originalFile.isDirectory ? (
                <Folder className="w-3 h-3 text-text-tertiary" />
              ) : (
                <FileText className="w-3 h-3 text-text-tertiary" />
              )}
              <p className={`text-text-secondary font-medium truncate line-through ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {originalFile.name}
              </p>
            </div>
            {!isMobile && (
              <p className="text-text-tertiary text-xs truncate">
                {originalFile.path}
              </p>
            )}
          </div>
        ) : change.type === 'modified' && currentFile && originalFile ? (
          // 内容修改：显示文件信息，不显示路径变化
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              {currentFile.isDirectory ? (
                <Folder className="w-3 h-3 text-blue-500" />
              ) : (
                <FileText className="w-3 h-3 text-text-tertiary" />
              )}
              <p className={`text-text-secondary font-medium truncate ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {currentFile.name}
              </p>
            </div>
            {!isMobile && (
              <p className="text-text-tertiary text-xs truncate">
                {currentFile.path}
              </p>
            )}
          </div>
        ) : change.type === 'created' && currentFile ? (
          // 创建操作：显示新文件信息
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              {currentFile.isDirectory ? (
                <Folder className="w-3 h-3 text-emerald-500" />
              ) : (
                <FileText className="w-3 h-3 text-text-tertiary" />
              )}
              <p className={`text-text-secondary font-medium truncate ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {currentFile.name}
              </p>
            </div>
            {!isMobile && (
              <p className="text-text-tertiary text-xs truncate">
                {currentFile.path}
              </p>
            )}
          </div>
        ) : change.type === 'renamed' && originalFile && currentFile ? (
          // 重命名操作：只显示文件名变化，不显示完整路径
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              {originalFile.isDirectory ? (
                <Folder className="w-3 h-3 text-text-tertiary" />
              ) : (
                <FileText className="w-3 h-3 text-text-tertiary" />
              )}
              <p className={`text-text-tertiary truncate ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {originalFile.name}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-text-tertiary">→</span>
              <p className={`font-medium truncate ${changeTypeInfo.color} ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {currentFile.name}
              </p>
            </div>
          </div>
        ) : (originalFile && currentFile) ? (
          // 移动、复制操作：显示路径变化
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              {originalFile.isDirectory ? (
                <Folder className="w-3 h-3 text-text-tertiary" />
              ) : (
                <FileText className="w-3 h-3 text-text-tertiary" />
              )}
              <p className={`text-text-tertiary truncate ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {isMobile ? originalFile.name : originalFile.path}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-text-tertiary">→</span>
              <p className={`font-medium truncate ${changeTypeInfo.color} ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {isMobile ? currentFile.name : currentFile.path}
              </p>
            </div>
          </div>
        ) : null}

        {/* 显示错误信息 */}
        {currentFile?.error && (
          <p className="text-red-400 mt-1 text-xs">
            {t('workspace.errorPrefix')}{translateErrorMessage(currentFile.error, language)}
          </p>
        )}
      </div>
    </div>
  )
}
