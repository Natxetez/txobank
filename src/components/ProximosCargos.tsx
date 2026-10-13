import { useMemo, useState } from 'react'
import { useFechasFijos, useFijos, useOmitidos, usePagosFijos } from '../data/consultas'
import { useCategorias } from '../data/hooks'
import { proximosCargos, textoDias } from '../lib/fijos'
import type { CargoProximo } from '../lib/fijos'
import { hoyISO, mesActual, sumarMeses } from '../lib/meses'
import { useFmt } from './Discreto'
import { HojaPagarFijo } from './HojaPagarFijo'
import { BOTON_PAGAR } from './ListaFijos'

/** Días de antelación con los que se avisa de un cargo. */
const VENTANA_DIAS = 7

/**
 * "Próximos cargos": fijos de los próximos 7 días (también del mes siguiente) y los que ya deberían
 * haberse cobrado. Es un recordatorio: no cuentan en el gasto del mes hasta que se marcan como pagados.
 */
export function ProximosCargos() {
  const fmt = useFmt()
  const mes = mesActual()
  const fijos = useFijos()
  const omitidos = useOmitidos()
  const fechas = useFechasFijos()
  const pagos = usePagosFijos(mes, sumarMeses(mes, 1))
  const categorias = useCategorias().data ?? []
  const [pagando, setPagando] = useState<CargoProximo | null>(null)

  const cargos = useMemo(() => {
    if (!fijos.data || !omitidos.data || !fechas.data || !pagos.data) return []
    return proximosCargos(fijos.data, pagos.data, omitidos.data, fechas.data, hoyISO(), VENTANA_DIAS)
  }, [fijos.data, omitidos.data, fechas.data, pagos.data])

  if (cargos.length === 0) return null
  const totalGasto = cargos.filter((c) => c.fijo.tipo === 'gasto').reduce((t, c) => t + c.fijo.importe, 0)

  return (
    <div className="bloque">
      <div className="bloque-cab">
        <h2>Próximos cargos</h2>
        {totalGasto > 0 && <span className="cifra secundario">{fmt(totalGasto)}</span>}
      </div>
      <div className="cargos">
        {cargos.map((c) => {
          const cat = categorias.find((x) => x.id === c.fijo.categoriaId)
          return (
            <article key={`${c.fijo.id}|${c.mes}`} className={`cargo ${c.estado}`}>
              <span className="cuando">{textoDias(c.dias)}</span>
              <span className="nombre">
                {cat?.icono ? `${cat.icono} ` : ''}
                {c.fijo.nombre}
              </span>
              <span className={c.fijo.tipo === 'ingreso' ? 'cifra positivo' : 'cifra'}>
                {c.fijo.tipo === 'ingreso' ? '+' : ''}
                {fmt(c.fijo.importe)}
              </span>
              {c.fijo.descripcion && <span className="secundario pequeno descripcion">{c.fijo.descripcion}</span>}
              <button type="button" className="chip activo" onClick={() => setPagando(c)}>
                {BOTON_PAGAR[c.fijo.tipo]}
              </button>
            </article>
          )
        })}
      </div>
      {pagando && <HojaPagarFijo item={pagando} mes={pagando.mes} onCerrar={() => setPagando(null)} />}
    </div>
  )
}
