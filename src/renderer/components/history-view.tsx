import { useState, useEffect } from "react"
import { Search, CheckCircle, XCircle, Trash2, RefreshCw, Clock, FileText, X, Undo2, Redo2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import type { HistoryEntry } from "@shared/types"
import { useLanguage } from "../contexts/language-context"
import { translateErrorMessage } from "../utils/error-translation"

// 操作类型转换为显示文本（现在使用翻译）
const getOperationTypeText = (operation: 'move' | 'copy' | 'rename' | 'delete' | 'createFolder' | 'cleanup_empty_folder', t: (key: string) => string): string => {
  switch (operation) {
    case 'move':
      return t('history.details.operation.move');
    case 'copy':
      return t('history.details.operation.copy');
    case 'rename':
      return t('history.details.operation.rename');
    case 'delete':
      return t('history.details.operation.delete');
    case 'createFolder':
      return t('history.details.operation.createFolder');
    case 'cleanup_empty_folder':
      return t('history.details.operation.cleanup_empty_folder');
    default:
      return t('common.error');
  }
};

// 监控来源转换为显示文本（使用翻译）
const getSourceText = (source?: 'manual' | 'file_watch' | 'scheduled', t?: (key: string) => string): string => {
  if (!t) return source || 'manual';

  switch (source) {
    case 'file_watch':
      return t('history.source.fileWatch');
    case 'scheduled':
      return t('history.source.scheduled');
    case 'manual':
    default:
      return t('history.source.manual');
  }
};

// 获取来源颜色
const getSourceColor = (source?: 'manual' | 'file_watch' | 'scheduled'): string => {
  switch (source) {
    case 'file_watch':
      return 'bg-blue-900/30 text-blue-400';
    case 'scheduled':
      return 'bg-purple-900/30 text-purple-400';
    case 'manual':
    default:
      return 'bg-bg-primary/30 text-text-tertiary';
  }
};

export function HistoryView() {
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [filteredEntries, setFilteredEntries] = useState<HistoryEntry[]>([])
  const [hasLoaded, setHasLoaded] = useState(false) // 标记是否已经加载过数据

  // 处理日志悬浮框状态
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null)
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)

  // 确认对话框
  const { showConfirm, ConfirmDialog } = useConfirmDialog()

  // 翻译
  const { t, language } = useLanguage()

  // 加载历史记录
  const loadHistory = async (showLoadingState = true) => {
    try {
      if (showLoadingState) {
        setIsLoading(true)
      }
      const entries = await window.electronAPI.getAllHistory()
      setHistoryEntries(entries)
      setFilteredEntries(entries)
      setHasLoaded(true) // 标记已加载
    } catch (error) {
      console.error('Failed to load history:', error)
      setHasLoaded(true) // 即使失败也标记为已加载
    } finally {
      if (showLoadingState) {
        setIsLoading(false)
      }
    }
  }

  // 搜索历史记录
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.trim() === '') {
      setFilteredEntries(historyEntries)
    } else {
      try {
        const results = await window.electronAPI.searchHistory(query)
        setFilteredEntries(results)
      } catch (error) {
        console.error('Failed to search history:', error)
      }
    }
  }

  // 清空历史记录
  const handleClearHistory = () => {
    showConfirm({
      title: t('history.clearConfirmTitle'),
      description: t('history.clearConfirmDesc'),
      variant: 'destructive',
      confirmText: t('history.clear'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        try {
          await window.electronAPI.clearHistory()
          setHistoryEntries([])
          setFilteredEntries([])
        } catch (error) {
          console.error('Failed to clear history:', error)
        }
      }
    })
  }

  // 打开处理日志
  const handleShowProcessLog = (entry: HistoryEntry) => {
    setSelectedEntry(entry)
    setIsLogModalOpen(true)
  }

  // 关闭处理日志
  const handleCloseProcessLog = () => {
    setIsLogModalOpen(false)
    setSelectedEntry(null)
  }

  // 删除单条历史记录
  const handleDeleteEntry = (entryId: string) => {
    showConfirm({
      title: t('history.deleteConfirmTitle'),
      description: t('history.deleteConfirmDesc'),
      variant: 'destructive',
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      onConfirm: async () => {
        try {
          await window.electronAPI.deleteHistoryEntry(entryId)
          const updatedEntries = historyEntries.filter(entry => entry.id !== entryId)
          setHistoryEntries(updatedEntries)
          setFilteredEntries(updatedEntries.filter(entry =>
            searchQuery === '' ||
            entry.workflowName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entry.fileOperations.some(op =>
              op.originalName.toLowerCase().includes(searchQuery.toLowerCase())
            )
          ))
        } catch (error) {
          console.error('Failed to delete history entry:', error)
        }
      }
    })
  }

  // 撤销历史记录操作
  const handleUndoEntry = async (entryId: string) => {
    const entry = historyEntries.find(e => e.id === entryId);
    if (!entry) return;

    // 检查是否包含复制操作
    const hasCopyOperation = entry.fileOperations.some(op => op.operation === 'copy' && op.status === 'success');

    // 如果包含复制操作，显示特殊的警告对话框
    if (hasCopyOperation) {
      showConfirm({
        title: '确认撤销复制操作',
        description: '此操作将会删除通过复制创建的文件或文件夹，且无法从回收站恢复。您确定要继续吗？',
        variant: 'destructive',
        confirmText: '确定删除',
        cancelText: '取消',
        onConfirm: async () => {
          await performUndo(entryId);
        }
      });
      return;
    }

    // 对于部分成功的记录，显示特殊的确认对话框
    if (entry.status === 'partial') {
      const successfulCount = entry.fileOperations.filter(op => op.status === 'success').length;
      const failedCount = entry.fileOperations.filter(op => op.status === 'error').length;

      showConfirm({
        title: '撤销部分成功的操作',
        description: `此工作流部分成功（${successfulCount} 个成功，${failedCount} 个失败）。撤销操作只会回滚成功的文件操作，失败的操作将保持不变。确定要继续吗？`,
        variant: 'destructive',
        confirmText: '确定撤销',
        cancelText: '取消',
        onConfirm: async () => {
          await performUndo(entryId);
        }
      });
      return;
    }

    // 对于完全成功的记录，直接执行撤销
    await performUndo(entryId);
  };

  // 执行撤销操作的实际逻辑
  const performUndo = async (entryId: string) => {
    try {
      const result = await window.electronAPI.undoHistoryEntry(entryId)
      if (result.success) {
        // 重新加载历史记录以更新状态
        await loadHistory(true)

        // 如果当前打开的处理日志对话框是被撤销的记录，需要更新它
        if (selectedEntry && selectedEntry.id === entryId) {
          const updatedEntries = await window.electronAPI.getHistory()
          const updatedEntry = updatedEntries.find(entry => entry.id === entryId)
          if (updatedEntry) {
            setSelectedEntry(updatedEntry)
          }
        }

        const successMessage = result.message || t('history.undoSuccessDesc')

        showConfirm({
          title: t('history.undoSuccessTitle'),
          description: successMessage,
          variant: 'default',
          confirmText: t('common.confirm'),
          onConfirm: () => {}
        })
      } else if (result.requiresChainUndo) {
        // 检测到连锁重命名冲突，提供连锁撤回选项
        showConfirm({
          title: '检测到连锁重命名冲突',
          description: `${result.message}\n\n是否使用连锁撤回功能自动处理依赖关系？`,
          variant: 'default',
          confirmText: '使用连锁撤回',
          cancelText: '取消',
          onConfirm: async () => {
            await performChainUndo(entryId);
          }
        })
      } else {
        showConfirm({
          title: t('history.undoFailedTitle'),
          description: result.message || t('history.undoFailedDesc'),
          variant: 'destructive',
          confirmText: t('common.confirm'),
          onConfirm: () => {}
        })
      }
    } catch (error) {
      console.error('Failed to undo operation:', error)
      showConfirm({
        title: t('history.undoFailedTitle'),
        description: t('history.undoFailedGeneric'),
        variant: 'destructive',
        confirmText: t('common.confirm'),
        onConfirm: () => {}
      })
    }
  }

  // 执行连锁撤回操作
  const performChainUndo = async (entryId: string) => {
    try {
      const result = await window.electronAPI.chainUndoHistoryEntry(entryId)
      if (result.success) {
        // 重新加载历史记录以更新状态
        await loadHistory(true)

        // 如果当前打开的处理日志对话框是被撤销的记录，需要更新它
        if (selectedEntry && selectedEntry.id === entryId) {
          const updatedEntries = await window.electronAPI.getHistory()
          const updatedEntry = updatedEntries.find(entry => entry.id === entryId)
          if (updatedEntry) {
            setSelectedEntry(updatedEntry)
          }
        }

        showConfirm({
          title: '连锁撤回成功',
          description: result.message || '连锁撤回操作已成功完成，所有相关文件已恢复到原始位置。',
          variant: 'default',
          confirmText: t('common.confirm'),
          onConfirm: () => {}
        })
      } else {
        showConfirm({
          title: '连锁撤回失败',
          description: result.message || '连锁撤回操作失败，请检查文件状态后手动恢复。',
          variant: 'destructive',
          confirmText: t('common.confirm'),
          onConfirm: () => {}
        })
      }
    } catch (error) {
      console.error('连锁撤回操作失败:', error)
      showConfirm({
        title: '连锁撤回失败',
        description: '连锁撤回操作失败，请检查文件状态后手动恢复。',
        variant: 'destructive',
        confirmText: t('common.confirm'),
        onConfirm: () => {}
      })
    }
  }

  // 重做历史记录操作
  const handleRedoEntry = async (entryId: string) => {
    try {
      const result = await window.electronAPI.redoHistoryEntry(entryId)
      if (result.success) {
        // 重新加载历史记录以更新状态
        await loadHistory(true)

        // 如果当前打开的处理日志对话框是被重做的记录，需要更新它
        if (selectedEntry && selectedEntry.id === entryId) {
          const updatedEntries = await window.electronAPI.getHistory()
          const updatedEntry = updatedEntries.find(entry => entry.id === entryId)
          if (updatedEntry) {
            setSelectedEntry(updatedEntry)
          }
        }

        showConfirm({
          title: t('history.redoSuccessTitle'),
          description: t('history.redoSuccessDesc'),
          variant: 'default',
          confirmText: t('common.confirm'),
          onConfirm: () => {}
        })
      } else {
        showConfirm({
          title: t('history.redoFailedTitle'),
          description: result.message || t('history.redoFailedDesc'),
          variant: 'destructive',
          confirmText: t('common.confirm'),
          onConfirm: () => {}
        })
      }
    } catch (error) {
      console.error('Failed to redo operation:', error)
      showConfirm({
        title: t('history.redoFailedTitle'),
        description: t('history.redoFailedGeneric'),
        variant: 'destructive',
        confirmText: t('common.confirm'),
        onConfirm: () => {}
      })
    }
  }

  // 组件挂载时立即加载历史记录，不显示加载状态
  useEffect(() => {
    loadHistory(false) // 使用统一的加载函数，不显示加载状态
  }, [])

  // 监听监控任务执行完成事件，平滑更新历史记录
  useEffect(() => {
    let isSubscribed = true

    const handleExecutionCompleted = (data: { result: any; historyEntry?: any }) => {
      if (!isSubscribed) return
      console.log('监控任务执行完成，平滑更新历史记录:', data)

      // 如果有新的历史记录条目，直接添加到状态中，避免重新加载整个列表
      if (data.historyEntry) {
        setHistoryEntries(prevEntries => {
          // 检查是否已经存在相同ID的条目，避免重复添加
          const existingEntry = prevEntries.find(entry => entry.id === data.historyEntry.id);
          if (existingEntry) {
            console.log('历史记录条目已存在，跳过添加:', data.historyEntry.id);
            return prevEntries;
          }

          // 将新条目添加到数组最前面
          console.log('添加新的历史记录条目到界面:', data.historyEntry.id);
          return [data.historyEntry, ...prevEntries];
        });
      } else {
        // 如果没有历史记录条目，回退到重新加载（保持兼容性）
        console.log('未收到历史记录条目，回退到重新加载');
        setTimeout(() => {
          if (isSubscribed) {
            loadHistory(false) // 监控任务回退加载不显示加载状态
          }
        }, 500)
      }
    }

    // 监听监控任务执行完成事件
    window.electronAPI.onMonitorExecutionCompleted(handleExecutionCompleted)

    return () => {
      isSubscribed = false
    }
  }, [])

  // 监听ESC键关闭处理日志悬浮窗
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isLogModalOpen) {
        handleCloseProcessLog()
      }
    }

    if (isLogModalOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLogModalOpen])

  return (
    <div className="h-full p-6">
      <div className="bg-bg-secondary rounded-lg h-full flex flex-col shadow-lg border border-border-primary backdrop-blur-sm">
        {/* Header */}
        <div className="p-6 border-b border-border-primary">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-text-secondary">{t('history.title')}</h2>
            <div className="flex items-center space-x-4">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={t('history.searchPlaceholder')}
                  className="pl-10 bg-bg-tertiary border-border-secondary text-text-secondary"
                />
              </div>
              <Button
                onClick={() => loadHistory(true)}
                variant="outline"
                size="sm"
                className="border-border-secondary text-text-secondary hover:bg-bg-tertiary"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('history.refresh')}
              </Button>
              <Button
                onClick={handleClearHistory}
                variant="outline"
                size="sm"
                className="border-red-600 text-red-400 hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('history.clear')}
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-text-tertiary">
                <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin" />
                <p>{t('history.loading')}</p>
              </div>
            </div>
          ) : !hasLoaded ? (
            // 数据还未加载时，显示空白状态，不显示加载动画
            <div className="flex-1"></div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-text-tertiary">
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">{t('history.noHistory')}</h3>
                <p>{t('history.noHistoryDesc')}</p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-750 sticky top-0">
                <tr className="text-left text-sm text-text-secondary">
                  <th className="px-6 py-4 font-medium">{t('history.time')}</th>
                  <th className="px-6 py-4 font-medium">{t('history.workflow')}</th>
                  <th className="px-6 py-4 font-medium">{t('history.fileCount')}</th>
                  <th className="px-6 py-4 font-medium">{t('history.result')}</th>
                  <th className="px-6 py-4 font-medium">{t('history.status')}</th>
                  <th className="px-6 py-4 font-medium">{t('history.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-bg-tertiary">
                    <td className="px-6 py-4 text-sm text-text-tertiary font-mono">
                      {new Date(entry.timestamp).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-blue-400 font-medium">{entry.workflowName}</span>
                        <span className={`text-xs px-2 py-1 rounded ${getSourceColor(entry.source)}`}>
                          {getSourceText(entry.source, t)}
                        </span>
                        {entry.monitorTaskName && (
                          <span className="text-xs bg-bg-tertiary text-text-secondary px-2 py-1 rounded">
                            {entry.monitorTaskName}
                          </span>
                        )}
                        {entry.isUndone && (
                          <span className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-1 rounded">
                            {t('history.undone')}
                          </span>
                        )}
                      </div>
                      {entry.stepName && (
                        <div className="text-xs text-text-tertiary mt-1">{entry.stepName}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-text-secondary">
                        <div>{t('history.totalFiles', { count: entry.totalFiles })}</div>
                        <div className="text-xs text-text-tertiary mt-1">
                          {t('history.processedFiles', { count: entry.processedFiles })}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-text-secondary">
                        {entry.fileOperations.slice(0, 2).map((op, index) => (
                          <div key={index} className="mb-1">
                            <div className="text-xs text-text-tertiary truncate max-w-xs">
                              {entry.isUndone ? (op.newPath || op.originalPath) : op.originalPath}
                            </div>
                            <div className="flex items-center mt-1">
                              <span className="text-text-tertiary mr-2">→</span>
                              <div className={`text-xs truncate max-w-xs ${
                                entry.isUndone ? 'text-yellow-400' : 'text-green-400'
                              }`}>
                                {entry.isUndone
                                  ? op.originalPath
                                  : (op.operation === 'delete' ? t('history.deleted') : op.newPath)
                                }
                              </div>
                            </div>
                          </div>
                        ))}
                        {entry.fileOperations.length > 2 && (
                          <button
                            onClick={() => handleShowProcessLog(entry)}
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                          >
                            {t('history.moreFiles', { count: entry.fileOperations.length - 2 })}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(entry.status === "success" || entry.status === "partial") && (entry.canUndo !== false) && !entry.isUndone ? (
                        <Button
                          onClick={() => handleUndoEntry(entry.id)}
                          variant="ghost"
                          size="sm"
                          className={entry.status === "partial"
                            ? "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20"
                            : "text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                          }
                          title={entry.status === "partial" ? "撤销部分成功的操作（只回滚成功的文件）" : "撤销操作"}
                        >
                          <Undo2 className="w-4 h-4 mr-1" />
                          {entry.status === "partial" ? "部分撤销" : t('history.undo')}
                        </Button>
                      ) : (entry.status === "success" || entry.status === "partial") && entry.isUndone ? (
                        <Button
                          onClick={() => handleRedoEntry(entry.id)}
                          variant="ghost"
                          size="sm"
                          className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                        >
                          <Redo2 className="w-4 h-4 mr-1" />
                          {t('history.redo')}
                        </Button>
                      ) : entry.status === "error" ? (
                        <Badge className="bg-red-900 text-red-300 hover:bg-red-900">
                          <XCircle className="w-3 h-3 mr-1" />
                          {t('history.failed')}
                        </Badge>
                      ) : entry.status === "partial" ? (
                        <Badge className="bg-yellow-900 text-yellow-300 hover:bg-yellow-900">
                          <XCircle className="w-3 h-3 mr-1" />
                          {t('history.partialSuccess')}
                        </Badge>
                      ) : (
                        <Badge className="bg-bg-tertiary text-text-tertiary hover:bg-bg-tertiary">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {t('history.completed')}
                        </Badge>
                      )}
                      {entry.errors.length > 0 && (
                        <div className="text-xs text-red-400 mt-1">
                          {t('history.errors', { count: entry.errors.length })}
                        </div>
                      )}
                      {entry.undoWarning && (
                        <div className="text-xs text-red-400 mt-1">
                          {entry.undoWarning}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Button
                        onClick={() => handleDeleteEntry(entry.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <ConfirmDialog />

      {/* 处理日志悬浮框 */}
      {isLogModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* 背景遮罩 */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
            onClick={handleCloseProcessLog}
          />

          {/* 悬浮框内容 */}
          <div className="relative bg-bg-secondary border border-border-primary rounded-lg shadow-2xl backdrop-blur-sm animate-in zoom-in-95 duration-200 max-w-4xl w-full mx-4 h-[90vh] flex flex-col overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-border-primary">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-text-secondary">
                      {t('history.processLog')}
                    </h3>
                    {selectedEntry.isUndone && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-1 rounded">
                        {t('history.undone')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-tertiary">
                    {t('history.workflowInfo', { name: selectedEntry.workflowName, source: getSourceText(selectedEntry.source, t) })}
                    {selectedEntry.monitorTaskName && (
                      <span> • {t('history.monitorTask', { name: selectedEntry.monitorTaskName })}</span>
                    )}
                    <br />
                    {new Date(selectedEntry.timestamp).toLocaleString()}
                    {selectedEntry.isUndone && selectedEntry.undoTimestamp && (
                      <span className="ml-2">• {t('history.undoTime', { time: new Date(selectedEntry.undoTimestamp).toLocaleString() })}</span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseProcessLog}
                className="text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {selectedEntry.undoWarning && (
              <div className="mx-6 mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {selectedEntry.undoWarning}
              </div>
            )}

            {/* 统计信息 */}
            <div className="p-6 border-b border-border-primary">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-bg-tertiary rounded-lg p-3">
                  <div className="text-xs text-text-tertiary">{t('history.totalFileCount')}</div>
                  <div className="text-lg font-semibold text-text-secondary">
                    {selectedEntry.fileOperations.length}
                  </div>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-3">
                  <div className="text-xs text-text-tertiary">{t('history.successCount')}</div>
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {selectedEntry.fileOperations.filter(op => op.status === 'success').length}
                  </div>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-3">
                  <div className="text-xs text-text-tertiary">{t('history.failedCount')}</div>
                  <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                    {selectedEntry.fileOperations.filter(op => op.status === 'error').length}
                  </div>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-3">
                  <div className="text-xs text-text-tertiary">{t('history.duration')}</div>
                  <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {selectedEntry.duration}ms
                  </div>
                </div>
              </div>
            </div>

            {/* 文件操作列表 */}
            <div className="flex-1 min-h-0 p-6 flex flex-col">
              <h4 className="text-sm font-medium text-text-secondary mb-4">{t('history.fileOperations')}</h4>
              <div
                className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-2"
                style={{
                  scrollbarWidth: 'thin'
                }}
              >
                {selectedEntry.fileOperations.map((operation, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      operation.status === 'success'
                        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-500/30'
                        : operation.status === 'error'
                        ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-500/30'
                        : 'bg-bg-tertiary border-border-secondary'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          {operation.status === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                          ) : operation.status === 'error' ? (
                            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-text-secondary truncate">
                            {operation.originalName}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs">
                          {selectedEntry.isUndone ? (
                            // 撤销状态：显示撤销后的路径信息
                            <>
                              <div className="text-text-tertiary">
                                <span className="font-medium">{t('history.currentLocation')}</span> {operation.originalPath}
                              </div>
                              {operation.newPath && operation.newPath !== operation.originalPath && (
                                <div className="text-yellow-400">
                                  <span className="font-medium">{t('history.originalLocation')}</span> {operation.newPath}
                                </div>
                              )}
                              <div className="text-yellow-400">
                                <span className="font-medium">{t('history.status')}:</span> {t('history.statusUndone')}
                              </div>
                            </>
                          ) : (
                            // 正常状态：显示正常的路径信息
                            <>
                              <div className="text-text-tertiary">
                                <span className="font-medium">{t('history.originalPath')}</span> {operation.originalPath}
                              </div>
                              {operation.newPath && operation.newPath !== operation.originalPath && (
                                <div className="text-green-400">
                                  <span className="font-medium">{t('history.newPath')}</span> {operation.newPath}
                                </div>
                              )}
                            </>
                          )}
                          <div className="text-text-tertiary">
                            <span className="font-medium">{t('history.operationType')}</span> {getOperationTypeText(operation.operation, t)}
                          </div>
                          {operation.error && (
                            <div className="text-red-400">
                              <span className="font-medium">{t('history.errorInfo')}</span> {translateErrorMessage(operation.error, language)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0 ml-4">
                        <Badge
                          className={
                            operation.status === 'success'
                              ? 'bg-green-900 text-green-300'
                              : operation.status === 'error'
                              ? 'bg-red-900 text-red-300'
                              : 'bg-yellow-900 text-yellow-300'
                          }
                        >
                          {operation.status === 'success' ? t('history.statusSuccess') : operation.status === 'error' ? t('history.statusError') : t('history.statusProcessing')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>


          </div>
        </div>
      )}
    </div>
  )
}
