import { useState, useEffect } from "react"
import { Play, Clock, Archive, Workflow, Folder, Minus, Square, X, Settings } from "lucide-react"
import logoImage from "./ui/logo.png"
import { WorkflowCenterView } from "./workflow-center-view"
import { WorkflowWorkspaceView } from "./workspace"
import { HistoryView } from "./history-view"
import { MonitorView } from "./monitor-view"
import { SettingsView } from "./settings-view"
import { useLanguage } from "../contexts/language-context"



// 窗口控制按钮组件
function WindowControls() {
  const handleMinimize = async () => {
    await window.electronAPI.minimizeWindow()
  }

  const handleMaximize = async () => {
    await window.electronAPI.maximizeWindow()
  }

  const handleClose = async () => {
    await window.electronAPI.closeWindow()
  }

  return (
    <div className="flex items-center space-x-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
      <button
        onClick={handleMinimize}
        className="w-8 h-8 flex items-center justify-center hover:bg-bg-tertiary rounded transition-colors focus:outline-none focus:ring-0"
        title="最小化"
        tabIndex={-1}
      >
        <Minus className="w-4 h-4 text-text-tertiary" />
      </button>
      <button
        onClick={handleMaximize}
        className="w-8 h-8 flex items-center justify-center hover:bg-bg-tertiary rounded transition-colors focus:outline-none focus:ring-0"
        title="最大化/还原"
        tabIndex={-1}
      >
        <Square className="w-3 h-3 text-text-tertiary" />
      </button>
      <button
        onClick={handleClose}
        className="w-8 h-8 flex items-center justify-center hover:bg-red-600 rounded transition-colors focus:outline-none focus:ring-0"
        title="关闭"
        tabIndex={-1}
      >
        <X className="w-4 h-4 text-text-tertiary hover:text-text-primary" />
      </button>
    </div>
  )
}

export default function AppLayout() {
  const [activeView, setActiveView] = useState("workspace")
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const { t } = useLanguage()

  // 导航菜单项
  const navigationItems = [
    { id: "workspace", label: t("nav.workspace"), icon: Play },
    { id: "workflows", label: t("nav.rules"), icon: Workflow },
    { id: "monitoring", label: t("nav.monitoring"), icon: Clock },
    { id: "history", label: t("nav.history"), icon: Archive },
  ]

  // 页面切换时清除规则选择状态
  const handleViewChange = (viewId: string) => {
    setActiveView(viewId)
    setSelectedWorkflowId(null) // 清除规则选择
  }

  // 监听从工作流中心跳转到工作区的事件
  useEffect(() => {
    const handleNavigateToWorkspace = (event: CustomEvent) => {
      const { workflowId } = event.detail
      setSelectedWorkflowId(workflowId)
      setActiveView("workspace")
    }

    window.addEventListener('navigateToWorkspace', handleNavigateToWorkspace as EventListener)

    return () => {
      window.removeEventListener('navigateToWorkspace', handleNavigateToWorkspace as EventListener)
    }
  }, [])

  // 渲染所有视图，通过显示/隐藏来切换，避免组件重新挂载
  const renderAllViews = () => {
    return (
      <>
        {/* 工作区视图 */}
        <div
          className={`h-full ${activeView === "workspace" ? "block" : "hidden"}`}
        >
          <WorkflowWorkspaceView
            selectedWorkflowId={selectedWorkflowId}
            onWorkflowSelect={setSelectedWorkflowId}
          />
        </div>

        {/* 工作流中心视图 */}
        <div
          className={`h-full ${activeView === "workflows" ? "block" : "hidden"}`}
        >
          <WorkflowCenterView />
        </div>

        {/* 历史记录视图 */}
        <div
          className={`h-full ${activeView === "history" ? "block" : "hidden"}`}
        >
          <HistoryView />
        </div>

        {/* 监控视图 */}
        <div
          className={`h-full ${activeView === "monitoring" ? "block" : "hidden"}`}
        >
          <MonitorView />
        </div>

        {/* 默认视图 */}
        {!["workspace", "workflows", "history", "monitoring"].includes(activeView) && (
          <div className="flex items-center justify-center h-full text-text-tertiary">
            <div className="text-center">
              <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h2 className="text-xl font-semibold mb-2">{t('app.title')}</h2>
              <p>{t('workspace.welcome')}</p>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="h-screen bg-bg-primary text-text-primary flex flex-col">
      {/* 自定义标题栏 */}
      <div className="h-8 bg-bg-secondary flex items-center px-4 select-none border-b border-border-primary" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="flex-1">
          {/* 空白区域用于拖拽 */}
        </div>

        {/* 设置按钮和窗口控制按钮 */}
        <div className="flex items-center space-x-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 flex items-center justify-center hover:bg-bg-tertiary rounded transition-colors focus:outline-none focus:ring-0"
            title="设置"
            tabIndex={-1}
          >
            <Settings className="w-4 h-4 text-text-tertiary" />
          </button>

          {/* 窗口控制按钮 */}
          <WindowControls />
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div className="w-60 bg-bg-secondary flex flex-col shadow-lg border-r border-border-primary backdrop-blur-sm">
        {/* App Title */}
        <div className="p-6 border-b border-border-primary">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src={logoImage}
                alt="ArroEngine Logo"
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  // 如果图片加载失败，显示默认图标
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center" style={{ display: 'none' }}>
                <Folder className="w-6 h-6 text-text-primary" />
              </div>
            </div>
            <h1 className="text-xl font-bold leading-none">{t('app.title')}</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = activeView === item.id

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleViewChange(item.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      isActive
                        ? "bg-bg-tertiary text-blue-400 border-l-4 border-blue-500"
                        : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Version Info */}
        <div className="p-4">
          <div className="text-xs text-text-tertiary opacity-75">
            v1.0.2
          </div>
        </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-bg-primary">{renderAllViews()}</div>
      </div>

      {/* 设置界面叠加层 */}
      {showSettings && (
        <SettingsView onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
