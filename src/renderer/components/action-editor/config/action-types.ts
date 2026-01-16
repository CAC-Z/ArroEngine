import {
  Copy,
  FileText,
  FolderOpen,
  FolderPlus,
  Trash2,
} from "lucide-react"

export type ActionTypeConfig = {
  value: string
  label: string
  icon: typeof FolderOpen
  description: string
  requiresPath: boolean
  supportsNaming: boolean
  supportedTargets: Array<'files' | 'folders'>
}

const getActionLabel = (
  processTarget: 'files' | 'folders',
  actionType: string,
  t: (key: string) => string
): string => {
  switch (processTarget) {
    case 'files':
      return t(`action.type.${actionType}`)
    case 'folders':
      return t(`action.type.${actionType}Folder`)
    default:
      return t(`action.type.${actionType}`)
  }
}

const getActionDescription = (
  processTarget: 'files' | 'folders',
  actionType: string,
  t: (key: string) => string
): string => {
  switch (processTarget) {
    case 'files':
      return t(`action.type.${actionType}Desc`)
    case 'folders':
      return t(`action.type.${actionType}FolderDesc`)
    default:
      return t(`action.type.${actionType}Desc`)
  }
}

export const getActionTypes = (
  t: (key: string) => string,
  processTarget: 'files' | 'folders' = 'files'
): ActionTypeConfig[] => {
  const fileActions: ActionTypeConfig[] = [
    {
      value: 'move',
      label: getActionLabel(processTarget, 'move', t),
      icon: FolderOpen,
      description: getActionDescription(processTarget, 'move', t),
      requiresPath: true,
      supportsNaming: true,
      supportedTargets: ['files', 'folders'],
    },
    {
      value: 'copy',
      label: getActionLabel(processTarget, 'copy', t),
      icon: Copy,
      description: getActionDescription(processTarget, 'copy', t),
      requiresPath: true,
      supportsNaming: true,
      supportedTargets: ['files', 'folders'],
    },
    {
      value: 'rename',
      label: getActionLabel(processTarget, 'rename', t),
      icon: FileText,
      description: getActionDescription(processTarget, 'rename', t),
      requiresPath: false,
      supportsNaming: true,
      supportedTargets: ['files', 'folders'],
    },
    {
      value: 'delete',
      label: getActionLabel(processTarget, 'delete', t),
      icon: Trash2,
      description: getActionDescription(processTarget, 'delete', t),
      requiresPath: false,
      supportsNaming: false,
      supportedTargets: ['files', 'folders'],
    },
  ]

  const folderActions: ActionTypeConfig[] = [
    {
      value: 'createFolder',
      label: t('action.type.createFolder'),
      icon: FolderPlus,
      description: t('action.type.createFolderDesc'),
      requiresPath: true,
      supportsNaming: true,
      supportedTargets: ['folders'],
    },
  ]

  const allActions = [...fileActions, ...folderActions]
  return allActions.filter((action) => action.supportedTargets.includes(processTarget))
}

export const getActionTypeConfig = (
  t: (key: string) => string,
  processTarget: 'files' | 'folders',
  type: string
) => {
  const actionTypes = getActionTypes(t, processTarget)
  return actionTypes.find((actionType) => actionType.value === type) || actionTypes[0]
}
