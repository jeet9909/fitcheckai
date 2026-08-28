import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AppStateProvider } from './state/AppState.tsx'
import ScrollToTop from './components/ScrollToTop.tsx'
import { installMockBackend } from './lib/mockBackend.ts'

if (import.meta.env.VITE_MOCK_API === 'true') {
  installMockBackend()
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AppStateProvider>
        <ScrollToTop />
        <App />
      </AppStateProvider>
    </BrowserRouter>
  </StrictMode>,
)
