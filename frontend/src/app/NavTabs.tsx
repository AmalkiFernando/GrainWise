import { useId, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface NavItem {
  path: string
  label: string
  icon: ReactNode
}

const pillTransition = { type: 'spring', stiffness: 380, damping: 32 } as const

/** The app's pages as tabs, with a glass highlight that glides to whichever one is open. */
export function NavTabs({ items, className }: { items: NavItem[]; className?: string }) {
  // Scoped, so two mounted bars never animate into each other.
  const pillId = useId()
  const reduceMotion = useReducedMotion()

  return (
    <nav aria-label="Main" className={className}>
      <ul className="flex items-center gap-1.5 rounded-2xl border border-brand-forest/10 bg-brand-forest/[0.04] p-1.5">
        {items.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end
              className={({ isActive }) =>
                cn(
                  'group relative flex h-10 items-center rounded-xl px-3 text-sm font-medium transition-colors',
                  'outline-none focus-visible:ring-2 focus-visible:ring-brand-forest/60',
                  isActive
                    ? 'text-brand-forest'
                    : 'text-text-secondary hover:bg-brand-forest/[0.07] hover:text-brand-forest',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId={pillId}
                      transition={reduceMotion ? { duration: 0 } : pillTransition}
                      className="glass-pill absolute inset-0 rounded-xl"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative flex shrink-0 [&_svg]:size-[20px]">{item.icon}</span>
                  <span className="relative ml-2 whitespace-nowrap max-[420px]:sr-only">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
