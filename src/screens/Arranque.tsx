import { useState } from 'react'
import { useCategorias, useCuentas } from '../data/hooks'
import { Asistente } from './Asistente'
import { Shell } from './Shell'

/** Una vez cargados los datos, decide una sola vez si toca el asistente de primera vez o la app. */
function ArranqueListo({ primeraVez }: { primeraVez: boolean }) {
  // El asistente sigue hasta que se termina, aunque ya existan cuentas y categorías a mitad de camino.
  const [asistente, setAsistente] = useState(primeraVez)
  return asistente ? <Asistente onTerminar={() => setAsistente(false)} /> : <Shell />
}

export function Arranque() {
  const cuentas = useCuentas()
  const categorias = useCategorias()

  const error = cuentas.error ?? categorias.error
  if (error && (!cuentas.data || !categorias.data)) {
    return (
      <main className="asistente">
        <h1>No se pueden cargar los datos</h1>
        <p className="error" role="alert">
          {error.message}
        </p>
        <button
          className="primario"
          onClick={() => {
            void cuentas.refetch()
            void categorias.refetch()
          }}
        >
          Reintentar
        </button>
      </main>
    )
  }
  if (!cuentas.data || !categorias.data) return <div className="cargando">Cargando…</div>

  return <ArranqueListo primeraVez={cuentas.data.length === 0 || categorias.data.length === 0} />
}
