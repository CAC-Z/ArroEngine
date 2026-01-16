import enUS from '../locales/en-US.json'
import zhCN from '../locales/zh-CN.json'

export type Language = 'zh-CN' | 'en-US'

const translations: Record<Language, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

export function translate(
  language: Language,
  key: string,
  params?: Record<string, any>
): string {
  let text = translations[language]?.[key] || key

  if (params) {
    Object.keys(params).forEach((param) => {
      text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param])
    })
  }

  return text
}
