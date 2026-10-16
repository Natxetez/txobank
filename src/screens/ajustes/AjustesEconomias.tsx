import { useState } from 'react'
import { Cabecera } from '../../components/Cabecera'
import { HojaEconomia } from '../../components/HojaEconomia'
import { Icono } from '../../components/Icono'
import { useEconomia } from '../../data/EconomiaContext'
import type { Economia } from '../../data/types'

type Edicion = { modo: 'nueva' } | { modo: 'editar'; economia: Economia } | null

/** Ajustes › Economías: lista, entrar en otra, crear, renombrar y borrar. */
export function AjustesEconomias() {
  const { economias, activa, cambiar } = useEconomia()
  const [edicion, setEdicion] = useState<Edicion>(null)

  return (
    <section className="pantalla ancho">
      <Cabecera titulo="Economías" />
      <p className="secundario pequeno grupos-explica">
        Cada economía tiene sus propias cuentas, gastos, fijos y presupuestos: por ejemplo, tu economía personal y la de
        casa. Para pasar dinero de una a otra, apunta un traspaso a una cuenta de la otra economía.
      </p>
      <ul className="lista">
        {economias.map((e) => (
          <li key={e.id} className="fila-economia">
            <button className="fila" onClick={() => setEdicion({ modo: 'editar', economia: e })}>
              <span className="punto" style={{ background: e.color }} aria-hidden="true" />
              <span className="fila-texto">
                <span>{e.nombre}</span>
                {e.id === activa.id && <span className="secundario pequeno">Estás en esta</span>}
                {!e.propia && <span className="secundario pequeno">Compartida contigo</span>}
              </span>
              <Icono nombre="editar" className="chevron" />
            </button>
            {e.id !== activa.id && (
              <button type="button" className="secundario-btn entrar-economia" onClick={() => cambiar(e.id)}>
                Entrar
              </button>
            )}
          </li>
        ))}
      </ul>
      <button className="primario" onClick={() => setEdicion({ modo: 'nueva' })}>
        Nueva economía
      </button>

      {edicion && (
        <HojaEconomia economia={edicion.modo === 'editar' ? edicion.economia : undefined} onCerrar={() => setEdicion(null)} />
      )}
    </section>
  )
}
