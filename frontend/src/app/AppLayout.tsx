import { AnimatePresence, motion } from 'motion/react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { BrandMark } from '@/components/ui/BrandMark'
import { ThemeCycleButton } from '@/components/ui/ThemeCycleButton'
import { ToastViewport } from '@/components/ui/Toast'

// The app has one page, so the header has no tabs. NavTabs.tsx is kept for when it has more: put
// `<NavTabs items={[...]} />` between the logo and the theme button.
export function AppLayout() {
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col bg-bg-canvas">
      <ToastViewport />
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-brand-forest/10 bg-bg-surface/80 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <div className="flex flex-1">
          <Link to="/" aria-label="GrainWise home" className="shrink-0">
            <BrandMark />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-end">
          <ThemeCycleButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 p-4 sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-brand-forest/10 px-4 py-5 text-center text-xs text-text-secondary sm:px-6">
        GrainWise · Rice variety classification (Cammeo vs Osmancik) · Data: Cinar &amp; Koklu
        (2019), UCI Machine Learning Repository
      </footer>
    </div>
  )
}
