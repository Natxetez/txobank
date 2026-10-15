// Estadísticas (SPEC.md, sección 10): periodos, resúmenes, series de los gráficos, calendario y rachas.
import type { ActualizacionSaldo, Cuenta, Fecha, Mes, Movimiento, OtroSaldo, Presupuesto } from '../data/types'
import { resumenMes } from './control'
import { diaSemana, diasDelMes, diaDeFecha, finDeMes, fechaEnMes, mesDeFecha, mesesEntre, sumarDias, sumarMeses } from './meses'
import { mediaMensual, presupuestoVigente } from './presupuestos'
import { totalOtrosSaldosEnFecha } from './patrimonio'

export type Periodo = 'mes' | '3m' | 'ano' | '12m'

export const PERIODOS: { id: Periodo; etiqueta: string }[] = [
  { id: 'mes', etiqueta: 'Este mes' },
  { id: '3m', etiqueta: '3 meses' },
  { id: 'ano', etiqueta: 'Este año' },
  { id: '12m', etiqueta: '12 meses' },
]

/** Meses del periodo, terminando en el mes actual. */
export function mesesDelPeriodo(periodo: Periodo, mesHoy: Mes): Mes[] {
  switch (periodo) {
    case 'mes':
      return [mesHoy]
    case '3m':
      return mesesEntre(sumarMeses(mesHoy, -2), mesHoy)
    case '12m':
      return mesesEntre(sumarMeses(mesHoy, -11), mesHoy)
    case 'ano':
      return mesesEntre(`${mesHoy.slice(0, 4)}-01-01`, mesHoy)
  }
}

/** Periodo anterior equivalente: los mismos meses desplazados atrás (un año, en "Este año"). */
export function mesesPeriodoAnterior(periodo: Periodo, mesHoy: Mes): Mes[] {
  const meses = mesesDelPeriodo(periodo, mesHoy)
  const desplazamiento = periodo === 'ano' ? -12 : -meses.length
  return meses.map((m) => sumarMeses(m, desplazamiento))
}

/** Movimientos de una cuenta (o todos si no se indica). */
export const deCuenta = (movs: Movimiento[], cuentaId?: string) =>
  cuentaId ? movs.filter((m) => m.cuentaId === cuentaId) : movs

/** Variación relativa (0,1 = +10 %). Null si no hay base de comparación. */
export function variacion(actual: number, anterior: number): number | null {
  return anterior === 0 ? null : (actual - anterior) / Math.abs(anterior)
}

function diasTranscurridos(mes: Mes, hoy: Fecha): number {
  const mesHoy = mesDeFecha(hoy)
  if (mes < mesHoy) return diasDelMes(mes)
  if (mes > mesHoy) return 0
  return diaDeFecha(hoy)
}

export interface ResumenPeriodo {
  ingresos: number
  gastoNeto: number
  gastoFijo: number
  gastoVariable: number
  ahorro: number
  /** Ahorro / ingresos; null si no hay ingresos. */
  tasaAhorro: number | null
  /** Gasto variable / días transcurridos; null si aún no ha pasado ningún día. */
  variableMedioDiario: number | null
}

export function resumenPeriodo(movs: Movimiento[], meses: Mes[], hoy: Fecha): ResumenPeriodo {
  let ingresos = 0
  let gastoNeto = 0
  let gastoFijo = 0
  let gastoVariable = 0
  let dias = 0
  for (const mes of meses) {
    const r = resumenMes(movs, mes)
    ingresos += r.ingresos
    gastoNeto += r.gastoNeto
    gastoFijo += r.gastoFijo
    gastoVariable += r.gastoVariable
    dias += diasTranscurridos(mes, hoy)
  }
  const ahorro = ingresos - gastoNeto
  return {
    ingresos,
    gastoNeto,
    gastoFijo,
    gastoVariable,
    ahorro,
    tasaAhorro: ingresos > 0 ? ahorro / ingresos : null,
    variableMedioDiario: dias > 0 ? gastoVariable / dias : null,
  }
}

