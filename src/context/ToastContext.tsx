import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Tone = 'info' | 'success' | 'error' | 'alert'
interface Toast {
  id: number
  title: string
  body?: string
  tone: Tone
  onClick?: () => void
}

interface ToastValue {
  toast: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastValue | null>(null)

const TONE: Record<Tone, string> = {
  info: 'border-l-brand-600',
  success: 'border-l-ok-600',
  error: 'border-l-bad-600',
  alert: 'border-l-warn-600',
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), [])

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = nextId++
      setToasts((all) => [...all.slice(-3), { ...t, id }])
      setTimeout(() => dismiss(id), t.tone === 'error' || t.tone === 'alert' ? 8000 : 4500)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-md border border-l-4 border-line bg-white p-3 shadow-lg ${TONE[t.tone]} ${t.onClick ? 'cursor-pointer' : ''}`}
            onClick={() => {
              t.onClick?.()
              dismiss(t.id)
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{t.title}</p>
              {t.body && <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{t.body}</p>}
            </div>
            <button
              type="button"
              aria-label="Close"
              className="rounded p-1 text-ink-faint hover:bg-surface-2 hover:text-ink"
              onClick={(e) => {
                e.stopPropagation()
                dismiss(t.id)
              }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.toast
}
