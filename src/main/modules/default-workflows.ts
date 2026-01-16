import path from 'path';
import os from 'os';
import type { Workflow } from '@shared/types';

// 语言类型
type Language = 'zh-CN' | 'en-US';

// 多语言文本定义
// 文件类型值为内部固定分类（中文），避免受界面语言影响
const fileTypeValues = {
  image: '图片',
  document: '文档',
  video: '视频',
  audio: '音频',
  shortcut: '快捷方式',
  program: '程序'
};

const homeDir = os.homedir();

const appendFolderSuffix = (basePath: string, suffix: string) => path.join(basePath, suffix);

const workflowTexts = {
  'zh-CN': {
    // 路径后缀翻译
    pathSuffixes: {
      folders: '文件夹'
    },
    smartClassifier: {
      name: '🎯 智能文件分类器',
      description: '一键整理！自动识别所有文件类型并分类到对应文件夹，支持图片、文档、视频、音频等',
      fileStepName: '智能文件分类',
      fileStepDescription: '根据文件类型自动创建分类文件夹',
      folderStepName: '文件夹整理',
      folderStepDescription: '保持原结构移动文件夹到整理目录',
      targetPath: path.join(homeDir, 'ArroEngine整理')
    },
    desktopCleaner: {
      name: '🧹 桌面清理大师',
      description: '一键清理桌面杂乱文件和文件夹！自动分类文件并整理文件夹到整理目录',
      fileStepName: '桌面文件清理',
      fileStepDescription: '清理桌面文件到分类文件夹',
      folderStepName: '桌面文件夹整理',
      folderStepDescription: '保持原结构移动桌面文件夹',
      targetPath: path.join(homeDir, '桌面整理')
    },
    imageOrganizer: {
      name: '🖼️ 图片按日期整理',
      description: '智能整理图片文件！自动筛选图片并按拍摄日期分类，便于按时间查找照片',
      stepName: '图片按日期分类',
      stepDescription: '筛选图片文件并按创建日期分类到年月文件夹',
      targetPath: path.join(homeDir, '图片整理')
    },
    documentOrganizer: {
      name: '📄 文档按格式分类',
      description: '智能整理文档！筛选文档文件并按扩展名分类，Word、Excel、PDF等分别存放',
      stepName: '文档按格式分类',
      stepDescription: '筛选文档文件并按扩展名分类到不同文件夹',
      targetPath: path.join(homeDir, '文档整理')
    },
    downloadCleaner: {
      name: '📥 下载文件夹整理',
      description: '一键整理下载文件夹！自动分类文件并整理文件夹到对应目录',
      fileStepName: '下载文件清理',
      fileStepDescription: '清理下载文件夹中的文件并按类型分类',
      folderStepName: '下载文件夹整理',
      folderStepDescription: '保持原结构移动下载文件夹',
      targetPath: path.join(homeDir, '下载整理')
    },
    dateOrganizer: {
      name: '📅 按文件创建日期整理',
      description: '按文件实际创建日期重命名并分类整理，便于按时间查找文件',
      stepName: '按创建日期整理',
      stepDescription: '根据文件实际创建日期重命名文件',
      targetPath: path.join(homeDir, '按创建日期整理')
    }
  },
  'en-US': {
    // 路径后缀翻译
    pathSuffixes: {
      folders: 'Folders'
    },
    smartClassifier: {
      name: '🎯 Smart File Classifier',
      description: 'One-click organization! Automatically identify all file types and classify them into corresponding folders, supporting images, documents, videos, audio, etc.',
      fileStepName: 'Smart File Classification',
      fileStepDescription: 'Automatically create classification folders based on file types',
      folderStepName: 'Folder Organization',
      folderStepDescription: 'Move folders to organized directory maintaining original structure',
      targetPath: path.join(homeDir, 'ArroEngine_Organized')
    },
    desktopCleaner: {
      name: '🧹 Desktop Cleaner Master',
      description: 'One-click desktop cleanup! Automatically classify files and organize folders into organized directories',
      fileStepName: 'Desktop File Cleanup',
      fileStepDescription: 'Clean desktop files to classification folders',
      folderStepName: 'Desktop Folder Organization',
      folderStepDescription: 'Move desktop folders maintaining original structure',
      targetPath: path.join(homeDir, 'Desktop_Organized')
    },
    imageOrganizer: {
      name: '🖼️ Images by Date Organizer',
      description: 'Smart image organization! Automatically filter images and classify by creation date for easy time-based photo browsing',
      stepName: 'Images by Date Classification',
      stepDescription: 'Filter image files and classify by creation date into year-month folders',
      targetPath: path.join(homeDir, 'Images_Organized')
    },
    documentOrganizer: {
      name: '📄 Documents by Format Classifier',
      description: 'Smart document organization! Filter documents and classify by extension, separating Word, Excel, PDF, etc.',
      stepName: 'Documents by Format Classification',
      stepDescription: 'Filter document files and classify by extension into different folders',
      targetPath: path.join(homeDir, 'Documents_Organized')
    },
    downloadCleaner: {
      name: '📥 Downloads Folder Organizer',
      description: 'One-click downloads folder organization! Automatically classify files and organize folders into corresponding directories',
      fileStepName: 'Downloads File Cleanup',
      fileStepDescription: 'Clean and classify files in the downloads folder',
      folderStepName: 'Downloads Folder Organization',
      folderStepDescription: 'Move download folders maintaining original structure',
      targetPath: path.join(homeDir, 'Downloads_Organized')
    },
    dateOrganizer: {
      name: '📅 Organize by File Creation Date',
      description: 'Rename and organize files by their actual creation date for easy time-based searching',
      stepName: 'Organize by Creation Date',
      stepDescription: 'Rename files based on their actual creation date',
      targetPath: path.join(homeDir, 'Creation_Date_Organized')
    }
  }
};

