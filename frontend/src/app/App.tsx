/**
 * Group B scaffold screen.
 * Proves the design tokens, typography, and build pipeline work.
 * Intentionally contains no club features, no data, and no routing.
 */
const swatches = [
  { name: 'bg', className: 'bg-bg' },
  { name: 'surface-1', className: 'bg-surface-1' },
  { name: 'surface-2', className: 'bg-surface-2' },
  { name: 'surface-3', className: 'bg-surface-3' },
  { name: 'border', className: 'bg-border' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'danger', className: 'bg-danger' },
  { name: 'warning', className: 'bg-warning' },
] as const

export default function App() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-12">
      <section className="w-full max-w-lg rounded-md border border-border bg-surface-1 p-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-faint">
          Matag-ob Badminton Club
        </p>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-text">MBC Arena</h1>

        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Foundation scaffold only. Design tokens, tooling, and the build pipeline are in place. No
          club features are implemented yet.
        </p>

        <div className="mt-8 border-t border-border pt-6">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-faint">
            Tokens
          </h2>

          <ul className="mt-3 grid grid-cols-4 gap-2">
            {swatches.map((swatch) => (
              <li key={swatch.name}>
                <div
                  className={`h-8 rounded-sm border border-border ${swatch.className}`}
                  aria-hidden="true"
                />
                <span className="mt-1 block font-mono text-[10px] text-text-faint">
                  {swatch.name}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-5 font-mono text-xs text-text-muted tabular-nums">
            1,000 SP &middot; 21&ndash;19, 21&ndash;17
          </p>
        </div>
      </section>
    </main>
  )
}
