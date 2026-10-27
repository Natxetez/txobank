import { Volver } from '../components/Volver'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListaFijos } from '../components/ListaFijos'
import { SelectorMes } from '../components/SelectorMes'
import { useFmt } from '../components/Discreto'
import { useControlMes, useFijos } from '../data/consultas'
import { pagosDeOtroMes, resumenFijos } from '../lib/fijos'
import { etiquetaMes, mesActual } from '../lib/meses'

/** Fijos de un mes: qué toca, qué está pagado y qué falta. */
export function FijosMes() {
  const fmt = useFmt()
  const [mes, setMes] = useState(mesActual())
  const { datos, cargando, error } = useControlMes(mes)

  const resumen = datos ? resumenFijos(datos.control.fijosMes) : null
  const todosFijos = useFijos().data
  const deOtroMes = useMemo(
    () => (datos && todosFijos ? pagosDeOtroMes(datos.movimientos, todosFijos, mes) : []),
    [datos, todosFijos, mes],
  )

  return (
    <section className="pantalla ancho">
      <Volver />
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
          <ListaFijos items={datos.control.fijosMes} mes={mes} deOtroMes={deOtroMes} />
        </>
      )}
      <Link to="/ajustes/fijos" className="enlace">
        Gestionar mis fijos
      </Link>
    </section>
  )
}
