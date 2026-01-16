import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { logger } from '../lib/logger'

// 支持的主题类型
export type Theme = 'dark' | 'light'

// 支持的缩放比例
export type UIScale = '0.8' | '0.9' | '1.0' | '1.1' | '1.2'

// 主题上下文类型
interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  uiScale: UIScale
  setUIScale: (scale: UIScale) => void
  isDark: boolean
}

// 创建主题上下文
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// 主题提供者组件
interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [uiScale, setUIScaleState] = useState<UIScale>('1.0')
  const [isDark, setIsDark] = useState(false)

  // 从electron-store加载主题设置
  useEffect(() => {
    const loadSettings = async () => {
      if (window.electronAPI) {
        try {
          logger.log('开始加载主题设置');
          const savedTheme = await window.electronAPI.getSetting('theme') as Theme
          const savedScale = await window.electronAPI.getSetting('uiScale') as UIScale

          logger.log('加载的主题设置:', { savedTheme, savedScale });

          if (savedTheme && ['dark', 'light'].includes(savedTheme)) {
            logger.log('应用保存的主题:', savedTheme);
            setThemeState(savedTheme)
          } else {
            logger.log('使用默认主题: light');
            // 如果没有保存的主题，设置默认主题并保存
            await window.electronAPI.setSetting('theme', 'light');
          }

          if (savedScale && ['0.8', '0.9', '1.0', '1.1', '1.2'].includes(savedScale)) {
            logger.log('应用保存的缩放:', savedScale);
            setUIScaleState(savedScale)
          } else {
            logger.log('使用默认缩放: 1.0');
            // 如果没有保存的缩放，设置默认缩放并保存
            await window.electronAPI.setSetting('uiScale', '1.0');
          }
        } catch (error) {
          console.error('Failed to load theme settings:', error)
        }
      }
    }

    loadSettings()
  }, [])

  // 应用主题变化
  useEffect(() => {
    const isDarkTheme = theme === 'dark'
    setIsDark(isDarkTheme)
    applyTheme(theme)
  }, [theme])

  // 应用主题到DOM
  const applyTheme = (actualTheme: 'dark' | 'light') => {
    const root = document.documentElement

    if (actualTheme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
    }
  }

  // 应用缩放到DOM
  const applyUIScale = (scale: UIScale) => {
    const root = document.documentElement
    root.style.fontSize = `${parseFloat(scale) * 16}px`
  }

  // 设置主题
  const setTheme = async (newTheme: Theme) => {
    logger.log('设置新主题:', newTheme);
    setThemeState(newTheme)

    // 保存到electron-store
    if (window.electronAPI) {
      try {
        logger.log('保存主题设置到 electron-store:', newTheme);
        const result = await window.electronAPI.setSetting('theme', newTheme)
        logger.log('主题设置保存结果:', result);
      } catch (error) {
        console.error('Failed to save theme setting:', error)
      }
    }

    const isDarkTheme = newTheme === 'dark'
    setIsDark(isDarkTheme)
    applyTheme(newTheme)
  }

  // 设置缩放
  const setUIScale = async (scale: UIScale) => {
    logger.log('设置新缩放:', scale);
    setUIScaleState(scale)

    // 保存到electron-store
    if (window.electronAPI) {
      try {
        logger.log('保存缩放设置到 electron-store:', scale);
        const result = await window.electronAPI.setSetting('uiScale', scale)
        logger.log('缩放设置保存结果:', result);
      } catch (error) {
        console.error('Failed to save UI scale setting:', error)
      }
    }

    applyUIScale(scale)
  }

  // 应用缩放变化
  useEffect(() => {
    applyUIScale(uiScale)
  }, [uiScale])

  // 初始化主题和缩放
  useEffect(() => {
    const isDarkTheme = theme === 'dark'
    setIsDark(isDarkTheme)
    applyTheme(theme)
    applyUIScale(uiScale)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, uiScale, setUIScale, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

// 使用主题上下文的Hook
export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
