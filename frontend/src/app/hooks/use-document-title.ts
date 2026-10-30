import * as React from 'react'

/** Keeps the browser tab title in sync with the current screen. */
export function useDocumentTitle(title: string) {
  React.useEffect(() => {
    document.title = `${title} · MBC Arena`
  }, [title])
}
