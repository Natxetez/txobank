import { Component } from 'react'
import type { ReactNode } from 'react'

interface Estado {
  error: Error | null
}

/** Última red: si una pantalla falla al dibujarse, se muestra un mensaje en vez de dejar la app en blanco. */
export class ErrorBoundary extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { error: null }

  static getDerivedStateFromError(error: Error): Estado {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="asistente">
        <h1>Algo ha fallado</h1>
        <p className="secundario">Se ha producido un error inesperado. Tus datos no se han perdido.</p>
        <p className="error">{this.state.error.message}</p>
        <button className="primario" onClick={() => window.location.reload()}>
          Volver a cargar
        </button>
      </main>
    )
  }
}
