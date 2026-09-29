import { Link } from 'react-router-dom'

/** Cabecera de una subpantalla de Ajustes, con enlace para volver. */
export function Cabecera({ titulo }: { titulo: string }) {
  return (
    <header className="cabecera">
      <Link to="/ajustes" className="volver" aria-label="Volver a Ajustes">
        ‹ Ajustes
      </Link>
      <h1>{titulo}</h1>
    </header>
  )
}
