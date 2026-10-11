import type { ReactNode } from 'react'
import { motion } from 'motion/react'

/** Shakes once each time `trigger` changes to a new non-zero value (e.g. a rejected submit). */
export function Shake({
  children,
  trigger,
  className,
}: {
  children: ReactNode
  trigger: number
  className?: string
}) {
  return (
    <motion.div
      key={trigger}
      className={className}
      animate={trigger ? { x: [0, -8, 8, -6, 6, -2, 2, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  )
}
