import { Upload, Play, Eye, FileText, Folder, Clock, CheckCircle, XCircle, AlertCircle, AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import type { AppFile, Workflow } from '@shared/types'
import { translateErrorMessage } from '../../utils/error-translation'
import { FileChangeDisplayItem } from '../file-change-display-item'
import { WorkspaceProvider, useWorkspace } from './WorkspaceProvider'

interface WorkflowWorkspaceViewProps {
  selectedWorkflowId?: string | null
  onWorkflowSelect?: (workflowId: string | null) => void
}

export function WorkflowWorkspaceView({
  selectedWorkflowId: initialWorkflowId,
  onWorkflowSelect,
}: WorkflowWorkspaceViewProps) {
  return (
    <WorkspaceProvider
      initialWorkflowId={initialWorkflowId}
      onWorkflowSelect={onWorkflowSelect}
    >
      <WorkspaceView />
    </WorkspaceProvider>
  )
}

function WorkspaceView() {
  const {
    t,
    language,
    fileGroups,
    setFileGroups,
    workflows,
    selectedWorkflowId,
    setSelectedWorkflowId,
    isRunning,
    workflowResult,
    setWorkflowResult,
    isLoadingWorkflows,
    isDragOver,
    setIsDragOver,
    isPreviewMode,
    setIsPreviewMode,
    maxItems,
    isProcessingFiles,
    mismatchWarning,
    setMismatchWarning,
    processingProgress,
    setProcessingProgress,
    workflowFilteredData,
    displayedChanges,
    handleDrop,
    handlePreview,
    handleExecute,
    handleCancelExecution,
    handleClearFiles,
    handleSelectFiles,
    handleSelectFolder,
    canExecuteDirectly,
    getWorkflowInputPath,
    shouldDisableFileSelection,
    onWorkflowSelect,
    ConfirmDialog,
  } = useWorkspace()


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />
      default:
        return <AlertCircle className="w-4 h-4 text-text-tertiary" />
    }
  }

  return (
    <div className="h-full p-6">
      <div className="grid grid-cols-1 xl:grid-cols-4 lg:grid-cols-3 gap-6 h-full">

        {/* 左侧：文件上传区域 */}
        <div className="lg:col-span-1">
          <Card className="h-full bg-bg-secondary border-border-primary shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-text-primary flex items-center text-lg font-semibold">
                <Upload className="w-5 h-5 mr-3 text-blue-400" />
                {t('workspace.selectFilesTab')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* 拖拽区域 */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${(() => {
                  if (!selectedWorkflowId) {
                    return 'border-border-secondary bg-bg-secondary/30 opacity-60 cursor-not-allowed'
                  }

                  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId)
                  const isDragDisabled = selectedWorkflow && shouldDisableFileSelection(selectedWorkflow)

                  if (isDragDisabled) {
                    return 'border-border-secondary bg-bg-secondary/30 opacity-60 cursor-not-allowed'
                  }

                  return isDragOver
                    ? 'border-blue-400 bg-gradient-to-br from-blue-900/30 to-blue-800/20 shadow-lg shadow-blue-500/20'
                    : 'border-border-secondary hover:border-border-primary hover:bg-bg-tertiary/50'
                })()
                  }`}
                onDrop={(() => {
                  if (!selectedWorkflowId) return undefined
                  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId)
                  const isDragDisabled = selectedWorkflow && shouldDisableFileSelection(selectedWorkflow)
                  return isDragDisabled ? undefined : handleDrop
                })()}
                onDragOver={(() => {
                  if (!selectedWorkflowId) return undefined
                  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId)
                  const isDragDisabled = selectedWorkflow && shouldDisableFileSelection(selectedWorkflow)
                  return isDragDisabled ? undefined : (e) => {
                    e.preventDefault()
                    setIsDragOver(true)
                  }
                })()}
                onDragLeave={(() => {
                  if (!selectedWorkflowId) return undefined
                  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId)
                  const isDragDisabled = selectedWorkflow && shouldDisableFileSelection(selectedWorkflow)
                  return isDragDisabled ? undefined : () => setIsDragOver(false)
                })()}
              >
                {/* 背景装饰 */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-transparent via-gray-700/10 to-gray-600/20 pointer-events-none" />

                <div className="relative z-10">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-all duration-300 ${!selectedWorkflowId
                    ? 'bg-bg-tertiary/30 text-text-tertiary'
                    : isDragOver
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-bg-tertiary/50 text-text-tertiary hover:bg-bg-quaternary/50 hover:text-text-secondary'
                    }`}>
                    <Folder className="w-8 h-8" />
                  </div>

                  <h3 className={`text-lg font-medium mb-2 transition-colors ${!selectedWorkflowId
                    ? 'text-text-tertiary'
                    : isDragOver ? 'text-blue-300' : 'text-text-secondary'
                    }`}>
                    {!selectedWorkflowId ? t('workspace.pleaseSelectRule') : t('workspace.dragDropArea')}
                  </h3>



                  {/* 选择按钮 */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {(() => {
                      const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId)
                      const isFileSelectionDisabled = !selectedWorkflowId || (selectedWorkflow && shouldDisableFileSelection(selectedWorkflow))

                      return (
                        <>
                          <Button
                            size="default"
                            variant="outline"
                            onClick={handleSelectFiles}
                            disabled={isFileSelectionDisabled}
                            className={`transition-all duration-200 shadow-md ${isFileSelectionDisabled
                              ? 'bg-bg-tertiary/30 border-border-secondary text-text-tertiary cursor-not-allowed opacity-50'
                              : 'bg-bg-tertiary/80 border-border-secondary hover:bg-bg-quaternary hover:border-border-primary text-text-secondary hover:text-text-primary hover:shadow-lg'
                              }`}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            {t('workspace.selectFilesButton')}
                          </Button>
                          <Button
                            size="default"
                            variant="outline"
                            onClick={handleSelectFolder}
                            disabled={isFileSelectionDisabled}
                            className={`transition-all duration-200 shadow-md ${isFileSelectionDisabled
                              ? 'bg-bg-tertiary/30 border-border-secondary text-text-tertiary cursor-not-allowed opacity-50'
                              : 'bg-bg-tertiary/80 border-border-secondary hover:bg-bg-quaternary hover:border-border-primary text-text-secondary hover:text-text-primary hover:shadow-lg'
                              }`}
                          >
                            <Folder className="w-4 h-4 mr-2" />
                            {t('workspace.selectFolderButton')}
                          </Button>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>



              {/* 工作流选择 */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <label className="text-base font-medium text-text-secondary">
                    {t('workspace.selectRule')}
                  </label>
                </div>
                {isLoadingWorkflows ? (
                  <div className="text-center text-text-tertiary py-6 bg-bg-tertiary/50 rounded-lg border border-border-secondary">
                    <div className="animate-spin w-5 h-5 border-2 border-text-tertiary border-t-transparent rounded-full mx-auto mb-2"></div>
                    {t('workspace.loadingRules')}
                  </div>
                ) : (
                  <Select value={selectedWorkflowId} onValueChange={(value) => {
                    // 完整的工作流切换处理
                    setSelectedWorkflowId(value)
                    setWorkflowResult(null) // 清除之前的结果
                    setIsPreviewMode(false) // 重置预览模式

                    // 清理文件状态，重置为待处理状态
                    setFileGroups(prev => prev.map(group => ({
                      ...group,
                      files: group.files.map(file => ({
                        ...file,
                        status: 'pending' as const,
                        error: undefined,
                        newPath: undefined
                      }))
                    })))

                    // 重置进度状态
                    setProcessingProgress({
                      current: 0,
                      total: 0,
                      currentFile: '',
                      canCancel: true
                    })

                    onWorkflowSelect?.(value)
                  }}>
                    <SelectTrigger className="bg-bg-tertiary/80 border-border-secondary text-text-secondary hover:bg-bg-quaternary/80 hover:border-border-primary transition-all duration-200 h-12 shadow-sm">
                      <SelectValue placeholder={t('workspace.selectRulePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent className="bg-bg-tertiary border-border-secondary shadow-xl">
                      {workflows.map((workflow) => (
                        <SelectItem
                          key={workflow.id}
                          value={workflow.id}
                          className="text-text-secondary focus:bg-bg-quaternary focus:text-text-primary hover:bg-bg-quaternary transition-colors"
                        >
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${workflow.enabled ? 'bg-green-400' : 'bg-text-tertiary'}`}></div>
                            <span>{workflow.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* 一键执行模式提示 */}
                {selectedWorkflowId && (() => {
                  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId)
                  if (!selectedWorkflow || !canExecuteDirectly(selectedWorkflow)) return null

                  const inputPath = getWorkflowInputPath(selectedWorkflow)
                  return (
                    <div className="bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-500/30 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">{t('workspace.oneClickMode')}</p>
                          <p className="text-xs text-blue-700 dark:text-blue-200/80 mt-1">
                            {t('workspace.oneClickModeDesc', { path: inputPath })}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-200/60 mt-1">
                            {t('workspace.oneClickModeHint')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* 操作按钮 */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    onClick={handlePreview}
                    disabled={!selectedWorkflowId || (fileGroups.length === 0 && !canExecuteDirectly(workflows.find(w => w.id === selectedWorkflowId) || {} as Workflow))}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 h-12 font-medium disabled:from-gray-600 disabled:to-gray-700 disabled:text-gray-400"
                  >
                    <Eye className="w-5 h-5 mr-2" />
                    {t('workspace.preview')}
                  </Button>

                  <Button
                    onClick={handleExecute}
                    disabled={!selectedWorkflowId || (fileGroups.length === 0 && !canExecuteDirectly(workflows.find(w => w.id === selectedWorkflowId) || {} as Workflow)) || isRunning}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 h-12 font-medium disabled:from-gray-600 disabled:to-gray-700 disabled:text-gray-400"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    {isRunning ? t('workspace.processing') : t('workspace.execute')}
                  </Button>
                </div>

                <div className="pt-2 border-t border-gray-600/30 dark:border-gray-400/35">
                  <Button
                    onClick={handleClearFiles}
                    variant="outline"
                    className="w-full bg-bg-tertiary/50 border-border-secondary hover:bg-bg-quaternary/70 hover:border-border-primary text-text-secondary hover:text-text-primary transition-all duration-200 h-10"
                  >
                    {t('workspace.clearFiles')}
                  </Button>
                </div>
              </div>

              {/* 文件统计 */}
              {fileGroups.length > 0 && (
                <div className="bg-gradient-to-r from-bg-tertiary to-bg-quaternary dark:from-gray-750 dark:to-gray-700 rounded-xl p-4 border border-border-secondary/50 shadow-inner">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full animate-pulse flex-shrink-0 ${workflowFilteredData.totalVisibleCount >= maxItems ? 'bg-red-400' :
                        workflowFilteredData.totalVisibleCount >= maxItems * 0.8 ? 'bg-yellow-400' :
                          'bg-green-400'
                        }`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col">
                          <span className="text-text-secondary font-medium text-sm">
                            {workflowFilteredData.isProcessed ?
                              t('workspace.selectedCountPending', { count: workflowFilteredData.totalVisibleCount }) :
                              t('workspace.selectedCount', { count: workflowFilteredData.totalVisibleCount })
                            }
                          </span>
                          <span className="text-text-tertiary text-xs">
                            {workflowFilteredData.visibleFileCount > 0 && t('workspace.fileCountUnit', { count: workflowFilteredData.visibleFileCount })}
                            {workflowFilteredData.visibleFileCount > 0 && workflowFilteredData.visibleFolderCount > 0 && ' • '}
                            {workflowFilteredData.visibleFolderCount > 0 && t('workspace.folderCountUnit', { count: workflowFilteredData.visibleFolderCount })}
                            {workflowFilteredData.totalVisibleCount > 0 && ` • ${t('workspace.limitInfo', { limit: maxItems })}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className={`font-bold text-xl ${workflowFilteredData.totalVisibleCount >= maxItems ? 'text-red-400' :
                        workflowFilteredData.totalVisibleCount >= maxItems * 0.8 ? 'text-yellow-400' :
                          'text-blue-400'
                        }`}>
                        {workflowFilteredData.totalVisibleCount}
                      </span>
                      <span className="text-text-tertiary text-sm">
                        {t('workspace.itemsUnit')}
                      </span>
                    </div>
                  </div>

                  {/* 来源统计概览卡片 */}
                  <div className="mb-3">
                    <div className="space-y-3 max-h-40 overflow-y-auto scrollbar-hide">
                      {(() => {
                        const MAX_DISPLAY_SOURCES = 4;
                        const displayGroups = fileGroups.slice(0, MAX_DISPLAY_SOURCES);
                        const remainingCount = Math.max(0, fileGroups.length - MAX_DISPLAY_SOURCES);

                        return (
                          <>
                            {displayGroups.map((group, groupIndex) => {
                              // 计算组内详细统计信息
                              const fileCount = group.files.filter(f => !f.isDirectory).length;
                              const folderCount = group.files.filter(f => f.isDirectory).length;
                              const totalCount = fileCount + folderCount;

                              // 文件类型统计（只统计文件，不包括文件夹）
                              const fileTypeStats = group.files
                                .filter(f => !f.isDirectory)
                                .reduce((acc, file) => {
                                  const ext = file.name.split('.').pop()?.toLowerCase() || 'no-ext';
                                  acc[ext] = (acc[ext] || 0) + 1;
                                  return acc;
                                }, {} as Record<string, number>);

                              // 按数量排序文件类型，取前3个
                              const topFileTypes = Object.entries(fileTypeStats)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 3);

                              // 优雅的路径截断
                              const formatPath = (path: string): string => {
                                if (path.length <= 45) return path;

                                const parts = path.split(/[/\\]/);
                                if (parts.length <= 2) {
                                  return '...' + path.slice(-42);
                                }

                                const fileName = parts[parts.length - 1];
                                const parentDir = parts[parts.length - 2];
                                const remaining = 42 - fileName.length - parentDir.length - 3; // 3 for ".../"

                                if (remaining > 0) {
                                  return `.../${parentDir}/${fileName}`;
                                } else {
                                  return '...' + path.slice(-42);
                                }
                              };

                              const displayPath = formatPath(group.rootPath);

                              return (
                                <div key={group.rootPath} className="bg-gradient-to-r from-bg-tertiary/50 to-bg-quaternary/30 rounded-xl p-4 border border-border-secondary/30 shadow-sm hover:shadow-md transition-all duration-200">
                                  {/* 来源路径头部 */}
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                                      <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                      <span className="text-xs text-text-primary font-medium truncate" title={group.rootPath}>
                                        {displayPath}
                                      </span>
                                    </div>
                                    <span className="text-xs text-blue-400 font-semibold bg-blue-500/10 px-2 py-1 rounded-md flex-shrink-0">
                                      {totalCount} {t('workspace.itemsUnit')}
                                    </span>
                                  </div>

                                  {/* 分类统计 */}
                                  <div className="flex items-center space-x-4 mb-3">
                                    {fileCount > 0 && (
                                      <div className="flex items-center space-x-1">
                                        <FileText className="w-3 h-3 text-green-500" />
                                        <span className="text-xs text-text-secondary">{t('workspace.files')}</span>
                                        <span className="text-xs text-green-400 font-medium">{fileCount}</span>
                                      </div>
                                    )}
                                    {folderCount > 0 && (
                                      <div className="flex items-center space-x-1">
                                        <Folder className="w-3 h-3 text-blue-500" />
                                        <span className="text-xs text-text-secondary">{t('workspace.folders')}</span>
                                        <span className="text-xs text-blue-400 font-medium">{folderCount}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* 文件类型分布 */}
                                  {topFileTypes.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {topFileTypes.map(([ext, count]) => (
                                        <div key={ext} className="bg-bg-quaternary/60 px-2 py-1 rounded-md text-xs border border-border-secondary/20">
                                          <span className="text-text-secondary uppercase">{ext === 'no-ext' ? t('workspace.noExtension') : ext}</span>
                                          <span className="text-blue-400 ml-1 font-medium">×{count}</span>
                                        </div>
                                      ))}
                                      {Object.keys(fileTypeStats).length > 3 && (
                                        <div className="bg-bg-quaternary/40 px-2 py-1 rounded-md text-xs border border-border-secondary/10">
                                          <span className="text-text-tertiary">+{Object.keys(fileTypeStats).length - 3} {t('workspace.moreTypes')}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* 显示剩余来源汇总 */}
                            {remainingCount > 0 && (
                              <div className="bg-bg-quaternary/20 rounded-lg p-3 border border-border-secondary/20 border-dashed">
                                <div className="flex items-center justify-center space-x-2">
                                  <AlertCircle className="w-4 h-4 text-amber-500" />
                                  <span className="text-xs text-text-secondary">
                                    {t('workspace.andMoreSources', { count: remainingCount })}
                                  </span>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 执行结果统计 */}
                  {workflowResult && (
                    <div className="pt-3 border-t border-border-secondary/20 dark:border-border-secondary/10">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <div className="flex items-center space-x-1 bg-green-500/10 px-2 py-1 rounded-md">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span className="text-text-tertiary">{t('workspace.successLabel')}</span>
                          <span className="text-green-400 font-medium">{workflowResult.processedFiles}</span>
                        </div>
                        <div className="flex items-center space-x-1 bg-blue-500/10 px-2 py-1 rounded-md">
                          <Clock className="w-3 h-3 text-blue-400" />
                          <span className="text-text-tertiary">{t('workspace.durationLabel')}</span>
                          <span className="text-blue-400 font-medium">{workflowResult.duration}ms</span>
                        </div>
                        {workflowResult.errors.length > 0 && (
                          <div className="flex items-center space-x-1 bg-red-500/10 px-2 py-1 rounded-md">
                            <XCircle className="w-3 h-3 text-red-400" />
                            <span className="text-text-tertiary">{t('workspace.errorLabel')}</span>
                            <span className="text-red-400 font-medium">{t('workspace.errorCount', { count: workflowResult.errors.length })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}


                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 中间：文件列表 */}
        <div className="xl:col-span-2 lg:col-span-2 flex flex-col min-h-0">
          <Card className="h-full bg-bg-secondary border-border-primary flex flex-col min-h-0 shadow-lg backdrop-blur-sm">
            <CardHeader className="flex-shrink-0 pb-3">
              <CardTitle className="text-text-secondary flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                {t('workspace.fileListTab')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden p-4 pt-0">
              {isRunning ? (
                /* 进度显示区域 */
                <div className="flex items-center justify-center h-full">
                  <div className="w-full max-w-md">
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-8 h-8 text-blue-400 animate-spin" />
                      </div>
                      <h3 className="text-lg font-semibold text-text-secondary mb-2">{t('workspace.processingFiles')}</h3>
                      <p className="text-sm text-text-tertiary">{processingProgress.currentFile}</p>
                    </div>

                    <div className="space-y-4">
                      <Progress
                        value={(processingProgress.current / processingProgress.total) * 100}
                        className="w-full h-2"
                      />
                      <div className="flex justify-between text-sm text-text-tertiary">
                        <span>{processingProgress.current} / {processingProgress.total}</span>
                        <span>{Math.round((processingProgress.current / processingProgress.total) * 100)}%</span>
                      </div>
                    </div>

                    {processingProgress.canCancel && (
                      <div className="mt-6 text-center">
                        <Button
                          onClick={handleCancelExecution}
                          variant="outline"
                          size="sm"
                          className="text-red-400 border-red-400 hover:bg-red-400/10"
                        >
                          <X className="w-4 h-4 mr-2" />
                          {t('workspace.cancelProcessing')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : fileGroups.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    {mismatchWarning.show ? (
                      // 显示文件类型不匹配警告
                      <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 bg-orange-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertTriangle className="w-8 h-8 text-orange-400" />
                        </div>
                        <h3 className="text-lg font-medium text-text-primary mb-2">
                          {t('workspace.fileTypeMismatch')}
                        </h3>
                        <p className="text-text-secondary mb-2">{mismatchWarning.message}</p>
                        <p className="text-sm text-text-tertiary mb-4">{mismatchWarning.suggestion}</p>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMismatchWarning(prev => ({ ...prev, show: false }))}
                            className="text-text-secondary hover:text-text-primary"
                          >
                            {t('common.dismiss')}
                          </Button>
                          <p className="text-xs text-text-tertiary">
                            {t('workspace.switchWorkflowOrAddMatchingFiles')}
                          </p>
                        </div>
                      </div>
                    ) : (
                      // 默认空状态
                      <>
                        <FileText className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
                        <p className="text-text-tertiary">{t('workspace.noFiles')}</p>
                        <p className="text-sm text-text-tertiary mt-2">{t('workspace.dragToStart')}</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-0 overflow-y-auto">
                  <div className="space-y-2">
                    {workflowFilteredData.filesToShow
                      .sort((a, b) => {
                        // 按文件路径进行自然排序，确保显示顺序正确
                        return a.path.localeCompare(b.path, undefined, {
                          numeric: true,
                          sensitivity: 'base'
                        });
                      })
                      .map((file) => {
                        // 检查这个文件是否会被工作流处理
                        let willBeProcessed = false;
                        if (workflowResult && workflowResult.stepResults.length > 0) {
                          const allProcessedFiles = new Map();
                          workflowResult.stepResults.forEach(stepResult => {
                            stepResult.inputFiles.forEach(inputFile => {
                              allProcessedFiles.set(inputFile.id, inputFile);
                            });
                          });
                          willBeProcessed = allProcessedFiles.has(file.id);
                        }

                        return (
                          <div
                            key={file.id}
                            className={`flex items-center justify-between p-3 rounded-lg shadow-sm ${willBeProcessed
                              ? "bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border border-blue-200 dark:border-blue-500/30"
                              : workflowResult
                                ? "bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/30 dark:to-gray-700/20 border border-gray-200 dark:border-gray-600/30 opacity-60"
                                : "bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border border-blue-200 dark:border-blue-500/30"
                              }`}
                          >
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                {file.isDirectory ? (
                                  <Folder className="w-4 h-4 text-blue-500" />
                                ) : (
                                  <FileText className="w-4 h-4 text-text-tertiary" />
                                )}
                                {getStatusIcon(file.status)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-text-secondary truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-text-tertiary truncate">
                                  {file.path}
                                </p>
                                {file.isDirectory && (
                                  <p className="text-xs text-text-tertiary">
                                    {file.fileCount !== undefined && file.folderCount !== undefined ? (
                                      `${file.fileCount} ${t('workspace.files')}, ${file.folderCount} ${t('workspace.folders')}`
                                    ) : file.isEmpty ? (
                                      t('workspace.emptyFolder')
                                    ) : (
                                      t('workspace.folder')
                                    )}
                                  </p>
                                )}
                                {file.newPath && file.newPath !== file.path && (
                                  <p className="text-xs text-blue-400 truncate">
                                    → {file.newPath}
                                  </p>
                                )}
                                {file.error && (
                                  <p className="text-xs text-red-400">
                                    {t('workspace.errorPrefix')}{translateErrorMessage(file.error, language)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-text-tertiary">
                              {file.isDirectory ? t('workspace.folder').toUpperCase() : file.type.toUpperCase()}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* 移动端预览结果 - 在卡片内部显示，设置固定高度 */}
              {workflowResult && (
                <div className="xl:hidden mt-4 border-t border-border-secondary/20 pt-4">
                  <div className="flex items-center mb-3">
                    <Eye className="w-4 h-4 mr-2 text-blue-400" />
                    <h3 className="text-sm font-medium text-text-secondary">{t('workspace.previewResults')}</h3>
                  </div>

                  <div>
                    {/* 简化的统计信息 */}
                    <div className="bg-bg-tertiary rounded-lg p-3 mb-3">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-text-tertiary">{t('workspace.totalFilesShort')}</span>
                          <span className="text-text-secondary ml-1">{workflowResult.totalFiles}</span>
                        </div>
                        <div>
                          <span className="text-text-tertiary">{t('workspace.processedShort')}</span>
                          <span className="text-green-400 ml-1">{workflowResult.processedFiles}</span>
                        </div>
                        <div>
                          <span className="text-text-tertiary">{t('workspace.errorsShort')}</span>
                          <span className="text-red-400 ml-1">{workflowResult.errors.length}</span>
                        </div>
                        <div>
                          <span className="text-text-tertiary">{t('workspace.stepsShort')}</span>
                          <span className="text-blue-400 ml-1">{workflowResult.stepResults.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* 主要变化预览 */}
                    <div className="space-y-2">
                      {(() => {
                        // 使用新的 changes 数组，显示前3个变化
                        const changedFiles = workflowResult.changes ? workflowResult.changes.slice(0, 3) : [];

                        // 如果没有变化的文件，显示友好提示
                        if (changedFiles.length === 0) {
                          return (
                            <div key="no-changes" className="flex items-center justify-center py-6">
                              <div className="text-center">
                                <div className="w-12 h-12 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                  <AlertCircle className="w-6 h-6 text-yellow-400" />
                                </div>
                                <p className="text-text-secondary font-medium text-sm mb-2">{t('workspace.noMatchingFiles')}</p>
                                <p className="text-text-tertiary text-xs">
                                  {t('workspace.workflowStepMismatch')}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        return changedFiles.map((change) => (
                          <FileChangeDisplayItem
                            key={`mobile-${change.stepId}-${change.file?.id || change.originalFile?.id || Math.random()}`}
                            change={change}
                            isPreview={true}
                            isMobile={true}
                          />
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>

          </Card>
        </div>

        {/* 右侧：预览区域 */}
        <div className="xl:col-span-1 lg:hidden xl:block flex flex-col">
          <Card className="h-full bg-bg-secondary border-border-primary flex flex-col shadow-lg backdrop-blur-sm">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="text-text-secondary flex items-center">
                <Eye className="w-5 h-5 mr-2" />
                {t('workspace.previewResults')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden px-6 pt-2 pb-6">
              {!workflowResult ? (
                <div className="flex items-center justify-center flex-1 min-h-0">
                  <div className="text-center">
                    <Eye className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
                    <p className="text-text-tertiary">{t('workspace.noPreview')}</p>
                    <p className="text-sm text-text-tertiary mt-2">{t('workspace.clickPreview')}</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col space-y-3">
                  {/* 文件变化预览 */}
                  <div className="flex-shrink-0" style={{ height: '49vh' }}>
                    <h4 className="text-sm font-medium text-text-secondary mb-1">
                      {isPreviewMode ? t('workspace.previewChanges') : t('workspace.executionResults')}
                    </h4>
                    <div className="space-y-2 overflow-y-auto scrollbar-hide" style={{ height: 'calc(49vh - 2rem)' }}>
                      {(() => {
                        // 统一的渲染逻辑：检查是否有显示的变化
                        if (displayedChanges.length === 0) {
                          return (
                            <div className="flex items-center justify-center py-8">
                              <div className="text-center">
                                <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <AlertCircle className="w-8 h-8 text-yellow-400" />
                                </div>
                                <p className="text-text-secondary font-medium mb-2">
                                  {isPreviewMode ? t('workspace.noMatchingFiles') : t('workspace.noProcessingResult')}
                                </p>
                                <p className="text-text-tertiary text-sm">
                                  {isPreviewMode ? t('workspace.workflowStepMismatch') : t('workspace.workflowCompleteNoFiles')}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        // 渲染文件变化列表
                        return displayedChanges.map((change) => (
                          <FileChangeDisplayItem
                            key={`${isPreviewMode ? 'preview' : 'exec'}-${change.stepId}-${change.file?.id || change.originalFile?.id || Math.random()}`}
                            change={change}
                            isPreview={isPreviewMode}
                            isMobile={false}
                          />
                        ));
                      })()}
                      {(() => {
                        // 使用新的 changes 数组获取总变化数
                        const totalChangedFiles = workflowResult.changes ? workflowResult.changes.length : 0;
                        const displayedFiles = isPreviewMode ? 3 : 20; // 预览模式显示3个，详细模式显示20个
                        const remainingFiles = totalChangedFiles - displayedFiles;

                        return remainingFiles > 0 ? (
                          <div className="text-xs text-text-tertiary text-center py-2 border-t border-border-secondary/20">
                            ...{t('workspace.moreChanges', { count: remainingFiles })}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* 步骤结果 */}
                  <div className="flex-shrink-0" style={{ height: '20vh' }}>
                    <h4 className="text-sm font-medium text-text-secondary mb-2">{t('workspace.stepExecutionDetails')}</h4>
                    <div className="space-y-2 overflow-y-auto scrollbar-hide" style={{ height: 'calc(20vh - 2rem)' }}>
                      {workflowResult.stepResults.map((stepResult, index) => {
                        // 分别统计输入和输出的文件和文件夹数量
                        const inputFileCount = stepResult.inputFiles.filter(f => !f.isDirectory).length;
                        const inputFolderCount = stepResult.inputFiles.filter(f => f.isDirectory).length;
                        const outputFileCount = stepResult.outputFiles.filter(f => !f.isDirectory).length;
                        const outputFolderCount = stepResult.outputFiles.filter(f => f.isDirectory).length;

                        const findInputById = (fileId: string) =>
                          stepResult.inputFiles.find(inputFile => inputFile.id === fileId);

                        const isDirectoryItem = (file: AppFile) =>
                          file.isDirectory === true || file.type === 'folder';

                        const normalizePath = (value?: string | null) => value ? value.replace(/\\/g, '/') : '';
                        const getDirectory = (value?: string | null) => {
                          const normalized = normalizePath(value);
                          if (!normalized) return '';
                          const lastSeparatorIndex = normalized.lastIndexOf('/');
                          return lastSeparatorIndex === -1 ? '' : normalized.slice(0, lastSeparatorIndex);
                        };

                        const inferOperationType = (file: AppFile, inputMatch?: AppFile) => {
                          if (file.status === 'error') {
                            return 'error';
                          }

                          if (file.skipped) {
                            return 'skipped';
                          }

                          if (file.deleted || file.operationType === 'delete') {
                            return 'delete';
                          }

                          if (file.operationType === 'copy') {
                            return 'copy';
                          }

                          if (file.operationType === 'createFolder') {
                            return 'createFolder';
                          }

                          if (file.operationType === 'move') {
                            return 'move';
                          }

                          if (file.operationType === 'rename') {
                            return 'rename';
                          }

                          if (inputMatch) {
                            const targetPath = file.newPath || file.path;
                            if (targetPath && normalizePath(targetPath) !== normalizePath(inputMatch.path)) {
                              const sourceDir = getDirectory(inputMatch.path);
                              const targetDir = getDirectory(targetPath);
                              return sourceDir === targetDir ? 'rename' : 'move';
                            }
                          }

                          return null;
                        };

                        const summarizeStepOutputs = stepResult.outputFiles.map(file => {
                          const inputMatch = findInputById(file.id);
                          let detectedOperation = inferOperationType(file, inputMatch);

                          if (!detectedOperation && inputMatch) {
                            const targetPath = file.newPath || file.path;
                            if (targetPath && normalizePath(targetPath) !== normalizePath(inputMatch.path)) {
                              detectedOperation = 'move';
                            }
                          }

                          return {
                            file,
                            inputMatch,
                            operation: detectedOperation
                          };
                        });

                        const operationStats = {
                          rename: 0,
                          move: 0,
                          copy: 0,
                          delete: 0,
                          createFolder: 0,
                          other: 0,
                          skipped: 0,
                          errors: 0
                        };

                        summarizeStepOutputs.forEach(summary => {
                          switch (summary.operation) {
                            case 'rename':
                              operationStats.rename += 1;
                              break;
                            case 'move':
                              operationStats.move += 1;
                              break;
                            case 'copy':
                              operationStats.copy += 1;
                              break;
                            case 'delete':
                              operationStats.delete += 1;
                              break;
                            case 'createFolder':
                              operationStats.createFolder += 1;
                              break;
                            case 'skipped':
                              operationStats.skipped += 1;
                              break;
                            case 'error':
                              operationStats.errors += 1;
                              break;
                            case null:
                            default:
                              break;
                          }
                        });

                        const processedSummaries = summarizeStepOutputs.filter(summary =>
                          Boolean(summary.operation) &&
                          summary.operation !== 'skipped' &&
                          summary.operation !== 'error'
                        );

                        const processedFileCount = processedSummaries.filter(
                          summary => !isDirectoryItem(summary.file)
                        ).length;

                        const processedFolderCount = processedSummaries.filter(
                          summary => isDirectoryItem(summary.file)
                        ).length;

                        const operationBreakdown = [
                          { key: 'rename', label: t('history.details.operation.rename'), value: operationStats.rename },
                          { key: 'move', label: t('history.details.operation.move'), value: operationStats.move },
                          { key: 'copy', label: t('history.details.operation.copy'), value: operationStats.copy },
                          { key: 'delete', label: t('history.details.operation.delete'), value: operationStats.delete },
                          { key: 'createFolder', label: t('history.details.operation.createFolder'), value: operationStats.createFolder }
                        ].filter(item => item.value > 0);

                        const workflowStepDefinition = workflows
                          .find(workflow => workflow.id === workflowResult.workflowId)
                          ?.steps.find(step => step.id === stepResult.stepId);

                        const enabledActions = workflowStepDefinition
                          ? workflowStepDefinition.actions.filter(action => action.enabled)
                          : [];

                        const actionLabels = enabledActions.map(action => t(`action.type.${action.type}`));

                        const formatPathForDisplay = (value?: string | null) => {
                          if (!value) return '-';
                          const normalized = normalizePath(value);
                          if (normalized.length <= 48) {
                            return normalized;
                          }
                          return `...${normalized.slice(-48)}`;
                        };

                        const operationLabels: Record<string, string> = {
                          rename: t('history.details.operation.rename'),
                          move: t('history.details.operation.move'),
                          copy: t('history.details.operation.copy'),
                          delete: t('history.details.operation.delete'),
                          createFolder: t('history.details.operation.createFolder'),
                          other: t('workspace.stepOperationOther')
                        };

                        const sampleChanges = processedSummaries.slice(0, 2);

                        return (
                          <div key={index} className="bg-bg-tertiary rounded-lg p-3">
                            <h5 className="text-xs font-medium text-text-secondary mb-2">
                              {t('workspace.stepNumber', { number: index + 1, name: stepResult.stepName })}
                            </h5>
                            <div className="text-xs text-text-tertiary space-y-2">
                              <div>
                                <span className="text-text-secondary">{t('workspace.input')}:</span>{' '}
                                {inputFileCount === 0 && inputFolderCount === 0 ? (
                                  <span className="text-yellow-400">{t('workspace.none')}</span>
                                ) : (
                                  <>
                                    {inputFileCount > 0 && <span>{inputFileCount} {t('workspace.files')}</span>}
                                    {inputFileCount > 0 && inputFolderCount > 0 && <span>, </span>}
                                    {inputFolderCount > 0 && <span>{inputFolderCount} {t('workspace.folders')}</span>}
                                  </>
                                )}
                              </div>

                              <div>
                                <span className="text-text-secondary">{t('workspace.output')}:</span>{' '}
                                {outputFileCount === 0 && outputFolderCount === 0 ? (
                                  <span className="text-yellow-400">{t('workspace.none')}</span>
                                ) : (
                                  <>
                                    {outputFileCount > 0 && <span>{outputFileCount} {t('workspace.files')}</span>}
                                    {outputFileCount > 0 && outputFolderCount > 0 && <span>, </span>}
                                    {outputFolderCount > 0 && <span>{outputFolderCount} {t('workspace.folders')}</span>}
                                  </>
                                )}
                              </div>

                              <div>
                                <span className="text-text-secondary">{t('workspace.processed')}:</span>{' '}
                                {processedFileCount === 0 && processedFolderCount === 0 ? (
                                  <span className="text-yellow-400">{t('workspace.none')}</span>
                                ) : (
                                  <>
                                    {processedFileCount > 0 && <span>{processedFileCount} {t('workspace.files')}</span>}
                                    {processedFileCount > 0 && processedFolderCount > 0 && <span>, </span>}
                                    {processedFolderCount > 0 && <span>{processedFolderCount} {t('workspace.folders')}</span>}
                                  </>
                                )}
                              </div>

                              <div>
                                <span className="text-text-secondary">{t('workspace.stepActionsLabel')}:</span>{' '}
                                {actionLabels.length > 0 ? (
                                  <span>{actionLabels.join(' / ')}</span>
                                ) : (
                                  <span className="text-yellow-400">{t('workspace.stepNoActions')}</span>
                                )}
                              </div>

                              <div>
                                <span className="text-text-secondary">{t('workspace.stepOperationsLabel')}:</span>
                                {operationBreakdown.length === 0 ? (
                                  <span> {t('workspace.stepNoChanges')}</span>
                                ) : (
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
                                    {operationBreakdown.map(item => (
                                      <div key={item.key}>
                                        <span>{item.label}</span>
                                        <span className="text-text-secondary ml-1">{item.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {operationStats.skipped > 0 && (
                                <div className="text-yellow-400">
                                  {t('workspace.stepSkippedLabel')} {operationStats.skipped}
                                </div>
                              )}

                              {stepResult.errors.length > 0 && (
                                <div className="text-red-400">
                                  {t('workspace.stepErrorsLabel')} {stepResult.errors.length}
                                </div>
                              )}

                              <div>
                                <span className="text-text-secondary">{t('workspace.stepSamplesLabel')}:</span>
                                {sampleChanges.length === 0 ? (
                                  <span> {t('workspace.stepNoChanges')}</span>
                                ) : (
                                  <ul className="mt-1 space-y-1">
                                    {sampleChanges.map((summary, sampleIndex) => {
                                      const operationKey = summary.operation ?? 'other';
                                      const label = operationLabels[operationKey] || operationLabels.other;
                                      const sourcePath = summary.inputMatch?.path || summary.inputMatch?.name || '';
                                      const targetPath = summary.file.newPath || summary.file.path;
                                      let detail = '';

                                      switch (summary.operation) {
                                        case 'rename':
                                          detail = `${summary.inputMatch?.name || summary.file.name} -> ${summary.file.name}`;
                                          break;
                                        case 'move':
                                          detail = `${formatPathForDisplay(sourcePath)} -> ${formatPathForDisplay(targetPath)}`;
                                          break;
                                        case 'copy':
                                          detail = `${formatPathForDisplay(sourcePath)} => ${formatPathForDisplay(targetPath)}`;
                                          break;
                                        case 'delete':
                                          detail = formatPathForDisplay(sourcePath);
                                          break;
                                        case 'createFolder':
                                          detail = formatPathForDisplay(targetPath);
                                          break;
                                        default:
                                          detail = formatPathForDisplay(targetPath || sourcePath);
                                          break;
                                      }

                                      return (
                                        <li key={sampleIndex} className="flex items-center">
                                          <span className="text-text-secondary mr-2">• {label}</span>
                                          <span className="truncate">{detail}</span>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <ConfirmDialog />
    </div>
  )
}
