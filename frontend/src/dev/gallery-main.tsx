import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter'
import '@/styles/globals.css'

import DevGallery from '@/dev/DevGallery'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found in dev-gallery.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <DevGallery />
  </StrictMode>,
)
