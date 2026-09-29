import { useState } from 'react'
import { mensajeError, useCategorias } from '../data/hooks'
import { useAccionesFijos } from '../data/consultas'
import type { Mes } from '../data/types'
import type { EstadoFijo, FijoDelMes } from '../lib/fijos'
import { diaDeFecha } from '../lib/meses'
import { useAviso } from './Avisos'
import { useHojaMovimiento } from './ContextoMovimiento'
import { useFmt } from './Discreto'
import { HojaPagarFijo } from './HojaPagarFijo'

const ICONO: Record<EstadoFijo, { simbolo: string; texto: string }> = {
  pendiente: { simbolo: '○', texto: 'Pendiente' },
  esperado: { simbolo: '⚠', texto: 'Se esperaba ya' },
  pagado: { simbolo: '✓', texto: 'Pagado' },
  omitido: { simbolo: '⊘', texto: 'Omitido' },
}

const BOTON = { gasto: 'Pagado', ingreso: 'Cobrado', traspaso: 'Hecho' } as const
const REALIZADO = { gasto: 'Pagado', ingreso: 'Cobrado', traspaso: 'Hecho' } as const

interface Props {
  items: FijoDelMes[]
  mes: Mes
}

/** Lista de fijos de un mes con su estado y las acciones: marcar como pagado, omitir y volver a incluir. */
export function ListaFijos({ items, mes }: Props) {
  const fmt = useFmt()
  const aviso = useAviso()
  const hoja = useHojaMovimiento()
  const acciones = useAccionesFijos()
  const categorias = useCategorias().data ?? []
  const [pagando, setPagando] = useState<FijoDelMes | null>(null)

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

  if (items.length === 0) {
    return <p className="vacio">No hay fijos este mes. Puedes crearlos en Ajustes → Fijos.</p>
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
                disabled={estado !== 'pagado' || !pago}
                onClick={() => pago && hoja.abrirEditar(pago)}
              >
                <span className="estado-fijo" role="img" aria-label={ICONO[estado].texto}>
                  {ICONO[estado].simbolo}
                </span>
                <span className="fila-texto">
                  <span>
                    {cat?.icono ? `${cat.icono} ` : ''}
                    {fijo.nombre}
                  </span>
                  <span className="secundario pequeno">{detalle}</span>
                </span>
                {estado !== 'pagado' && <span className="cifra secundario">{fmt(fijo.importe)}</span>}
              </button>
              {(estado === 'pendiente' || estado === 'esperado') && (
                <div className="acciones-fijo">
                  <button type="button" className="chip activo" onClick={() => setPagando(item)}>
                    {BOTON[fijo.tipo]}
                  </button>
                  <button type="button" className="texto" onClick={() => void cambiarOmision(item, true)}>
                    Omitir este mes
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
      </ul>
      {pagando && <HojaPagarFijo item={pagando} mes={mes} onCerrar={() => setPagando(null)} />}
    </>
  )
}
