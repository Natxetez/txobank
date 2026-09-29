// Revisión mensual (SPEC.md, sección 6): resumen de un mes ya terminado.
import type { Categoria, Fijo, FijoOmitido, Mes, Movimiento, Presupuesto, Ajustes, Fecha } from '../data/types'
import { calcularControl, progresoPresupuestos } from './control'
import type { Control, ProgresoCategoria } from './control'
import { calendarioGasto } from './estadisticas'
import type { FijoDelMes } from './fijos'
import { mesDeFecha } from './meses'
import { mediaMensual } from './presupuestos'

export interface Revision {
  mes: Mes
  control: Control
  gastoNeto: number
  gastoFijo: number
  gastoVariable: number
  limite: number | null
  ahorro: number
  objetivoAhorro: number
  /** Categorías que se pasaron de su presupuesto. */
  categoriasPasadas: ProgresoCategoria[]
  /** Fijos que quedaron sin marcar (ni pagados ni omitidos). */
  fijosSinMarcar: FijoDelMes[]
  mayoresGastos: Movimiento[]
  /** Media de gasto neto de los 3 meses anteriores; null si no hay historia. */
  mediaTresMeses: number | null
  /** Variación del gasto neto frente a esa media (0,1 = +10 %). */
  variacionSobreMedia: number | null
  diasSinGasto: number
}

interface Entrada {
  mes: Mes
  hoy: Fecha
  /** Todos los movimientos. */
  movimientos: Movimiento[]
  categorias: Categoria[]
  presupuestos: Presupuesto[]
  ajustes: Ajustes
  fijos: Fijo[]
  omitidos: FijoOmitido[]
}

export function calcularRevision(e: Entrada): Revision {
  const pagos = e.movimientos.filter((m) => m.fijoId)
  const control = calcularControl({
    mes: e.mes,
    hoy: e.hoy,
    movimientos: e.movimientos,
    presupuestos: e.presupuestos,
    ajustes: e.ajustes,
    fijos: e.fijos,
    pagos,
    omitidos: e.omitidos,
  })
  const media = mediaMensual(e.movimientos, e.mes)
  const gastosDelMes = e.movimientos
    .filter((m) => m.tipo === 'gasto' && mesDeFecha(m.fecha) === e.mes)
    .sort((a, b) => b.importe - a.importe)

  return {
    mes: e.mes,
    control,
    gastoNeto: control.resumen.gastoNeto,
    gastoFijo: control.resumen.gastoFijo,
    gastoVariable: control.resumen.gastoVariable,
    limite: control.limite?.valor ?? null,
    ahorro: control.resumen.ingresos - control.resumen.gastoNeto,
    objetivoAhorro: control.objetivoAhorro,
    categoriasPasadas: progresoPresupuestos(control, e.presupuestos, e.categorias).filter((p) => p.nivel === 'superado'),
    fijosSinMarcar: control.fijosMes.filter((i) => i.estado === 'pendiente' || i.estado === 'esperado'),
    mayoresGastos: gastosDelMes.slice(0, 3),
    mediaTresMeses: media?.total ?? null,
    variacionSobreMedia: media && media.total > 0 ? (control.resumen.gastoNeto - media.total) / media.total : null,
    diasSinGasto: calendarioGasto(e.movimientos, e.mes, e.hoy).diasSinGasto,
  }
}
