export const getClassifyOptions = (
  t: (key: string) => string,
  processTarget: 'files' | 'folders' = 'files'
) => [
  { value: 'none', label: t('action.classify.none') },
  { value: 'fileType', label: t('action.classify.fileType') },
  { value: 'createdDate', label: t('action.classify.createdDate') },
  { value: 'modifiedDate', label: t('action.classify.modifiedDate') },
  { value: 'fileSize', label: t('action.classify.fileSize') },
  { value: 'extension', label: t('action.classify.extension') },
  ...(processTarget === 'files'
    ? [{ value: 'preserveStructure', label: t('action.classify.preserveStructure') }]
    : []),
]

export const getDateGroupingOptions = (t: (key: string) => string) => [
  { value: 'year', label: t('action.classify.dateGrouping.year') },
  { value: 'yearMonth', label: t('action.classify.dateGrouping.yearMonth') },
  { value: 'yearMonthDay', label: t('action.classify.dateGrouping.yearMonthDay') },
  { value: 'quarter', label: t('action.classify.dateGrouping.quarter') },
  { value: 'monthName', label: t('action.classify.dateGrouping.monthName') },
]

export const getSizePresetOptions = (t: (key: string) => string) => [
  { value: 'general', label: t('action.classify.sizePreset.general') },
  { value: 'photo', label: t('action.classify.sizePreset.photo') },
  { value: 'video', label: t('action.classify.sizePreset.video') },
]
