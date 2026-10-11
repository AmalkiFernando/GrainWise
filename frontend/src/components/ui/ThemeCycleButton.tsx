import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Desktop, Moon, Sun } from '@phosphor-icons/react'
import type { ThemePreference } from '@/lib/themeStorage'
import { useUiStore } from '@/lib/useUiStore'
import { cn } from '@/lib/utils'

// Light → System → Dark, brightest to darkest, then round again.
const THEMES = {
  light: { label: 'Light', Icon: Sun },
  system: { label: 'System', Icon: Desktop },
  dark: { label: 'Dark', Icon: Moon },
} as const satisfies Record<ThemePreference, { label: string; Icon: typeof Sun }>
const THEME_ORDER: readonly ThemePreference[] = ['light', 'system', 'dark']

// Collapsed, a compact square; on hover or keyboard focus it turns to liquid glass, like the
// current navigation tab, and widens to show its name.
const headerButtonClass = cn(
  'glass-hover group relative flex h-10 min-w-10 items-center justify-center overflow-hidden rounded-xl px-2.5',
  'border border-brand-forest/15 bg-bg-canvas text-brand-forest',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-forest',
)

const opensOnHover =
  'grid grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity,margin] duration-300 ease-out group-hover:grid-cols-[1fr] group-hover:opacity-100 group-focus-visible:grid-cols-[1fr] group-focus-visible:opacity-100 motion-reduce:transition-none'

/** One button for the theme, cycling Light → System → Dark: the current icon, its name on hover. */
export function ThemeCycleButton({ className }: { className?: string }) {
  const themePreference = useUiStore((state) => state.themePreference)
  const setThemePreference = useUiStore((state) => state.setThemePreference)
  const reduceMotion = useReducedMotion()
  const upcoming = THEME_ORDER[(THEME_ORDER.indexOf(themePreference) + 1) % THEME_ORDER.length]
  const { label, Icon } = THEMES[themePreference]
  const accessibleLabel = `Theme: ${label} → ${THEMES[upcoming].label}`

  return (
    <button
      type="button"
      onClick={() => setThemePreference(upcoming)}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={cn(headerButtonClass, 'text-sm font-medium', className)}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={themePreference}
          initial={reduceMotion ? false : { y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { y: -14, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="flex items-center justify-center"
        >
          <Icon size={20} weight="duotone" aria-hidden="true" className="shrink-0" />
          <span
            className={cn(opensOnHover, 'ml-0 group-hover:ml-2 group-focus-visible:ml-2')}
            aria-hidden="true"
          >
            <span className="overflow-hidden whitespace-nowrap">{label}</span>
          </span>
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
