import React from 'react';
import ReactDOM from 'react-dom/client';
import AppLayout from './components/app-layout'; // 引入你的主 UI 布局
import { LanguageProvider } from './contexts/language-context';
import { ThemeProvider } from './contexts/theme-context';
import './index.css'; // 我们需要一个空的 css 文件

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <AppLayout />
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>,
);