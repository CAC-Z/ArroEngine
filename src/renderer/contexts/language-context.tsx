import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { logger } from '../lib/logger'
import { translate } from '../lib/i18n'
import type { Language } from '../lib/i18n'

export type { Language } from '../lib/i18n'

// 语言上下文类型
interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, params?: Record<string, any>) => string
}



// 创建语言上下文
const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// 语言提供者组件
interface LanguageProviderProps {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>('zh-CN')

  // 从electron-store加载语言设置
  useEffect(() => {
    const loadLanguageSettings = async () => {
      if (window.electronAPI) {
        try {
          logger.log('开始加载语言设置');
          const savedLanguage = await window.electronAPI.getSetting('language') as Language
          logger.log('加载的语言设置:', savedLanguage);

          if (savedLanguage && (savedLanguage === 'zh-CN' || savedLanguage === 'en-US')) {
            logger.log('应用保存的语言:', savedLanguage);
            setLanguageState(savedLanguage)

            // 应用启动时也更新默认工作流语言
            // 使用 AbortController 来处理组件卸载时的清理
            const abortController = new AbortController();
            window.electronAPI.updateDefaultWorkflowLanguage(savedLanguage)
              .then(() => {
                if (!abortController.signal.aborted) {
                  logger.log('应用启动时更新默认工作流语言成功:', savedLanguage)
                }
              })
              .catch((error) => {
                if (!abortController.signal.aborted) {
                  console.error('应用启动时更新默认工作流语言失败:', error)
                }
              })

            // 返回清理函数
            return () => {
              abortController.abort();
            }
          } else {
            logger.log('使用默认语言: zh-CN');
            // 如果没有保存的语言，设置默认语言并保存
            await window.electronAPI.setSetting('language', 'zh-CN');
          }
        } catch (error) {
          console.error('Failed to load language settings:', error)
        }
      }
    }

    loadLanguageSettings()
  }, [])

  // 设置语言并保存到electron-store
  const setLanguage = async (lang: Language) => {
    const previousLanguage = language
    logger.log('设置新语言:', lang);
    setLanguageState(lang)

    // 保存到electron-store
    if (window.electronAPI) {
      try {
        logger.log('保存语言设置到 electron-store:', lang);
        const result = await window.electronAPI.setSetting('language', lang)
        logger.log('语言设置保存结果:', result);
      } catch (error) {
        console.error('Failed to save language setting:', error)
      }
    }

    // 注意：不在这里更新默认工作流语言，让各个组件自己处理
    // 这样可以避免重复调用和时序问题
  }

  // 翻译函数
  const t = (key: string, params?: Record<string, any>): string => {
    return translate(language, key, params)
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

// 使用语言上下文的Hook
export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
