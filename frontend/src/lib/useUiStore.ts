import { create } from 'zustand'
import {
  applyTheme,
  readStoredThemePreference,
  resolveTheme,
  subscribeToSystemTheme,
  writeStoredThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/themeStorage'

export type { ResolvedTheme, ThemePreference } from '@/lib/themeStorage'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
}

const TOAST_DURATION_MS = 4000

interface UiState {
  /** What the user picked; `system` follows the OS. */
  themePreference: ThemePreference
  /** What is on screen, with `system` already resolved. */
  theme: ResolvedTheme
  toasts: Toast[]
  setThemePreference: (preference: ThemePreference) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

let toastCounter = 0

export const useUiStore = create<UiState>((set, get) => ({
  // Start from storage so the store agrees with what the pre-paint script in index.html already
  // rendered: no first-paint flash to correct.
  themePreference: readStoredThemePreference(),
  theme: resolveTheme(readStoredThemePreference()),

  toasts: [],

  setThemePreference: (preference) => {
    writeStoredThemePreference(preference)
    const theme = resolveTheme(preference)
    applyTheme(theme)
    set({ themePreference: preference, theme })
  },

  addToast: (toast) => {
    toastCounter += 1
    const id = `toast-${toastCounter}`
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    setTimeout(() => get().removeToast(id), TOAST_DURATION_MS)
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  },
}))

let unsubscribeFromSystemTheme: (() => void) | undefined

/**
 * Paint the stored theme and start tracking the OS setting. Safe to call more than once:
 * StrictMode mounts effects twice in development, so the previous subscription is torn down first.
 */
export function hydrateTheme(): void {
  const preference = readStoredThemePreference()
  const theme = resolveTheme(preference)

  applyTheme(theme, { animate: false })
  useUiStore.setState({ themePreference: preference, theme })

  unsubscribeFromSystemTheme?.()
  unsubscribeFromSystemTheme = subscribeToSystemTheme((systemTheme) => {
    // Only follow the OS while the user is on `system`; an explicit choice outranks it.
    if (useUiStore.getState().themePreference !== 'system') {
      return
    }
    applyTheme(systemTheme)
    useUiStore.setState({ theme: systemTheme })
  })
}
