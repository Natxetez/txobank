// Control del mes (SPEC.md, sección 6): gasto neto, fijo y variable, límite, disponible y estado.
import type { Ajustes, Categoria, Fijo, FijoFecha, FijoOmitido, Mes, Movimiento, Presupuesto } from '../data/types'
import { fijosDelMes, previstoPendiente, resumenFijos } from './fijos'
import type { FijoDelMes } from './fijos'
import { diaDeFecha, diasDelMes, mesDeFecha } from './meses'
import { nivelPresupuesto, presupuestoVigente } from './presupuestos'
import type { NivelPresupuesto } from './presupuestos'

/** Mes en el que cuenta un movimiento: los ingresos, su `mes_imputado` si lo tienen; el resto, su fecha. */
export function mesDeCuenta(m: Movimiento): Mes {
  return m.tipo === 'ingreso' && m.mesImputado ? m.mesImputado : mesDeFecha(m.fecha)
}

export interface ResumenMes {
  ingresos: number
  gastos: number
  devoluciones: number
  /** Gastos menos devoluciones. */
  gastoNeto: number
  /** Pagos de fijos. */
  gastoFijo: number
  /** Todo lo demás: gastos no fijos menos devoluciones. */
  gastoVariable: number
  /** Gasto neto por categoría de gasto. */
  porCategoria: Record<string, number>
  ingresosPorCategoria: Record<string, number>
}

/** Suma de un mes natural. Los traspasos no cuentan; las devoluciones no son ingresos. */
export function resumenMes(movs: Movimiento[], mes: Mes): ResumenMes {
  const r: ResumenMes = {
    ingresos: 0,
    gastos: 0,
    devoluciones: 0,
    gastoNeto: 0,
    gastoFijo: 0,
    gastoVariable: 0,
    porCategoria: {},
    ingresosPorCategoria: {},
  }
  for (const m of movs) {
    if (m.tipo === 'traspaso' || mesDeCuenta(m) !== mes) continue
    if (m.tipo === 'ingreso') {
      r.ingresos += m.importe
      if (m.categoriaId) r.ingresosPorCategoria[m.categoriaId] = (r.ingresosPorCategoria[m.categoriaId] ?? 0) + m.importe
    } else if (m.tipo === 'gasto') {
      r.gastos += m.importe
      if (m.fijoId) r.gastoFijo += m.importe
      if (m.categoriaId) r.porCategoria[m.categoriaId] = (r.porCategoria[m.categoriaId] ?? 0) + m.importe
    } else {
      r.devoluciones += m.importe
      if (m.categoriaId) r.porCategoria[m.categoriaId] = (r.porCategoria[m.categoriaId] ?? 0) - m.importe
    }
  }
  r.gastoNeto = r.gastos - r.devoluciones
  r.gastoVariable = r.gastoNeto - r.gastoFijo
  return r
}

/** Objetivo de ahorro en céntimos: importe fijo, o porcentaje de los ingresos previstos. */
export function objetivoAhorro(ajustes: Ajustes, ingresosPrevistos: number): number {
  if (!ajustes.ahorroTipo || ajustes.ahorroValor === null) return 0
  return ajustes.ahorroTipo === 'importe' ? ajustes.ahorroValor : Math.round((ingresosPrevistos * ajustes.ahorroValor) / 100)
}

export interface Limite {
  valor: number
  origen: 'presupuesto' | 'ingresos'
}

/**
 * Límite del mes: el presupuesto total si lo hay (incluye los fijos); si no, ingresos previstos menos
 * objetivo de ahorro; si tampoco hay ingresos previstos, no hay límite.
 */
export function limiteMes(presupuestoTotal: number | null, ingresosPrevistos: number, objetivo: number): Limite | null {
  if (presupuestoTotal !== null) return { valor: presupuestoTotal, origen: 'presupuesto' }
  if (ingresosPrevistos > 0) return { valor: ingresosPrevistos - objetivo, origen: 'ingresos' }
  return null
}

export type EstadoMes = 'bien' | 'ajustado' | 'pasado'

export interface EntradaControl {
  mes: Mes
  hoy: string
  /** Movimientos del mes y de los meses contiguos (los ingresos pueden contar para otro mes). */
  movimientos: Movimiento[]
  presupuestos: Presupuesto[]
  ajustes: Ajustes
  fijos: Fijo[]
  pagos: Movimiento[]
  omitidos: FijoOmitido[]
  /** Fechas de cargo cambiadas a mano para un mes concreto. */
  fechas?: FijoFecha[]
}

