// 错误信息翻译工具函数
export const translateErrorMessage = (errorMessage: string, currentLanguage: 'zh-CN' | 'en-US'): string => {
  // 英文到中文的翻译映射
  const englishToChinese: Record<string, string> = {
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

  // 中文到英文的翻译映射
  const chineseToEnglish: Record<string, string> = {
    '源路径和目标路径不能相同': 'Source and destination must not be the same.',
    '无法用目录覆盖非目录文件': 'Cannot overwrite non-directory',
    '无法用非目录文件覆盖目录': 'Cannot overwrite directory',
    '文件或目录不存在': 'ENOENT: no such file or directory',
    '权限被拒绝': 'EACCES: permission denied',
    '磁盘空间不足': 'ENOSPC: no space left on device',
    '打开的文件过多': 'EMFILE: too many open files',
    '资源忙碌或被锁定': 'EBUSY: resource busy or locked',
    '文件已存在': 'EEXIST: file already exists',
    '对目录的非法操作': 'EISDIR: illegal operation on a directory',
    '不是一个目录': 'ENOTDIR: not a directory',
    '操作不被允许': 'EPERM: operation not permitted'
  };

  if (currentLanguage === 'zh-CN') {
    // 中文模式：将英文错误信息翻译成中文
    // 查找完全匹配的翻译
    if (englishToChinese[errorMessage]) {
      return englishToChinese[errorMessage];
    }

    // 查找部分匹配的翻译
    for (const [englishError, chineseError] of Object.entries(englishToChinese)) {
      if (errorMessage.includes(englishError)) {
        return errorMessage.replace(englishError, chineseError);
      }
    }
  } else {
    // 英文模式：将中文错误信息翻译成英文
    // 查找完全匹配的翻译
    if (chineseToEnglish[errorMessage]) {
      return chineseToEnglish[errorMessage];
    }

    // 查找部分匹配的翻译
    for (const [chineseError, englishError] of Object.entries(chineseToEnglish)) {
      if (errorMessage.includes(chineseError)) {
        return errorMessage.replace(chineseError, englishError);
      }
    }
  }

  // 如果没有找到翻译，返回原始错误信息
  return errorMessage;
};