export interface FilaCategoria {
  categoriaId: string
  importe: number
  /** Parte del gasto total del periodo (0 a 1). */
  fraccion: number
  anterior: number
  variacion: number | null
}

const sumarPorCategoria = (movs: Movimiento[], meses: Mes[], campo: 'porCategoria' | 'ingresosPorCategoria') => {
  const total: Record<string, number> = {}
  for (const mes of meses) {
    for (const [id, importe] of Object.entries(resumenMes(movs, mes)[campo])) total[id] = (total[id] ?? 0) + importe
  }
  return total
}

/** Gasto neto por categoría, de mayor a menor, con variación frente al periodo anterior. */
export function gastoPorCategoria(movs: Movimiento[], meses: Mes[], mesesAnteriores: Mes[]): FilaCategoria[] {
  const actual = sumarPorCategoria(movs, meses, 'porCategoria')
  const anterior = sumarPorCategoria(movs, mesesAnteriores, 'porCategoria')
  const filas = Object.entries(actual).filter(([, importe]) => importe > 0)
  const total = filas.reduce((t, [, importe]) => t + importe, 0)
  return filas
    .map(([categoriaId, importe]) => ({
      categoriaId,
      importe,
      fraccion: total > 0 ? importe / total : 0,
      anterior: anterior[categoriaId] ?? 0,
      variacion: variacion(importe, anterior[categoriaId] ?? 0),
    }))
    .sort((a, b) => b.importe - a.importe)
}

export function ingresosPorCategoria(movs: Movimiento[], meses: Mes[]): { categoriaId: string; importe: number }[] {
  return Object.entries(sumarPorCategoria(movs, meses, 'ingresosPorCategoria'))
    .filter(([, importe]) => importe > 0)
    .map(([categoriaId, importe]) => ({ categoriaId, importe }))
    .sort((a, b) => b.importe - a.importe)
}

export interface PuntoMensual {
  mes: Mes
  ingresos: number
  gastoNeto: number
  gastoFijo: number
  gastoVariable: number
  ahorro: number
}

export function serieMensual(movs: Movimiento[], meses: Mes[]): PuntoMensual[] {
  return meses.map((mes) => {
    const r = resumenMes(movs, mes)
    return {
      mes,
      ingresos: r.ingresos,
      gastoNeto: r.gastoNeto,
      gastoFijo: r.gastoFijo,
      gastoVariable: r.gastoVariable,
      ahorro: r.ingresos - r.gastoNeto,
    }
  })
}

// --- Patrimonio ------------------------------------------------------------

/** Efecto de un movimiento en el saldo de una cuenta concreta. */
export function efectoEnCuenta(m: Movimiento, cuentaId: string): number {
  if (m.cuentaDestinoId === cuentaId) return m.importe
  if (m.cuentaId !== cuentaId) return 0
  return m.tipo === 'ingreso' || m.tipo === 'devolucion' ? m.importe : -m.importe
}

/** Saldo (inicial + movimientos con fecha hasta el límite) de una cuenta, o de todas. */
export function saldoHasta(cuentas: Cuenta[], movs: Movimiento[], limite: Fecha, cuentaId?: string): number {
  const elegidas = cuentaId ? cuentas.filter((c) => c.id === cuentaId) : cuentas
  let total = 0
  for (const c of elegidas) {
    total += c.saldoInicial
    for (const m of movs) if (m.fecha <= limite) total += efectoEnCuenta(m, c.id)
  }
  return total
}

export interface PuntoPatrimonio {
  mes: Mes
  /** Total: cuentas + otros saldos. */
  saldo: number
  cuentas: number
  otros: number
}

/**
 * Patrimonio al final de cada mes (el mes en curso, hasta hoy). Con todas las cuentas suma también los
 * otros saldos activos (su última actualización hasta ese día); con una cuenta concreta, solo esa cuenta.
 */
