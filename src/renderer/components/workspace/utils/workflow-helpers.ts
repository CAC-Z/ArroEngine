import type { Workflow } from '@shared/types'

export function getWorkflowRequirements(workflow?: Workflow) {
  if (!workflow) {
    return { needsFiles: true, needsFolders: true, hasSteps: false }
  }
  const enabledSteps = workflow.steps.filter((step) => step.enabled)
  if (enabledSteps.length === 0) {
    return { needsFiles: false, needsFolders: false, hasSteps: false }
  }

  const needsFiles = enabledSteps.some((step) => (step.processTarget || 'files') === 'files')
  const needsFolders = enabledSteps.some((step) => step.processTarget === 'folders')

  return { needsFiles, needsFolders, hasSteps: true }
}

export function canExecuteDirectly(workflow: Workflow): boolean {
  if (workflow.defaultInputPath) return true

  const firstEnabledStep = workflow.steps
    .filter((step) => step.enabled)
    .sort((a, b) => a.order - b.order)[0]

  return (
    firstEnabledStep?.inputSource.type === 'specific_path' &&
    !!firstEnabledStep.inputSource.path
  )
}

export function getWorkflowInputPath(workflow: Workflow): string | null {
  if (workflow.defaultInputPath) return workflow.defaultInputPath

  const firstEnabledStep = workflow.steps
    .filter((step) => step.enabled)
    .sort((a, b) => a.order - b.order)[0]

  if (firstEnabledStep?.inputSource.type === 'specific_path' && firstEnabledStep.inputSource.path) {
    return firstEnabledStep.inputSource.path
  }

  return null
}

export function shouldDisableFileSelection(workflow: Workflow): boolean {
  return canExecuteDirectly(workflow)
}
