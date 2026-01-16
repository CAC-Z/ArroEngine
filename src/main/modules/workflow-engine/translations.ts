export type SupportedLanguage = 'zh-CN' | 'en-US';

const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  'zh-CN': {
    'workflow.configError': '工作流配置错误',
    'workflow.stepNoMatches': '步骤"{stepName}"没有找到匹配的{targetType}',
    'workflow.cannotProcessFiles': '工作流无法处理当前输入的文件',
    'workflow.checkStepConfig': '请检查工作流步骤配置',
    'workflow.onlyFiles': '输入了 {fileCount} 个文件，但所有工作流步骤都配置为处理文件夹',
    'workflow.onlyFolders': '输入了 {folderCount} 个文件夹，但所有工作流步骤都配置为处理文件',
    'workflow.addFoldersOrAdjust': '请添加文件夹或将步骤的处理目标调整为"文件"',
    'workflow.addFilesOrAdjust': '请添加文件或将步骤的处理目标调整为"文件夹"',
    'workflow.mixedInputNoMatch':
      '输入了 {fileCount} 个文件和 {folderCount} 个文件夹，但工作流步骤无法处理它们。文件处理步骤：{fileSteps}；文件夹处理步骤：{folderSteps}',
    'workflow.checkMixedStepConfig': '请检查步骤配置或调整输入文件类型',
    'workflow.stepNoInput': '步骤"{stepName}"没有输入文件',
    'workflow.checkPreviousSteps': '请检查前面的步骤是否正确过滤了文件',
    'workflow.adjustStepTarget': '请调整步骤的处理目标或条件设置',
    'targetType.files': '文件',
    'targetType.folders': '文件夹',
    'error.permissionDenied': '权限不足，无法{operation}: {path}',
    'error.pathNotFound': '路径不存在: {path}',
    'error.directoryNotEmpty': '目录不为空，无法删除: {path}',
    'error.targetExists': '目标已存在: {path}',
    'error.crossDevice': '跨设备操作失败，请使用复制后删除: {path}',
    'error.pathTooLong': '路径名过长: {path}',
    'error.diskFull': '磁盘空间不足: {path}',
    'error.tooManyFiles': '打开的文件过多: {path}',
    'error.resourceBusy': '资源忙碌或被锁定: {path}',
    'error.generic': '操作失败: {path} - {error}',
    'workflow.interrupted': '工作流在步骤"{stepName}"前被中断'
  },
  'en-US': {
    'workflow.configError': 'Workflow configuration error',
    'workflow.stepNoMatches': 'Step "{stepName}" found no matching {targetType}',
    'workflow.cannotProcessFiles': 'Workflow cannot process current input files',
    'workflow.checkStepConfig': 'Please check workflow step configuration',
    'workflow.onlyFiles': 'Input {fileCount} files, but all workflow steps are configured to process folders',
    'workflow.onlyFolders': 'Input {folderCount} folders, but all workflow steps are configured to process files',
    'workflow.addFoldersOrAdjust': 'Please add folders or adjust step targets to "files"',
    'workflow.addFilesOrAdjust': 'Please add files or adjust step targets to "folders"',
    'workflow.mixedInputNoMatch':
      'Input {fileCount} files and {folderCount} folders, but workflow steps cannot process them. File steps: {fileSteps}; Folder steps: {folderSteps}',
    'workflow.checkMixedStepConfig': 'Please review step configuration or adjust input types',
    'workflow.stepNoInput': 'Step "{stepName}" has no input files',
    'workflow.checkPreviousSteps': 'Please check if previous steps filtered out all files',
    'workflow.adjustStepTarget': 'Please adjust the step target or conditions',
    'targetType.files': 'files',
    'targetType.folders': 'folders',
    'error.permissionDenied': 'Insufficient permission to {operation}: {path}',
    'error.pathNotFound': 'Path not found: {path}',
    'error.directoryNotEmpty': 'Directory is not empty: {path}',
    'error.targetExists': 'Target already exists: {path}',
    'error.crossDevice': 'Cross-device operation failed, please copy then delete: {path}',
    'error.pathTooLong': 'Path is too long: {path}',
    'error.diskFull': 'Disk is full: {path}',
    'error.tooManyFiles': 'Too many open files: {path}',
    'error.resourceBusy': 'Resource busy or locked: {path}',
    'error.generic': 'Operation failed: {path} - {error}',
    'workflow.interrupted': 'Workflow interrupted before step "{stepName}"'
  }
};

const ERROR_TRANSLATIONS: Record<string, string> = {
  'Source and destination must not be the same.': '源路径和目标路径不能相同',
  'Cannot overwrite non-directory': '无法用目录覆盖非目录文件',
  'Cannot overwrite directory': '无法用非目录文件覆盖目录',
  'ENOENT: no such file or directory': '文件或目录不存在',
  'EACCES: permission denied': '权限被拒绝',
  'ENOSPC: no space left on device': '磁盘空间不足',
  'EMFILE: too many open files': '打开的文件过多',
  'EBUSY: resource busy or locked': '资源忙碌或被锁定',
  'EEXIST: file already exists': '文件已存在',
  'EISDIR: illegal operation on a directory': '对目录的非法操作',
  'ENOTDIR: not a directory': '不是一个目录',
  'EPERM: operation not permitted': '操作不被允许'
};

export function translate(
  language: SupportedLanguage,
  key: string,
  params: Record<string, any> = {}
): string {
  const template = TRANSLATIONS[language][key] ?? key;
  return Object.entries(params).reduce(
    (acc, [paramKey, value]) => acc.replace(`{${paramKey}}`, String(value)),
    template
  );
}

export function translateError(language: SupportedLanguage, message: string): string {
  if (language === 'en-US') {
    return message;
  }

  if (ERROR_TRANSLATIONS[message]) {
    return ERROR_TRANSLATIONS[message];
  }

  for (const [englishError, chineseError] of Object.entries(ERROR_TRANSLATIONS)) {
    if (message.includes(englishError)) {
      return message.replace(englishError, chineseError);
    }
  }

  return message;
}
