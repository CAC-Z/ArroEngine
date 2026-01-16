import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, Trash2, Info } from "lucide-react"
import { useLanguage } from '../../contexts/language-context'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive' | 'warning'
  onConfirm: () => void
  onCancel?: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  variant = 'default',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const { t } = useLanguage()
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  const getIcon = () => {
    switch (variant) {
      case 'destructive':
        return <Trash2 className="w-6 h-6 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />
      default:
        return <Info className="w-6 h-6 text-blue-500" />
    }
  }

  const getConfirmButtonStyle = () => {
    switch (variant) {
      case 'destructive':
        return "bg-red-600 hover:bg-red-700 text-text-primary"
      case 'warning':
        return "bg-yellow-600 hover:bg-yellow-700 text-text-primary"
      default:
        return "bg-blue-600 hover:bg-blue-700 text-text-primary"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-secondary border-border-primary text-text-secondary max-w-md shadow-2xl">
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-2">
            {getIcon()}
            <DialogTitle className="text-lg font-semibold text-text-secondary">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-text-tertiary text-sm leading-relaxed whitespace-pre-wrap">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex space-x-2 pt-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="bg-bg-tertiary border-border-secondary hover:bg-bg-quaternary text-text-secondary"
          >
            {cancelText || t('confirm.default.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            className={getConfirmButtonStyle()}
          >
            {confirmText || t('confirm.default.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Hook for easier usage
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<{
    open: boolean
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    variant?: 'default' | 'destructive' | 'warning'
    onConfirm: () => void
    onCancel?: () => void
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {}
  })

  const showConfirm = (options: Omit<typeof dialogState, 'open'>) => {
    setDialogState({
      ...options,
      open: true
    })
  }

  const hideConfirm = () => {
    setDialogState(prev => ({ ...prev, open: false }))
  }

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      {...dialogState}
      onOpenChange={hideConfirm}
    />
  )

  return {
    showConfirm,
    hideConfirm,
    ConfirmDialog: ConfirmDialogComponent
  }
}
