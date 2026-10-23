import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface ToastMessage {
  id: number
  type: ToastType
  text: string
}

let toastId = 0
let addToastFn: ((type: ToastType, text: string) => void) | null = null

export function showToast(type: ToastType, text: string) {
  addToastFn?.(type, text)
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((type: ToastType, text: string) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, text }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  useEffect(() => {
    addToastFn = addToast
    return () => { addToastFn = null }
  }, [addToast])

  const icons = { success: CheckCircle, error: AlertCircle, info: Info }
  const bars = {
    success: 'border-l-success',
    error: 'border-l-destructive',
    info: 'border-l-ai',
  }
  const iconColors = {
    success: 'text-success',
    error: 'text-destructive',
    info: 'text-ai',
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => {
        const Icon = icons[toast.type]
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-lg bg-surface-elev border border-hairline border-l-[3px] shadow-lg animate-slide-up ${bars[toast.type]}`}
          >
            <Icon size={14} className={`shrink-0 ${iconColors[toast.type]}`} />
            <span className="text-xs text-ink">{toast.text}</span>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="ml-2 text-ink-3 hover:text-ink transition-colors">
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
