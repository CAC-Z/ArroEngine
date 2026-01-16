export const getConditionFields = (
  t: (key: string) => string,
  processTarget: 'files' | 'folders' | 'all' = 'files'
) => {
  const fileFields = [
    { value: 'fileName', label: t('condition.field.fileName'), type: 'string' },
    { value: 'fileExtension', label: t('condition.field.fileExtension'), type: 'string' },
    { value: 'fileSize', label: t('condition.field.fileSize'), type: 'number' },
    { value: 'fileType', label: t('condition.field.fileType'), type: 'enum' },
    { value: 'filePath', label: t('condition.field.filePath'), type: 'string' },
  ]

  const folderFields = [
    { value: 'folderName', label: t('condition.field.folderName'), type: 'string' },
    { value: 'folderSize', label: t('condition.field.folderSize'), type: 'number' },
    { value: 'folderFileCount', label: t('condition.field.folderFileCount'), type: 'number' },
    { value: 'folderSubfolderCount', label: t('condition.field.folderSubfolderCount'), type: 'number' },
    { value: 'folderIsEmpty', label: t('condition.field.folderIsEmpty'), type: 'boolean' },
  ]

  const commonFields = [
    { value: 'createdDate', label: t('condition.field.createdDate'), type: 'date' },
    { value: 'modifiedDate', label: t('condition.field.modifiedDate'), type: 'date' },
  ]

  const allFields = [
    { value: 'itemType', label: t('condition.field.itemType'), type: 'enum' },
  ]

  switch (processTarget) {
    case 'files':
      return [...fileFields, ...commonFields]
    case 'folders':
      return [...folderFields, ...commonFields]
    case 'all':
      return [...fileFields, ...folderFields, ...commonFields, ...allFields]
    default:
      return [...fileFields, ...commonFields]
  }
}
