import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { useWorkflowWorkspace } from './hooks/useWorkflowWorkspace'

interface WorkspaceProviderProps {
  initialWorkflowId?: string | null
  onWorkflowSelect?: (workflowId: string | null) => void
  children: ReactNode
}

type WorkspaceContextValue = ReturnType<typeof useWorkflowWorkspace>

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

export function WorkspaceProvider({
  initialWorkflowId,
  onWorkflowSelect,
  children,
}: WorkspaceProviderProps) {
  const value = useWorkflowWorkspace({ initialWorkflowId, onWorkflowSelect })

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
