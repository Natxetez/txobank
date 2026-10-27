import { useState } from 'react'
import { mensajeError, useCategorias } from '../data/hooks'
import { useAccionesFijos } from '../data/consultas'
import type { Fijo, Mes } from '../data/types'
import type { EstadoFijo, FijoDelMes, PagoDeOtroMes } from '../lib/fijos'
import { diaDeFecha, mesActual, nombreMes } from '../lib/meses'
import { useAviso } from './Avisos'
import { useHojaMovimiento } from './ContextoMovimiento'
import { useFmt } from './Discreto'
import { HojaFechaFijo } from './HojaFechaFijo'
import { HojaFijo } from './HojaFijo'
import { HojaPagarFijo } from './HojaPagarFijo'
import { Icono } from './Icono'
import type { NombreIcono } from './Icono'

const ICONO: Record<EstadoFijo, { icono: NombreIcono; texto: string }> = {
  pendiente: { icono: 'reloj', texto: 'Pendiente' },
  esperado: { icono: 'alerta', texto: 'Se esperaba ya' },
  pagado: { icono: 'check', texto: 'Pagado' },
  omitido: { icono: 'omitido', texto: 'Omitido' },
}

export const BOTON_PAGAR = { gasto: 'Pagado', ingreso: 'Cobrado', traspaso: 'Hecho' } as const

/** Texto del botón de pagar: en un fijo de un mes que aún no ha llegado, "Adelantar" (salvo los ingresos). */
export const textoPagar = (tipo: Fijo['tipo'], mes: Mes) =>
  mes > mesActual() && tipo !== 'ingreso' ? 'Adelantar' : BOTON_PAGAR[tipo]
const REALIZADO = { gasto: 'Pagado', ingreso: 'Cobrado', traspaso: 'Hecho' } as const

interface Props {
  items: FijoDelMes[]
  mes: Mes
  /** Pagos con fecha en este mes de fijos de otro mes (adelantados o tarde): se enseñan aparte. */
  deOtroMes?: PagoDeOtroMes[]
}

type HojaAbierta =
  | { tipo: 'pagar'; item: FijoDelMes }
  | { tipo: 'fecha'; item: FijoDelMes }
  | { tipo: 'editar'; fijo: Fijo }
  | { tipo: 'nuevo' }
  | null

/**
 * Lista de fijos de un mes con su estado y las acciones: marcar como pagado, cambiar la fecha de ese
 * mes, omitir y volver a incluir. Tocar un fijo pagado abre su movimiento; uno sin pagar, el fijo.
 */