export function patrimonioPorMes(
  cuentas: Cuenta[],
  movs: Movimiento[],
  meses: Mes[],
  hoy: Fecha,
  cuentaId?: string,
  otrosSaldos?: { otros: OtroSaldo[]; historial: ActualizacionSaldo[] },
): PuntoPatrimonio[] {
  return meses.map((mes) => {
    const fin = finDeMes(mes)
    const limite = fin < hoy ? fin : hoy
    const enCuentas = saldoHasta(cuentas, movs, limite, cuentaId)
    const otros = !cuentaId && otrosSaldos ? totalOtrosSaldosEnFecha(otrosSaldos.otros, otrosSaldos.historial, limite) : 0
    return { mes, saldo: enCuentas + otros, cuentas: enCuentas, otros }
  })
}

// --- Ritmo del mes ---------------------------------------------------------

export interface PuntoRitmo {
  dia: number
  /** Gasto neto acumulado hasta ese día (null en los días que aún no han llegado). */
  real: number | null
  /** Media de los 3 meses anteriores en ese día del mes. */
  media: number | null
  /** Proyección hasta fin de mes (solo en el mes en curso, desde hoy). */
  proyeccion: number | null
}

export interface SerieRitmo {
  puntos: PuntoRitmo[]
  diaHoy: number
  /** Gasto neto que se prevé a fin de mes: lo gastado + ritmo variable × días restantes + fijos pendientes. */
  proyectadoFinMes: number
  ritmoVariableDiario: number
}

/** Gasto neto acumulado por día de un mes (índice 0 = día 1). */
function acumuladoPorDia(movs: Movimiento[], mes: Mes): number[] {
  const n = diasDelMes(mes)
  const porDia = new Array<number>(n).fill(0)
  for (const m of movs) {
    if ((m.tipo !== 'gasto' && m.tipo !== 'devolucion') || mesDeFecha(m.fecha) !== mes) continue
    porDia[diaDeFecha(m.fecha) - 1] += m.tipo === 'gasto' ? m.importe : -m.importe
  }
  let acumulado = 0
  return porDia.map((d) => (acumulado += d))
}

export function serieRitmo(movs: Movimiento[], mes: Mes, hoy: Fecha, fijosGastoPendiente: number): SerieRitmo {
  const n = diasDelMes(mes)
  const diaHoy = diasTranscurridos(mes, hoy)
  const real = acumuladoPorDia(movs, mes)

  const previos = mediaMensual(movs, mes)?.meses ?? []
  const acumuladosPrevios = previos.map((m) => acumuladoPorDia(movs, m))

  const r = resumenMes(movs, mes)
  const ritmoVariableDiario = diaHoy > 0 ? r.gastoVariable / diaHoy : 0
  const restantes = n - diaHoy
  const proyectadoFinMes = r.gastoNeto + ritmoVariableDiario * restantes + fijosGastoPendiente
  const realHoy = diaHoy > 0 ? real[diaHoy - 1] : 0
  const proyectar = mesDeFecha(hoy) === mes && restantes > 0

  const puntos: PuntoRitmo[] = real.map((acum, i) => {
    const dia = i + 1
    const media =
      acumuladosPrevios.length > 0
        ? acumuladosPrevios.reduce((t, a) => t + a[Math.min(i, a.length - 1)], 0) / acumuladosPrevios.length
        : null
    return {
      dia,
      real: dia <= diaHoy ? acum : null,
      media,
      proyeccion: proyectar && dia >= diaHoy ? realHoy + ((proyectadoFinMes - realHoy) * (dia - diaHoy)) / restantes : null,
    }
  })
  return { puntos, diaHoy, proyectadoFinMes, ritmoVariableDiario }
}

// --- Calendario y rachas ---------------------------------------------------

/** Gasto variable (gastos no fijos menos devoluciones, sin bajar de 0) de cada día. */
function variablePorFecha(movs: Movimiento[]): Map<Fecha, number> {
  const mapa = new Map<Fecha, number>()
  for (const m of movs) {
    if (m.tipo === 'gasto' && !m.fijoId) mapa.set(m.fecha, (mapa.get(m.fecha) ?? 0) + m.importe)
    else if (m.tipo === 'devolucion') mapa.set(m.fecha, (mapa.get(m.fecha) ?? 0) - m.importe)
  }
  return mapa
}

