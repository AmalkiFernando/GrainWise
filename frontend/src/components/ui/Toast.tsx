import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react'
import { useUiStore, type Toast as ToastData, type ToastType } from '@/lib/useUiStore'
import { cn } from '@/lib/utils'

const toneClasses: Record<ToastType, string> = {
  success: 'border-state-success/30 text-state-success',
  error: 'border-state-danger/30 text-state-danger',
  info: 'border-state-info/30 text-state-info',
}

const toneIcons: Record<ToastType, ReactNode> = {
  success: <CheckCircle size={18} weight="duotone" />,
  error: <WarningCircle size={18} weight="duotone" />,
  info: <Info size={18} weight="duotone" />,
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  return (
    <motion.div
      layout
      role={toast.type === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: -16, x: 24 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'relative w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-bg-surface px-4 py-3 shadow-lg',
        toneClasses[toast.type],
      )}
    >
      <div className="flex items-start gap-2">
        {toneIcons[toast.type]}
        <p className="flex-1 text-sm text-text-primary">{toast.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-text-secondary hover:text-text-primary"
        >
          <X size={14} />
        </button>
      </div>
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 bg-current opacity-40"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 4, ease: 'linear' }}
      />
    </motion.div>
  )
}

export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts)
  const removeToast = useUiStore((state) => state.removeToast)

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={() => removeToast(toast.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