export interface Control {
  mes: Mes
  resumen: ResumenMes
  fijosMes: FijoDelMes[]
  presupuestoTotal: number | null
  ingresosPrevistos: number
  objetivoAhorro: number
  limite: Limite | null
  /** Fijos de gasto del mes aún sin pagar ni omitir, con su importe previsto. */
  fijosGastoPendiente: number
  /** Fijos de gasto del mes: lo pagado de verdad más lo previsto de los pendientes. */
  fijosGastoTotal: number
  /**
   * Lo que queda sin contar los fijos de gasto pendientes: límite − gasto neto. Es la cifra grande
   * de Inicio; los pendientes no cuentan hasta que se cobran.
   */
  disponibleSinPendientes: number | null
  /** Lo que queda tras los fijos de gasto pendientes (cifra prudente): de aquí salen el estado y el "al día". */
  disponible: number | null
  /** Días del mes que quedan, incluido hoy (0 si el mes ya pasó). */
  diasQueQuedan: number
  /** Días del mes ya transcurridos, incluido hoy. */
  diasTranscurridos: number
  disponiblePorDia: number | null
  ritmoPrevisto: number | null
  estado: EstadoMes | null
}

export function calcularControl(e: EntradaControl): Control {
  const resumen = resumenMes(e.movimientos, e.mes)
  const fijosMes = fijosDelMes(e.fijos, e.mes, e.pagos, e.omitidos, e.hoy, e.fechas)
  const presupuestoTotal = presupuestoVigente(e.presupuestos, e.mes, null).importe
  const ingresosPrevistos = resumen.ingresos + previstoPendiente(fijosMes, 'ingreso')
  const objetivo = objetivoAhorro(e.ajustes, ingresosPrevistos)
  const limite = limiteMes(presupuestoTotal, ingresosPrevistos, objetivo)
  const fijosGastoPendiente = previstoPendiente(fijosMes, 'gasto')
  const fijosGastoTotal = resumenFijos(fijosMes, 'gasto').importeTotal

  const total = diasDelMes(e.mes)
  const mesHoy = mesDeFecha(e.hoy)
  const diasQueQuedan = e.mes < mesHoy ? 0 : e.mes > mesHoy ? total : total - diaDeFecha(e.hoy) + 1
  const diasTranscurridos = e.mes < mesHoy ? total : e.mes > mesHoy ? 0 : diaDeFecha(e.hoy)

  let disponibleSinPendientes: number | null = null
  let disponible: number | null = null
  let disponiblePorDia: number | null = null
  let ritmoPrevisto: number | null = null
  let estado: EstadoMes | null = null
  if (limite) {
    disponibleSinPendientes = limite.valor - resumen.gastoNeto
    disponible = disponibleSinPendientes - fijosGastoPendiente
    disponiblePorDia = diasQueQuedan > 0 ? disponible / diasQueQuedan : null
    ritmoPrevisto = (limite.valor - fijosGastoTotal) / total
    if (disponible < 0) estado = 'pasado'
    else if (disponiblePorDia === null || disponiblePorDia >= ritmoPrevisto) estado = 'bien'
    else estado = 'ajustado'
  }

  return {
    mes: e.mes,
    resumen,
    fijosMes,
    presupuestoTotal,
    ingresosPrevistos,
    objetivoAhorro: objetivo,
    limite,
    fijosGastoPendiente,
    fijosGastoTotal,
    disponibleSinPendientes,
    disponible,
    diasQueQuedan,
    diasTranscurridos,
    disponiblePorDia,
    ritmoPrevisto,
    estado,
  }
}

export interface ProgresoCategoria {
  categoria: Categoria
  gastado: number
  presupuesto: number
  /** 0 a más de 1; puede pasar de 1 si se supera. */
  fraccion: number
  nivel: NivelPresupuesto
}

/** Categorías de gasto con presupuesto vigente ese mes y cuánto llevan gastado. */
export function progresoPresupuestos(
  control: Control,
  presupuestos: Presupuesto[],
  categorias: Categoria[],
): ProgresoCategoria[] {
  const resultado: ProgresoCategoria[] = []
  for (const categoria of categorias) {
    if (categoria.tipo !== 'gasto' || categoria.archivada) continue
    const presupuesto = presupuestoVigente(presupuestos, control.mes, categoria.id).importe
    if (presupuesto === null) continue
    const gastado = control.resumen.porCategoria[categoria.id] ?? 0
    resultado.push({
      categoria,
      gastado,
      presupuesto,
      fraccion: presupuesto > 0 ? gastado / presupuesto : 1,
      nivel: nivelPresupuesto(gastado, presupuesto),
    })
  }
  return resultado
}
