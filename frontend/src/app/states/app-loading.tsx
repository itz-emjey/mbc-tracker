import { Spinner } from '@/components/ui/spinner'

/** Full-page loading state used while the session resolves. */
export function AppLoading({ label = 'Loading MBC Arena' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" className="text-accent" />
        <p className="text-sm text-text-muted">{label}</p>
      </div>
    </div>
  )
}
