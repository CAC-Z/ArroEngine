export const getNamingPatterns = (t: (key: string) => string) => [
  { value: 'original', label: t('action.naming.original') },
  { value: 'timestamp', label: t('action.naming.timestamp') },
  { value: 'date', label: t('action.naming.date') },
  { value: 'file-created', label: t('action.naming.fileCreated') },
  { value: 'file-modified', label: t('action.naming.fileModified') },
  { value: 'counter', label: t('action.naming.counter') },
  { value: 'prefix', label: t('action.naming.prefix') },
  { value: 'suffix', label: t('action.naming.suffix') },
  { value: 'replace', label: t('action.naming.replace') },
  { value: 'case', label: t('action.naming.case') },
  { value: 'custom', label: t('action.naming.custom') },
  { value: 'advanced', label: t('action.naming.advanced') },
]

export const getCaseTypes = (t: (key: string) => string) => [
  { value: 'lower', label: t('action.case.lower') },
  { value: 'upper', label: t('action.case.upper') },
  { value: 'title', label: t('action.case.title') },
  { value: 'camel', label: t('action.case.camel') },
  { value: 'pascal', label: t('action.case.pascal') },
  { value: 'snake', label: t('action.case.snake') },
  { value: 'kebab', label: t('action.case.kebab') },
]
