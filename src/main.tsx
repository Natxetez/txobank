import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DiscretoProvider } from './components/Discreto'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SesionProvider } from './data/SesionContext'
import { App } from './App'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Los datos son de una sola persona y cambian solo desde la app: se reutilizan un rato, y las
      // acciones invalidan lo que toca. Al volver a la pestaña se refrescan.
      staleTime: 30_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SesionProvider>
          <DiscretoProvider>
            <HashRouter>
              <App />
            </HashRouter>
          </DiscretoProvider>
        </SesionProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