// 创建多语言默认工作流的工厂函数
export function createDefaultWorkflows(language: Language = 'zh-CN'): Workflow[] {
  const texts = workflowTexts[language];

  return [
    {
      id: 'workflow-smart-classifier',
      name: texts.smartClassifier.name,
      description: texts.smartClassifier.description,
      enabled: true,
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cleanupEmptyFolders: true,
      includeSubfolders: true,
      steps: [
        {
          id: 'step-classify-files',
          name: texts.smartClassifier.fileStepName,
          description: texts.smartClassifier.fileStepDescription,
          enabled: true,
          order: 1,
          inputSource: { type: 'original' },
          conditions: {
            operator: 'AND',
            conditions: [], // 无条件，匹配所有文件
            groups: []
          },
          actions: [
            {
              id: 'action-move-classify-files',
              type: 'move',
              enabled: true,
              config: {
                targetPath: texts.smartClassifier.targetPath,
                targetPathType: 'specific_path',
                classifyBy: 'fileType',
                preserveFolderStructure: false,
                namingPattern: 'original',
                processSubfolders: false,
                maxDepth: 1
              }
            }
          ],
          processTarget: 'files'
        },
        {
          id: 'step-organize-folders',
          name: texts.smartClassifier.folderStepName,
          description: texts.smartClassifier.folderStepDescription,
          enabled: true,
          order: 2,
          inputSource: { type: 'original' },
          conditions: {
            operator: 'AND',
            conditions: [], // 无条件，处理所有文件夹
            groups: []
          },
          actions: [
            {
              id: 'action-move-folders',
              type: 'move',
              enabled: true,
              config: {
                targetPath: appendFolderSuffix(texts.smartClassifier.targetPath, texts.pathSuffixes.folders),
                targetPathType: 'specific_path',
                preserveFolderStructure: true,
                namingPattern: 'original',
                processSubfolders: false,
                maxDepth: 1
              }
            }
          ],
          processTarget: 'folders'
        }
      ]
    },

    {
      id: 'workflow-desktop-cleaner',
      name: texts.desktopCleaner.name,
      description: texts.desktopCleaner.description,
      enabled: true,
      order: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      defaultInputPath: path.join(homeDir, 'Desktop'),
      cleanupEmptyFolders: true,
      steps: [
        {
          id: 'step-desktop-clean-files',
          name: texts.desktopCleaner.fileStepName,
          description: texts.desktopCleaner.fileStepDescription,
          enabled: true,
          order: 1,
          inputSource: {
            type: 'specific_path',
            path: path.join(homeDir, 'Desktop')
          },
          conditions: {
            operator: 'AND',
            conditions: [
              {
                id: 'c1',
                field: 'fileName',
                operator: 'regex',
                value: '^(?!\\.).*', // 排除隐藏文件（以.开头的文件）
                enabled: true
              },
              {
                id: 'c2',
                field: 'fileExtension',
                operator: 'notEquals',
                value: 'lnk', // 排除快捷方式文件
                enabled: true
              },
              {
                id: 'c3',
                field: 'fileExtension',
                operator: 'notEquals',
                value: 'url', // 排除Internet快捷方式文件
                enabled: true
              },
              {
                id: 'c4',
                field: 'fileExtension',
                operator: 'notEquals',
                value: 'exe', // 排除可执行文件
                enabled: true
              }
            ],
            groups: []
          },
          actions: [
            {
              id: 'action-desktop-organize-files',
              type: 'move',
              enabled: true,
              config: {
                targetPath: texts.desktopCleaner.targetPath,
                targetPathType: 'specific_path',
                classifyBy: 'fileType',
                preserveFolderStructure: false,
                namingPattern: 'original',
                processSubfolders: false,
                maxDepth: 1
              }
            }
          ],
          processTarget: 'files'
        },
        {
          id: 'step-desktop-clean-folders',
          name: texts.desktopCleaner.folderStepName,
          description: texts.desktopCleaner.folderStepDescription,
          enabled: true,
          order: 2,
          inputSource: {
            type: 'specific_path',
            path: path.join(homeDir, 'Desktop')
          },
          conditions: {
            operator: 'AND',
            conditions: [], // 无条件，处理所有文件夹
            groups: []
          },
          actions: [
            {
              id: 'action-desktop-organize-folders',
              type: 'move',
              enabled: true,
              config: {
                targetPath: appendFolderSuffix(texts.desktopCleaner.targetPath, texts.pathSuffixes.folders),
                targetPathType: 'specific_path',
                preserveFolderStructure: true,
                namingPattern: 'original',
                processSubfolders: false,
                maxDepth: 1
              }
            }
          ],
          processTarget: 'folders'
        }
      ]
    },

    {
      id: 'workflow-image-organizer',
      name: texts.imageOrganizer.name,
      description: texts.imageOrganizer.description,
      enabled: true,
      order: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cleanupEmptyFolders: true,
      includeSubfolders: true,
      steps: [
        {
          id: 'step-filter-images',
          name: texts.imageOrganizer.stepName,
          description: texts.imageOrganizer.stepDescription,
          enabled: true,
          order: 1,
          inputSource: { type: 'original' },
          conditions: {
            operator: 'OR',
            conditions: [
              {
                id: 'c1',
                field: 'fileType',
                operator: 'equals',
                value: fileTypeValues.image,
                enabled: true
              }
            ],
            groups: []
          },
          actions: [
            {
              id: 'action-move-images',
              type: 'move',
              enabled: true,
              config: {
                targetPath: texts.imageOrganizer.targetPath,
                targetPathType: 'specific_path',
                classifyBy: 'createdDate',
                dateGrouping: 'yearMonth',
                preserveFolderStructure: false,
                namingPattern: 'original'
              }
            }
          ],
          processTarget: 'files'
        }
      ]
    },

    {
      id: 'workflow-document-organizer',
      name: texts.documentOrganizer.name,
      description: texts.documentOrganizer.description,
      enabled: true,
      order: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cleanupEmptyFolders: true,
      steps: [
        {
          id: 'step-filter-documents',
          name: texts.documentOrganizer.stepName,
          description: texts.documentOrganizer.stepDescription,
          enabled: true,
          order: 1,
          inputSource: { type: 'original' },
          conditions: {
            operator: 'OR',
            conditions: [
              {
                id: 'c1',
                field: 'fileType',
                operator: 'equals',
                value: fileTypeValues.document,
                enabled: true
              }
            ],
            groups: []
          },
          actions: [
            {
              id: 'action-move-documents',
              type: 'move',
              enabled: true,
              config: {
                targetPath: texts.documentOrganizer.targetPath,
                targetPathType: 'specific_path',
                classifyBy: 'extension',
                preserveFolderStructure: false,
                namingPattern: 'original',
                processSubfolders: true,
                maxDepth: -1
              }
            }
          ],
          processTarget: 'files'
        }
      ]
    },

    {
      id: 'workflow-download-cleaner',
      name: texts.downloadCleaner.name,
      description: texts.downloadCleaner.description,
      enabled: true,
      order: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      defaultInputPath: path.join(homeDir, 'Downloads'),
      cleanupEmptyFolders: true,
      steps: [
        {
          id: 'step-download-clean-files',
          name: texts.downloadCleaner.fileStepName,
          description: texts.downloadCleaner.fileStepDescription,
          enabled: true,
          order: 1,
          inputSource: {
            type: 'specific_path',
            path: path.join(homeDir, 'Downloads')
          },
          conditions: {
            operator: 'AND',
            conditions: [
              {
                id: 'c1',
                field: 'fileName',
                operator: 'regex',
                value: '^(?!\\.).*', // 排除隐藏文件（以.开头的文件）
                enabled: true
              }
            ],
            groups: []
          },
          actions: [
            {
              id: 'action-download-organize-files',
              type: 'move',
              enabled: true,
              config: {
                targetPath: texts.downloadCleaner.targetPath,
                targetPathType: 'specific_path',
                classifyBy: 'fileType',
                preserveFolderStructure: false,
                namingPattern: 'original',
                processSubfolders: false,
                maxDepth: 1
              }
            }
          ],
          processTarget: 'files'
        },
        {
          id: 'step-download-clean-folders',
          name: texts.downloadCleaner.folderStepName,
          description: texts.downloadCleaner.folderStepDescription,
          enabled: true,
          order: 2,
          inputSource: {
            type: 'specific_path',
            path: path.join(homeDir, 'Downloads')
          },
          conditions: {
            operator: 'AND',
            conditions: [], // 无条件，处理所有文件夹
            groups: []
          },
          actions: [
            {
              id: 'action-download-organize-folders',
              type: 'move',
              enabled: true,
              config: {
                targetPath: appendFolderSuffix(texts.downloadCleaner.targetPath, texts.pathSuffixes.folders),
                targetPathType: 'specific_path',
                preserveFolderStructure: true,
                namingPattern: 'original',
                processSubfolders: false,
                maxDepth: 1
              }
            }
          ],
          processTarget: 'folders'
        }
      ]
    },

    {
      id: 'workflow-date-organizer',
      name: texts.dateOrganizer.name,
      description: texts.dateOrganizer.description,
      enabled: false,
      order: 6,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cleanupEmptyFolders: true,
      steps: [
        {
          id: 'step-organize-by-date',
          name: texts.dateOrganizer.stepName,
          description: texts.dateOrganizer.stepDescription,
          enabled: true,
          order: 1,
          inputSource: { type: 'original' },
          conditions: {
            operator: 'AND',
            conditions: [
              {
                id: 'c1',
                field: 'fileName',
                operator: 'regex',
                value: '^(?!\\.).*', // 排除隐藏文件（以.开头的文件）
                enabled: true
              },
              {
                id: 'c2',
                field: 'fileSize',
                operator: 'greaterThan',
                value: 0, // 排除空文件
                enabled: true
              }
            ],
            groups: []
          },
          actions: [
            {
              id: 'action-move-by-date',
              type: 'move',
              enabled: true,
              config: {
                targetPath: texts.dateOrganizer.targetPath,
                targetPathType: 'specific_path',
                classifyBy: 'createdDate',
                dateGrouping: 'yearMonth',
                preserveFolderStructure: false,
                namingPattern: 'original',
                processSubfolders: true,
                maxDepth: -1
              }
            }
          ],
          processTarget: 'files'
        }
      ]
    }
  ];
}

// 保持向后兼容性的默认导出（中文版本）
export const defaultWorkflows: Workflow[] = createDefaultWorkflows('zh-CN');
