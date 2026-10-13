import { Link } from 'react-router-dom'
import { Icono } from './Icono'

/** Cabecera de una subpantalla de Ajustes, con enlace para volver. */
export function Cabecera({ titulo }: { titulo: string }) {
  return (
    <header className="cabecera">
      <Link to="/ajustes" className="volver" aria-label="Volver a Ajustes">
        <Icono nombre="izquierda" />
        Ajustes
      </Link>
      <h1>{titulo}</h1>
    </header>
  )
}
