import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props} className="toast-root">
          <div className="grid gap-1">
            {title && <ToastTitle className="toast-title">{title}</ToastTitle>}
            {description && (
              <ToastDescription className="toast-description">
                {description}
              </ToastDescription>
            )}
          </div>
          {action && <div className="toast-action">{action}</div>}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport className="toast-viewport" />
    </ToastProvider>
  )
}