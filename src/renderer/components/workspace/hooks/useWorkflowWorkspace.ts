import type { DragEvent } from 'react'
import { useState, useEffect, useMemo } from "react"
import { logger } from '../../../lib/logger'
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import type { AppFile, Workflow, WorkflowResult, DropGroup } from '@shared/types'
import { useLanguage } from '../../../contexts/language-context'
import {
  canExecuteDirectly,
  getWorkflowInputPath,
  getWorkflowRequirements,
  shouldDisableFileSelection,
} from '../utils/workflow-helpers'

interface UseWorkflowWorkspaceProps {
  initialWorkflowId?: string | null
  onWorkflowSelect?: (workflowId: string | null) => void
}

export function useWorkflowWorkspace({ initialWorkflowId, onWorkflowSelect }: UseWorkflowWorkspaceProps) {
  const { t, language } = useLanguage()
  const [fileGroups, setFileGroups] = useState<DropGroup[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('')
  const [isRunning, setIsRunning] = useState(false)
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null)
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false) // 区分预览和执行结果
  const [maxItems, setMaxItems] = useState(1000) // 文件处理上限
  const [isProcessingFiles, setIsProcessingFiles] = useState(false) // 文件处理状态

  // 文件类型不匹配警告状态
  const [mismatchWarning, setMismatchWarning] = useState<{
    show: boolean;
    message: string;
    suggestion: string;
    lastAttemptedPaths: string[];
  }>({
    show: false,
    message: '',
    suggestion: '',
    lastAttemptedPaths: []
  })

  // 进度显示相关状态
  const [processingProgress, setProcessingProgress] = useState({
    current: 0,
    total: 0,
    currentFile: '',
    canCancel: true
  })

  // 确认对话框
  const { showConfirm, ConfirmDialog } = useConfirmDialog()




  // 统一的工作流过滤数据计算 - 单一数据源
  const workflowFilteredData = useMemo(() => {
    logger.log('workflowFilteredData - 开始计算，依赖项变化');

    // 从 fileGroups 创建扁平化的文件列表
    const allFiles = fileGroups.flatMap(group => group.files);
    logger.log('workflowFilteredData - fileGroups数量:', fileGroups.length);
    logger.log('workflowFilteredData - 扁平化后files数量:', allFiles.length);
    logger.log('workflowFilteredData - selectedWorkflowId:', selectedWorkflowId);
    logger.log('workflowFilteredData - workflows数量:', workflows.length);

    // 找到当前选中的工作流
    const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);
    logger.log('workflowFilteredData - 找到的工作流:', selectedWorkflow?.name);

    // 如果有工作流结果，优先根据工作流结果来决定显示的文件
    if (workflowResult && workflowResult.stepResults.length > 0) {
      logger.log('workflowFilteredData - 使用工作流结果数据');

      // 获取所有步骤的输入文件（去重）
      const allProcessedFiles = new Map();
      workflowResult.stepResults.forEach(stepResult => {
        stepResult.inputFiles.forEach(file => {
          allProcessedFiles.set(file.id, file);
        });
      });

      const processedFilesArray = Array.from(allProcessedFiles.values());
      const visibleFileCount = processedFilesArray.filter(f => !f.isDirectory).length;
      const visibleFolderCount = processedFilesArray.filter(f => f.isDirectory).length;
      const totalVisibleCount = allProcessedFiles.size;

      logger.log('workflowFilteredData - 工作流结果统计:', {
        visibleFileCount,
        visibleFolderCount,
        totalVisibleCount
      });

      return {
        filesToShow: processedFilesArray,
        visibleFileCount,
        visibleFolderCount,
        totalVisibleCount,
        isProcessed: true,
        selectedWorkflow
      };
    }

    // 没有工作流结果时，根据选中的工作流步骤配置来过滤显示
    let filteredFiles = allFiles;

    if (selectedWorkflow && selectedWorkflow.steps.length > 0) {
      // 获取所有启用步骤的处理目标
      const enabledSteps = selectedWorkflow.steps.filter(s => s.enabled);
      const processTargets = enabledSteps.map(s => s.processTarget || 'files');

      logger.log('workflowFilteredData - 工作流过滤逻辑');
      logger.log('workflowFilteredData - 启用步骤数:', enabledSteps.length);
      logger.log('workflowFilteredData - 处理目标:', processTargets);
      logger.log('workflowFilteredData - 原始文件数:', allFiles.length);

      // 根据步骤配置过滤文件
      if (processTargets.includes('files') && processTargets.includes('folders')) {
        // 包含文件和文件夹处理步骤，显示所有
        filteredFiles = allFiles;
        logger.log('workflowFilteredData - 显示所有文件和文件夹');
      } else if (processTargets.includes('folders')) {
        // 只有文件夹处理步骤，只显示文件夹
        filteredFiles = allFiles.filter(f => f.isDirectory);
        logger.log('workflowFilteredData - 只显示文件夹，过滤后数量:', filteredFiles.length);
      } else {
        // 只有文件处理步骤，只显示文件
        filteredFiles = allFiles.filter(f => !f.isDirectory);
        logger.log('workflowFilteredData - 只显示文件，过滤后数量:', filteredFiles.length);
      }
    } else {
      // 没有选中工作流或工作流没有步骤，显示所有文件
      logger.log('workflowFilteredData - 没有工作流或工作流无步骤，显示所有文件');
    }

    const visibleFileCount = filteredFiles.filter(f => !f.isDirectory).length;
    const visibleFolderCount = filteredFiles.filter(f => f.isDirectory).length;
    const totalVisibleCount = filteredFiles.length;

    logger.log('workflowFilteredData - 最终统计:', {
      visibleFileCount,
      visibleFolderCount,
      totalVisibleCount
    });

    return {
      filesToShow: filteredFiles,
      visibleFileCount,
      visibleFolderCount,
      totalVisibleCount,
      isProcessed: false,
      selectedWorkflow
    };
  }, [fileGroups, selectedWorkflowId, workflows, workflowResult])

  // 加载工作流（优化性能）
  const loadWorkflows = async () => {
    try {
      setIsLoadingWorkflows(true)
      logger.log('开始加载工作流 - 工作区视图')

      const startTime = performance.now()
      const allWorkflows = await window.electronAPI.getAllWorkflows()
      const loadTime = performance.now() - startTime
      logger.log(`工作流加载耗时: ${loadTime.toFixed(2)}ms`)

      const enabledWorkflows = allWorkflows.filter(workflow => workflow.enabled)
      setWorkflows(enabledWorkflows)
      logger.log(`已启用工作流数量: ${enabledWorkflows.length}`)
    } catch (error) {
      console.error('Failed to load workflows:', error)
      setWorkflows([])
    } finally {
      setIsLoadingWorkflows(false)
    }
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (!selectedWorkflowId) return;
    if (isProcessingFiles) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    const filePaths = droppedFiles.map(file => (file as any).path);

    setMismatchWarning(prev => ({ ...prev, show: false }));
    setIsProcessingFiles(true);

    try {
      const dropGroups = await window.electronAPI.processDroppedPaths(filePaths, selectedWorkflowId);

      // 计算总文件数用于检查和警告
      const totalFiles = dropGroups.reduce((sum, group) => sum + group.files.length, 0);

      // --- 修改此处的逻辑 ---
      if (totalFiles === 0 && filePaths.length > 0) {
        const generalMismatchMessage = t('workspace.workflowCannotProcessInput'); // 新增翻译：您添加的项目（文件或文件夹）不符合当前工作流的处理要求。
        const generalSuggestion = t('workspace.checkWorkflowTargetHint'); // 新增翻译：请检查工作流的处理目标（文件/文件夹）并添加匹配的项目。

        // 只设置持续警告状态，不显示弹窗

        setMismatchWarning({
          show: true,
          message: generalMismatchMessage,
          suggestion: generalSuggestion,
          lastAttemptedPaths: filePaths
        });
        setIsProcessingFiles(false); // 确保重置状态
        return; // 提前返回
      }

      // 使用统一的文件上限检查 - 计算当前总文件数
      const currentTotalFiles = fileGroups.reduce((sum, group) => sum + group.files.length, 0);
      const limitCheck = await checkFileLimit(currentTotalFiles, totalFiles);

      if (!limitCheck.isValid) {
        showFileLimitWarning(limitCheck);
        return;
      }

      // 直接存储 DropGroup[] 而不是扁平化
      setFileGroups(prev => [...prev, ...dropGroups])
      setWorkflowResult(null) // 清除之前的结果

      // 验证文件与工作流的匹配性，给出友好提示 - 使用扁平化列表进行验证
      if (selectedWorkflowId) {
        const allFiles = dropGroups.flatMap(group => group.files);
        await validateFilesWithWorkflow(allFiles, selectedWorkflowId);
      }
    } catch (error) {
      console.error('Error processing dropped files:', error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      showConfirm({
        title: t('workspace.fileProcessingFailed'),
        description: errorMessage,
        variant: 'destructive',
        confirmText: t('common.confirm'),
        onConfirm: () => { }
      })
    } finally {
      setIsProcessingFiles(false)
    }
  }

  // 统一的文件上限检查函数
  const checkFileLimit = async (currentCount: number, addingCount: number) => {
    try {
      const maxItems = await window.electronAPI.getSetting('workflow.processing.maxItems') || 1000;
      const newTotal = currentCount + addingCount;
      return {
        isValid: newTotal <= maxItems,
        maxItems,
        currentCount,
        addingCount,
        newTotal
      };
    } catch (error) {
      console.error('Failed to get file limit setting:', error);
      // 使用组件状态作为后备
      const newTotal = currentCount + addingCount;
      return {
        isValid: newTotal <= maxItems,
        maxItems,
        currentCount,
        addingCount,
        newTotal
      };
    }
  };

  // 显示文件上限超出警告
  const showFileLimitWarning = (limitCheck: any) => {
    showConfirm({
      title: t('workspace.fileLimitExceeded'),
      description: t('workspace.fileLimitExceededDesc', {
        current: limitCheck.currentCount,
        adding: limitCheck.addingCount,
        total: limitCheck.newTotal,
        limit: limitCheck.maxItems
      }),
      variant: 'warning',
      confirmText: t('common.confirm'),
      onConfirm: () => { }
    });
  };

  // 验证文件与工作流的匹配性 - 简化版本，使用统一的工作流需求分析
  const validateFilesWithWorkflow = async (uploadedFiles: AppFile[], workflowId: string) => {
    // 仅在有文件上传时执行验证
    if (uploadedFiles.length === 0) return;

    try {
      const workflow = workflows.find(w => w.id === workflowId);
      const requirements = getWorkflowRequirements(workflow);

      if (!requirements.hasSteps) return;

      // 简化的验证逻辑：主要验证工作已经通过 workflowFilteredData 统一处理
      // 这里只保留必要的验证逻辑，避免重复的过滤计算
      logger.log('validateFilesWithWorkflow - 工作流需求:', requirements);
      logger.log('validateFilesWithWorkflow - 上传文件数:', uploadedFiles.length);
    } catch (error) {
      console.error('Error validating files with workflow:', error);
    }
  };

  // 统一的显示文件计算 - 合并预览和执行模式的逻辑
  const displayedChanges = useMemo(() => {
    if (!workflowResult || !workflowResult.changes) return [];

    // 直接使用 changes 数组，这是所有变化的权威列表
    return workflowResult.changes.slice(0, 20);
  }, [workflowResult]);

  // 生成智能建议 - 简化版本，更准确地检测匹配问题
  const generateSmartSuggestions = (inputFiles: any[], workflow: any) => {
    const suggestions: string[] = [];

    if (!workflow) return suggestions;

    const fileCount = inputFiles.filter((f: any) => !f.isDirectory).length;
    const folderCount = inputFiles.filter((f: any) => f.isDirectory).length;
    const enabledSteps = workflow.steps.filter((s: any) => s.enabled);

    if (enabledSteps.length === 0) return suggestions;

    // 检查是否至少有一个步骤可以处理输入文件
    let hasAnyMatchingStep = false;

    for (const step of enabledSteps) {
      const needsFiles = step.processTarget === 'files' || !step.processTarget;
      const needsFolders = step.processTarget === 'folders';

      // 检查这个步骤是否有匹配的文件类型
      if ((needsFiles && fileCount > 0) || (needsFolders && folderCount > 0)) {
        hasAnyMatchingStep = true;
        break;
      }
    }

    // 如果没有任何步骤可以处理输入文件，显示警告
    if (!hasAnyMatchingStep && (fileCount > 0 || folderCount > 0)) {
      if (fileCount > 0 && folderCount === 0) {
        // 只有文件，但所有步骤都要求文件夹
        suggestions.push(t('workspace.stepNeedsFolders', { stepName: '工作流' }));
      } else if (folderCount > 0 && fileCount === 0) {
        // 只有文件夹，但所有步骤都要求文件
        suggestions.push(t('workspace.stepNeedsFiles', { stepName: '工作流' }));
      } else if (fileCount > 0 && folderCount > 0) {
        // 有文件和文件夹，但没有步骤能处理（这种情况比较少见）
        suggestions.push(t('workspace.cannotProcessInputType'));
      }
    }

    return suggestions;
  };

  // 预览工作流执行结果
  const handlePreview = async () => {
    if (!selectedWorkflowId) return

    const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId)
    if (!selectedWorkflow) return

    // 从 fileGroups 获取扁平化的文件列表
    let filesToPreview = fileGroups.flatMap(group => group.files)

    // 如果没有手动选择文件，但工作流可以一键执行，则自动加载文件
    if (fileGroups.length === 0 && canExecuteDirectly(selectedWorkflow)) {
      const inputPath = getWorkflowInputPath(selectedWorkflow)
      if (inputPath) {
        try {
          const dropGroups = await window.electronAPI.processDroppedPaths([inputPath], selectedWorkflowId)
          filesToPreview = dropGroups.flatMap(group => group.files)
          setFileGroups(dropGroups) // 更新UI显示
        } catch (error) {
          console.error(t('workspace.loadDefaultFilesFailed'), error)
          showConfirm({
            title: t('workspace.loadFailed'),
            description: t('workspace.loadFailedDesc', { path: inputPath }),
            variant: 'destructive',
            confirmText: t('common.confirm'),
            onConfirm: () => { }
          })
          return
        }
      }
    }

    // 如果仍然没有文件可预览，则返回
    if (filesToPreview.length === 0) return

    // 生成智能建议
    const suggestions = generateSmartSuggestions(filesToPreview, selectedWorkflow);

    // 如果有明显的不匹配问题，先显示警告
    if (suggestions.length > 0) {
      const shouldContinue = await new Promise<boolean>((resolve) => {
        showConfirm({
          title: t('workspace.inputMismatchWarning'),
          description: `${t('workspace.detectedIssues')}:\n${suggestions.join('\n')}\n\n${t('workspace.continuePreview')}`,
          variant: 'warning',
          confirmText: t('workspace.continuePreview'),
          cancelText: t('common.cancel'),
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false)
        });
      });

      if (!shouldContinue) return;
    }

    try {
      const result = await window.electronAPI.previewWorkflow(filesToPreview, selectedWorkflow)
      setWorkflowResult(result)
      setIsPreviewMode(true) // 设置为预览模式
    } catch (error) {
      console.error('Preview failed:', error)
      showConfirm({
        title: t('common.error'),
        description: t('workspace.previewFailed'),
        variant: 'warning',
        confirmText: t('common.confirm'),
        onConfirm: () => { }
      })
    }
  }


  // 监听工作流进度更新
  useEffect(() => {
    const handleWorkflowProgress = (progress: { processed: number; total: number; currentBatch?: number; totalBatches?: number }) => {
      setProcessingProgress(prev => ({
        ...prev,
        current: progress.processed,
        total: progress.total,
        currentFile: progress.currentBatch
          ? t('workspace.processingBatch', { current: progress.currentBatch, total: progress.totalBatches || 1 })
          : t('workspace.processingFiles')
      }))
    }

    // 添加事件监听器
    if (window.electronAPI.onWorkflowProgress) {
      window.electronAPI.onWorkflowProgress(handleWorkflowProgress)
    }

    return () => {
      // 清理事件监听器（如果有提供清理方法的话）
    }
  }, [t])

  // 监听工作流更新事件
  useEffect(() => {
    const handleWorkflowsUpdated = (data: { workflow: Workflow; isNew: boolean }) => {
      logger.log('收到工作流更新事件:', data.workflow.name, '是否新建:', data.isNew)

      // 重新加载工作流列表以确保显示最新数据
      loadWorkflows()
    }

    const handleWorkflowsDeleted = (data: { workflowId: string }) => {
      logger.log('收到工作流删除事件:', data.workflowId)

      // 如果删除的是当前选中的工作流，清除选择
      if (selectedWorkflowId === data.workflowId) {
        setSelectedWorkflowId('')
        setWorkflowResult(null)
        setIsPreviewMode(false)
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
  }, [selectedWorkflowId])

  // 执行工作流
  const handleExecute = async () => {
    if (!selectedWorkflowId) return

    const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId)
    if (!selectedWorkflow) return

    // 从 fileGroups 获取扁平化的文件列表
    let filesToProcess = fileGroups.flatMap(group => group.files)

    // 如果没有手动选择文件，但工作流可以一键执行，则自动加载文件
    if (fileGroups.length === 0 && canExecuteDirectly(selectedWorkflow)) {
      const inputPath = getWorkflowInputPath(selectedWorkflow)
      if (inputPath) {
        try {
          const dropGroups = await window.electronAPI.processDroppedPaths([inputPath], selectedWorkflowId)
          const defaultFiles = dropGroups.flatMap(group => group.files)
          filesToProcess = defaultFiles
          setFileGroups(dropGroups) // 更新UI显示
        } catch (error) {
          console.error(t('workspace.loadDefaultFilesFailed'), error)
          showConfirm({
            title: t('workspace.loadFailed'),
            description: t('workspace.loadFailedDesc', { path: inputPath }),
            variant: 'destructive',
            confirmText: t('common.confirm'),
            onConfirm: () => { }
          })
          return
        }
      }
    }

    // 如果仍然没有文件可处理，则提示用户
    if (filesToProcess.length === 0) {
      showConfirm({
        title: t('workspace.noFilesTitle'),
        description: t('workspace.noFilesDesc'),
        variant: 'default',
        confirmText: t('common.confirm'),
        onConfirm: () => { }
      })
      return
    }

    setIsRunning(true)
    setProcessingProgress({
      current: 0,
      total: filesToProcess.length,
      currentFile: t('workspace.preparingProcess'),
      canCancel: true
    })

    try {
      // 执行工作流，进度更新通过事件监听器处理
      const result = await window.electronAPI.executeWorkflow(filesToProcess, selectedWorkflow)

      setWorkflowResult(result)
      setIsPreviewMode(false) // 设置为执行模式

      // 更新文件状态 - 使用最终步骤的输出文件，更新 fileGroups 中的文件状态
      const finalStepResult = result.stepResults[result.stepResults.length - 1];
      if (finalStepResult) {
        // 创建文件ID到最终状态的映射
        const finalFileMap = new Map(finalStepResult.outputFiles.map(file => [file.id, file]));

        // 更新 fileGroups 中每个组的文件状态
        const updatedFileGroups = fileGroups.map(group => ({
          ...group,
          files: group.files.map(file => {
            const finalFile = finalFileMap.get(file.id);
            return finalFile || file; // 如果找不到最终状态，保持原状态
          })
        }));

        setFileGroups(updatedFileGroups);
      }

      // 生成详细的执行结果描述
      const stepSummary = result.stepResults.map((step, index) => {
        const processedInStep = step.outputFiles.filter(file =>
          file.status === 'success' && file.newPath
        ).length;
        return t('workspace.stepSummary', {
          stepNumber: index + 1,
          stepName: step.stepName,
          itemCount: processedInStep
        });
      }).join('\n');

      const processedItems = result.processedFiles;
      const errorCount = result.errors.length;

      let description = t('workspace.totalProcessed', { count: processedItems });
      if (errorCount > 0) {
        description += t('workspace.withErrors', { errorCount });
      }
      description += `\n\n${t('workspace.detailsLabel')}\n${stepSummary}`;

      showConfirm({
        title: t('workspace.executionCompleteTitle'),
        description: description,
        variant: 'default',
        confirmText: t('common.confirm'),
        onConfirm: () => { }
      })
    } catch (error) {
      console.error('Execution failed:', error)
      showConfirm({
        title: t('workspace.executionFailed'),
        description: t('workspace.executionFailedDesc'),
        variant: 'destructive',
        confirmText: t('common.confirm'),
        onConfirm: () => { }
      })
    } finally {
      setIsRunning(false)
      setProcessingProgress({
        current: 0,
        total: 0,
        currentFile: '',
        canCancel: true
      })
    }
  }

  // 取消工作流执行
  const handleCancelExecution = () => {
    // 这里应该调用后端的取消接口
    setIsRunning(false)
    setProcessingProgress({
      current: 0,
      total: 0,
      currentFile: '',
      canCancel: true
    })
  }

  // 清空文件列表
  const handleClearFiles = () => {
    setFileGroups([])
    setWorkflowResult(null)
  }



  // 选择文件
  const handleSelectFiles = async () => {
    // 检查是否已选择规则
    if (!selectedWorkflowId) {
      return
    }

    // 防止重复处理
    if (isProcessingFiles) {
      return
    }

    // 清除之前的警告状态
    setMismatchWarning(prev => ({ ...prev, show: false }))

    setIsProcessingFiles(true)
    try {
      const filePaths = await window.electronAPI.openFile()
      if (filePaths.length > 0) {
        const dropGroups = await window.electronAPI.processDroppedPaths(filePaths, selectedWorkflowId)
        const totalFiles = dropGroups.reduce((sum, group) => sum + group.files.length, 0);

        // 使用统一的文件上限检查
        const currentTotalFiles = fileGroups.reduce((sum, group) => sum + group.files.length, 0);
        const limitCheck = await checkFileLimit(currentTotalFiles, totalFiles);

        if (!limitCheck.isValid) {
          showFileLimitWarning(limitCheck);
          return;
        }

        // 检查是否存在文件类型不匹配
        if (totalFiles === 0 && filePaths.length > 0 && selectedWorkflowId) {
          const generalMismatchMessage = t('workspace.workflowCannotProcessInput');
          const generalSuggestion = t('workspace.checkWorkflowTargetHint');

          // 只设置持续警告状态，不显示弹窗
          setMismatchWarning({
            show: true,
            message: generalMismatchMessage,
            suggestion: generalSuggestion,
            lastAttemptedPaths: filePaths
          })
          return
        }

        // 直接存储 DropGroup[] 而不是扁平化
        setFileGroups(prev => [...prev, ...dropGroups])
        setWorkflowResult(null)

        // 验证文件与工作流的匹配性
        if (selectedWorkflowId) {
          const allFiles = dropGroups.flatMap(group => group.files);
          await validateFilesWithWorkflow(allFiles, selectedWorkflowId);
        }
      }
    } catch (error) {
      console.error(t('error.selectFilesFailed'), error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      showConfirm({
        title: t('workspace.fileProcessingFailed'),
        description: errorMessage,
        variant: 'destructive',
        confirmText: t('common.confirm'),
        onConfirm: () => { }
      })
    } finally {
      setIsProcessingFiles(false)
    }
  }

  // 选择文件夹
  const handleSelectFolder = async () => {
    // 检查是否已选择规则
    if (!selectedWorkflowId) {
      return
    }

    // 防止重复处理
    if (isProcessingFiles) {
      return
    }

    // 清除之前的警告状态
    setMismatchWarning(prev => ({ ...prev, show: false }))

    setIsProcessingFiles(true)
    try {
      const folderPath = await window.electronAPI.openDirectory()
      if (folderPath) {
        const dropGroups = await window.electronAPI.processDroppedPaths([folderPath], selectedWorkflowId)
        const totalFiles = dropGroups.reduce((sum, group) => sum + group.files.length, 0);

        // 检查是否存在文件类型不匹配
        if (totalFiles === 0 && selectedWorkflowId) {
          const generalMismatchMessage = t('workspace.workflowCannotProcessInput');
          const generalSuggestion = t('workspace.checkWorkflowTargetHint');

          // 只设置持续警告状态，不显示弹窗
          setMismatchWarning({
            show: true,
            message: generalMismatchMessage,
            suggestion: generalSuggestion,
            lastAttemptedPaths: [folderPath]
          })
          return
        }

        // 使用统一的文件上限检查
        const currentTotalFiles = fileGroups.reduce((sum, group) => sum + group.files.length, 0);
        const limitCheck = await checkFileLimit(currentTotalFiles, totalFiles);

        if (!limitCheck.isValid) {
          showFileLimitWarning(limitCheck);
          return;
        }

        // 直接存储 DropGroup[] 而不是扁平化
        setFileGroups(prev => [...prev, ...dropGroups])
        setWorkflowResult(null)

        // 验证文件与工作流的匹配性
        if (selectedWorkflowId) {
          const allFiles = dropGroups.flatMap(group => group.files);
          await validateFilesWithWorkflow(allFiles, selectedWorkflowId);
        }
      }
    } catch (error) {
      console.error(t('error.selectFolderFailed'), error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      showConfirm({
        title: t('workspace.fileProcessingFailed'),
        description: errorMessage,
        variant: 'destructive',
        confirmText: t('common.confirm'),
        onConfirm: () => { }
      })
    } finally {
      setIsProcessingFiles(false)
    }
  }

  useEffect(() => {
    loadWorkflows()

    // 加载文件处理上限设置
    const loadSettings = async () => {
      try {
        const limit = await window.electronAPI.getSetting('workflow.processing.maxItems') || 1000
        setMaxItems(limit)
      } catch (error) {
        console.error('Failed to load max items setting:', error)
      }
    }

    loadSettings()
  }, [])

  // 监听语言变化，重新加载工作流以更新默认工作流的名称和描述
  useEffect(() => {
    const updateWorkflowsLanguage = async () => {
      try {
        // 添加小延迟，确保语言上下文中的默认工作流语言更新完成
        await new Promise(resolve => setTimeout(resolve, 100))
        await loadWorkflows()
      } catch (error) {
        console.error('重新加载工作流失败:', error)
      }
    }

    updateWorkflowsLanguage()
  }, [language])

  // 调试：打印当前工作流数据
  useEffect(() => {
    if (workflows.length > 0) {
      logger.log('当前工作流数据:', workflows.map(w => ({
        id: w.id,
        name: w.name,
        defaultInputPath: w.defaultInputPath
      })))
    }
  }, [workflows])

  // 当从工作流中心传入工作流ID时，自动选择该工作流
  useEffect(() => {
    if (initialWorkflowId && workflows.length > 0) {
      const workflow = workflows.find(w => w.id === initialWorkflowId)
      if (workflow) {
        setSelectedWorkflowId(initialWorkflowId)
        onWorkflowSelect?.(initialWorkflowId)
      }
    }
  }, [initialWorkflowId, workflows, onWorkflowSelect])

  // 当工作流切换时，清除文件类型不匹配警告
  useEffect(() => {
    setMismatchWarning(prev => ({ ...prev, show: false }))
  }, [selectedWorkflowId])

  return {
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
  }
}
