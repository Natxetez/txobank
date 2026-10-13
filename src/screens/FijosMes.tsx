import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ListaFijos } from '../components/ListaFijos'
import { SelectorMes } from '../components/SelectorMes'
import { useFmt } from '../components/Discreto'
import { useControlMes } from '../data/consultas'
import { resumenFijos } from '../lib/fijos'
import { etiquetaMes, mesActual } from '../lib/meses'

/** Fijos de un mes: qué toca, qué está pagado y qué falta. */
export function FijosMes() {
  const fmt = useFmt()
  const [mes, setMes] = useState(mesActual())
  const { datos, cargando, error } = useControlMes(mes)

  const resumen = datos ? resumenFijos(datos.control.fijosMes) : null

  return (
    <section className="pantalla ancho">
      <SelectorMes mes={mes} onCambiar={setMes} titulo={`Fijos de ${etiquetaMes(mes)}`} />
      {cargando && <p className="secundario">Cargando…</p>}
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      {datos && resumen && (
        <>
          {resumen.total > 0 && (
            <p className="secundario">
              {resumen.pagados} de {resumen.total} pagados: {fmt(resumen.importePagado)} de {fmt(resumen.importeTotal)}
            </p>
          )}
          <ListaFijos items={datos.control.fijosMes} mes={mes} />
        </>
      )}
      <Link to="/ajustes/fijos" className="enlace">
        Gestionar mis fijos
      </Link>
    </section>
  )
}
