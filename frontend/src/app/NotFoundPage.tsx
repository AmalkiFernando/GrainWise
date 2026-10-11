import { Link } from 'react-router-dom'
import { buttonClasses } from '@/components/ui/buttonClasses'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="font-display text-5xl text-brand-forest">404</p>
      <p className="text-text-secondary">There’s no page here.</p>
      <Link to="/" className={buttonClasses('primary')}>
        Back to the classifier
      </Link>
    </div>
  )
}