export function ListaFijos({ items, mes, deOtroMes = [] }: Props) {
  const fmt = useFmt()
  const aviso = useAviso()
  const hojaMov = useHojaMovimiento()
  const acciones = useAccionesFijos()
  const categorias = useCategorias().data ?? []
  const [hoja, setHoja] = useState<HojaAbierta>(null)

  async function cambiarOmision(item: FijoDelMes, omitir: boolean) {
    try {
      if (omitir) {
        await acciones.omitir(item.fijo.id, mes)
        aviso.mostrar(`«${item.fijo.nombre}» omitido este mes`, {
          etiqueta: 'Deshacer',
          alHacer: () => acciones.quitarOmision(item.fijo.id, mes),
        })
      } else {
        await acciones.quitarOmision(item.fijo.id, mes)
      }
    } catch (err) {
      aviso.mostrar(mensajeError(err))
    }
  }

  return (
    <>
      <ul className="lista">
        {items.map((item) => {
          const { fijo, estado, pago } = item
          const cat = categorias.find((c) => c.id === fijo.categoriaId)
          const dia = diaDeFecha(item.fechaEsperada)
          const detalle =
            estado === 'pagado' && pago
              ? `${REALIZADO[fijo.tipo]} el ${diaDeFecha(pago.fecha)}/${pago.fecha.slice(5, 7)} · ${fmt(pago.importe)}`
              : estado === 'esperado'
                ? `Pendiente, se esperaba el día ${dia}`
                : estado === 'omitido'
                  ? 'Omitido este mes'
                  : `Pendiente, día ${dia}`
          return (
            <li key={fijo.id} className={`fijo ${estado}`}>
              <button
                type="button"
                className="fila"
                onClick={() => (pago ? hojaMov.abrirEditar(pago) : setHoja({ tipo: 'editar', fijo }))}
              >
                <span className="estado-fijo" role="img" aria-label={ICONO[estado].texto}>
                  <Icono nombre={ICONO[estado].icono} />
                </span>
                <span className="fila-texto">
                  <span>
                    {cat?.icono ? `${cat.icono} ` : ''}
                    {fijo.nombre}
                  </span>
                  {fijo.descripcion && <span className="secundario pequeno descripcion">{fijo.descripcion}</span>}
                  <span className="secundario pequeno">
                    {detalle}
                    {item.fechaCambiada && estado !== 'pagado' && <span className="fecha-cambiada"> · fecha cambiada</span>}
                  </span>
                </span>
                {estado !== 'pagado' && <span className="cifra secundario">{fmt(fijo.importe)}</span>}
              </button>
              {(estado === 'pendiente' || estado === 'esperado') && (
                <div className="acciones-fijo">
                  <button type="button" className="chip activo" onClick={() => setHoja({ tipo: 'pagar', item })}>
                    {textoPagar(fijo.tipo, mes)}
                  </button>
                  <button type="button" className="texto" onClick={() => setHoja({ tipo: 'fecha', item })}>
                    Cambiar fecha
                  </button>
                  <button type="button" className="texto" onClick={() => void cambiarOmision(item, true)}>
                    Omitir
                  </button>
                </div>
              )}
              {estado === 'omitido' && (
                <div className="acciones-fijo">
                  <button type="button" className="texto" onClick={() => void cambiarOmision(item, false)}>
                    Volver a incluir
                  </button>
                </div>
              )}
            </li>
          )
        })}
        {deOtroMes.map(({ fijo, pago, adelantado }) => {
          const cat = categorias.find((c) => c.id === fijo.categoriaId)
          const cuando = `${diaDeFecha(pago.fecha)}/${pago.fecha.slice(5, 7)}`
          return (
            <li key={pago.id} className="fijo pagado de-otro-mes">
              <button type="button" className="fila" onClick={() => hojaMov.abrirEditar(pago)}>
                <span className="estado-fijo" role="img" aria-label={adelantado ? 'Adelantado' : 'Pagado tarde'}>
                  <Icono nombre="check" />
                </span>
                <span className="fila-texto">
                  <span>
                    {cat?.icono ? `${cat.icono} ` : ''}
                    {fijo.nombre}
                    <span className="etiqueta">{adelantado ? 'Adelantado' : 'Tarde'}</span>
                  </span>
                  <span className="secundario pequeno">
                    De {nombreMes(pago.fijoMes!)}, {REALIZADO[fijo.tipo].toLowerCase()} el {cuando} · {fmt(pago.importe)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
        <li>
          <button type="button" className="fila anadir" onClick={() => setHoja({ tipo: 'nuevo' })}>
            <span className="estado-fijo" aria-hidden="true">
              <Icono nombre="mas" />
            </span>
            {items.length === 0 ? 'No hay fijos este mes. Añade uno' : 'Añadir fijo'}
          </button>
        </li>
      </ul>
      {hoja?.tipo === 'pagar' && <HojaPagarFijo item={hoja.item} mes={mes} onCerrar={() => setHoja(null)} />}
      {hoja?.tipo === 'fecha' && <HojaFechaFijo item={hoja.item} mes={mes} onCerrar={() => setHoja(null)} />}
      {hoja?.tipo === 'editar' && <HojaFijo fijo={hoja.fijo} onCerrar={() => setHoja(null)} />}
      {hoja?.tipo === 'nuevo' && <HojaFijo mesInicial={mes} onCerrar={() => setHoja(null)} />}
    </>
  )
}
