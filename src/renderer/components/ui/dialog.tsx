import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  const [isTextSelecting, setIsTextSelecting] = React.useState(false)

  // 监听ESC键关闭弹窗
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }

    if (open) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onOpenChange])

  // 监听全局鼠标事件来跟踪文本选择状态
  React.useEffect(() => {
    if (!open) return

    let isMouseDownInInput = false

    const handleMouseDown = (e: MouseEvent) => {
      // 检查是否在输入框或文本区域内开始选择
      const target = e.target as HTMLElement
      if (target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('[contenteditable="true"]')
      )) {
        isMouseDownInInput = true
        setIsTextSelecting(true)
      } else {
        isMouseDownInInput = false
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      // 如果鼠标在输入框内按下，并且正在移动，说明可能在进行文本选择
      if (isMouseDownInInput) {
        setIsTextSelecting(true)
      }
    }

    const handleMouseUp = () => {
      // 延迟重置状态，给背景点击事件处理留出时间
      setTimeout(() => {
        setIsTextSelecting(false)
        isMouseDownInInput = false
      }, 50)
    }

    const handleSelectStart = (e: Event) => {
      // 开始选择文本时设置状态
      const target = e.target as HTMLElement
      if (target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('[contenteditable="true"]')
      )) {
        setIsTextSelecting(true)
      }
    }

    document.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('mousemove', handleMouseMove, true)
    document.addEventListener('mouseup', handleMouseUp, true)
    document.addEventListener('selectstart', handleSelectStart, true)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('mousemove', handleMouseMove, true)
      document.removeEventListener('mouseup', handleMouseUp, true)
      document.removeEventListener('selectstart', handleSelectStart, true)
    }
  }, [open])

  // 处理背景点击
  const handleBackdropClick = () => {
    // 如果正在进行文本选择，不关闭对话框
    if (isTextSelecting) {
      return
    }
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/80 animate-in fade-in-0"
        onClick={handleBackdropClick}
      />
      <div className="relative z-[10000] animate-in zoom-in-95 fade-in-0">
        {children}
      </div>
    </div>
  )
}

const DialogTrigger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>
}

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "grid w-full max-w-lg gap-4 border bg-gradient-to-br from-gray-800/90 to-gray-850/80 border-border-primary p-6 shadow-xl rounded-lg backdrop-blur-sm",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
DialogContent.displayName = "DialogContent"

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-text-tertiary", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

const DialogClose: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
}