export interface DiaCalendario {
  dia: number
  fecha: Fecha
  gastoVariable: number
  /** 0 = sin gasto; 1 a 4 según lo alto que sea respecto al día de más gasto del mes. */
  nivel: 0 | 1 | 2 | 3 | 4
  /** Días futuros: no cuentan como "sin gasto". */
  futuro: boolean
}

/**
 * Calendario de gasto variable de un mes. `huecoInicial` es cuántas casillas vacías van antes del
 * día 1 en una cuadrícula que empieza en lunes.
 */
export function calendarioGasto(
  movs: Movimiento[],
  mes: Mes,
  hoy: Fecha,
): { dias: DiaCalendario[]; diasSinGasto: number; huecoInicial: number } {
  const porFecha = variablePorFecha(movs)
  const n = diasDelMes(mes)
  const gastos = Array.from({ length: n }, (_, i) => Math.max(0, porFecha.get(fechaEnMes(mes, i + 1)) ?? 0))
  const max = Math.max(0, ...gastos)
  let diasSinGasto = 0
  const dias = gastos.map((gastoVariable, i): DiaCalendario => {
    const fecha = fechaEnMes(mes, i + 1)
    const futuro = fecha > hoy
    if (!futuro && gastoVariable === 0) diasSinGasto += 1
    const nivel = gastoVariable === 0 || max === 0 ? 0 : (Math.min(4, Math.max(1, Math.ceil((4 * gastoVariable) / max))) as 1 | 2 | 3 | 4)
    return { dia: i + 1, fecha, gastoVariable, nivel, futuro }
  })
  return { dias, diasSinGasto, huecoInicial: diaSemana(mes) }
}

/** Días seguidos sin gasto variable hasta hoy, sin contar los anteriores al primer movimiento. */
export function rachaSinGasto(movs: Movimiento[], hoy: Fecha): number {
  if (movs.length === 0) return 0
  const porFecha = variablePorFecha(movs)
  const primero = movs.reduce((a, m) => (m.fecha < a ? m.fecha : a), movs[0].fecha)
  let racha = 0
  for (let f = hoy; f >= primero; f = sumarDias(f, -1)) {
    if ((porFecha.get(f) ?? 0) > 0) break
    racha += 1
  }
  return racha
}

// --- Detalle de categoría --------------------------------------------------

export interface DetalleCategoria {
  meses: { mes: Mes; importe: number; presupuesto: number | null }[]
  /** Media mensual de los meses desde el primero con gasto en esta categoría. */
  media: number
  numeroGastos: number
  ticketMedio: number | null
  mayores: Movimiento[]
}

export function detalleCategoria(
  movs: Movimiento[],
  categoriaId: string,
  mesFin: Mes,
  presupuestos: Presupuesto[],
): DetalleCategoria {
  const meses = mesesEntre(sumarMeses(mesFin, -11), mesFin)
  const filas = meses.map((mes) => ({
    mes,
    importe: resumenMes(movs, mes).porCategoria[categoriaId] ?? 0,
    presupuesto: presupuestoVigente(presupuestos, mes, categoriaId).importe,
  }))
  const primero = filas.findIndex((f) => f.importe !== 0)
  const conDatos = primero === -1 ? [] : filas.slice(primero)
  const media = conDatos.length > 0 ? conDatos.reduce((t, f) => t + f.importe, 0) / conDatos.length : 0

  const desde = `${meses[0].slice(0, 7)}-01`
  const gastos = movs.filter(
    (m) => m.tipo === 'gasto' && m.categoriaId === categoriaId && m.fecha >= desde && m.fecha <= finDeMes(mesFin),
  )
  const total = gastos.reduce((t, m) => t + m.importe, 0)
  return {
    meses: filas,
    media,
    numeroGastos: gastos.length,
    ticketMedio: gastos.length > 0 ? total / gastos.length : null,
    mayores: [...gastos].sort((a, b) => b.importe - a.importe).slice(0, 5),
  }
}
