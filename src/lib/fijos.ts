// Gastos fijos (SPEC.md, sección 7): qué toca cada mes, su estado, coste y cómo se convierte un pago en movimiento.
import type { Fecha, Fijo, Mes, Movimiento, NuevoFijo, NuevoMovimiento } from '../data/types'
import { diaDeFecha, diferenciaMeses, fechaEnMes, mesDeFecha, sumarMeses } from './meses'

export const PERIODICIDADES = [
  { valor: 1, etiqueta: 'Mensual' },
  { valor: 2, etiqueta: 'Bimestral' },
  { valor: 3, etiqueta: 'Trimestral' },
  { valor: 6, etiqueta: 'Semestral' },
  { valor: 12, etiqueta: 'Anual' },
]

export const etiquetaPeriodicidad = (cadaMeses: number) =>
  PERIODICIDADES.find((p) => p.valor === cadaMeses)?.etiqueta ?? `Cada ${cadaMeses} meses`

/** Coste mensual equivalente: importe / cada_meses. */
export const costeMensual = (f: Pick<Fijo, 'importe' | 'cadaMeses'>) => Math.round(f.importe / f.cadaMeses)

/** Coste anual: importe × 12 / cada_meses. */
export const costeAnual = (f: Pick<Fijo, 'importe' | 'cadaMeses'>) => Math.round((f.importe * 12) / f.cadaMeses)

/** ¿Toca este fijo en ese mes? Según activo, desde, hasta y periodicidad. */
export function tocaEnMes(f: Fijo, mes: Mes): boolean {
  if (!f.activo) return false
  const desdeInicio = diferenciaMeses(f.desde, mes)
  if (desdeInicio < 0) return false
  if (f.hasta && mes > f.hasta) return false
  return desdeInicio % f.cadaMeses === 0
}

/** Fecha aproximada del cargo en ese mes (el día se ajusta si el mes es más corto). */
export const fechaEsperada = (f: Pick<Fijo, 'diaMes'>, mes: Mes): Fecha => fechaEnMes(mes, f.diaMes)

/** Primer mes en o después de `desdeMes` en que toca, o null si está pausado o ya terminó. */
export function proximoMesQueToca(f: Fijo, desdeMes: Mes, limiteMeses = 60): Mes | null {
  for (let i = 0; i <= limiteMeses; i++) {
    const mes = sumarMeses(desdeMes, i)
    if (tocaEnMes(f, mes)) return mes
  }
  return null
}

export type EstadoFijo = 'pendiente' | 'esperado' | 'pagado' | 'omitido'

export interface FijoDelMes {
  fijo: Fijo
  estado: EstadoFijo
  /** Movimiento del pago, si está pagado. */
  pago: Movimiento | null
  fechaEsperada: Fecha
}

const ORDEN_ESTADO: Record<EstadoFijo, number> = { esperado: 0, pendiente: 1, pagado: 2, omitido: 3 }

/**
 * Fijos que tocan en un mes con su estado. También aparece un fijo ya pagado para ese mes aunque
 * luego se haya pausado. Orden: primero los que ya deberían haberse pagado, luego el resto de
 * pendientes, después pagados y omitidos.
 */
export function fijosDelMes(
  fijos: Fijo[],
  mes: Mes,
  pagos: Movimiento[],
  omitidos: { fijoId: string; mes: Mes }[],
  hoy: Fecha,
): FijoDelMes[] {
  const resultado: FijoDelMes[] = []
  for (const fijo of fijos) {
    const pago = pagos.find((p) => p.fijoId === fijo.id && p.fijoMes === mes) ?? null
    const toca = tocaEnMes(fijo, mes)
    if (!toca && !pago) continue
    const esperada = fechaEsperada(fijo, mes)
    let estado: EstadoFijo
    if (pago) estado = 'pagado'
    else if (omitidos.some((o) => o.fijoId === fijo.id && o.mes === mes)) estado = 'omitido'
    else estado = esperada < hoy ? 'esperado' : 'pendiente'
    resultado.push({ fijo, estado, pago, fechaEsperada: esperada })
  }
  return resultado.sort(
    (a, b) =>
      ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] ||
      (a.fechaEsperada < b.fechaEsperada ? -1 : a.fechaEsperada > b.fechaEsperada ? 1 : 0) ||
      a.fijo.nombre.localeCompare(b.fijo.nombre, 'es'),
  )
}

const cuentaImporte = (i: FijoDelMes) => (i.pago ? i.pago.importe : i.fijo.importe)

export interface ResumenFijos {
  /** Fijos del tipo que cuentan este mes (sin los omitidos). */
  total: number
  pagados: number
  importePagado: number
  /** Lo pagado de verdad más lo previsto de los pendientes. */
  importeTotal: number
}

export function resumenFijos(items: FijoDelMes[], tipo: Fijo['tipo'] = 'gasto'): ResumenFijos {
  const validos = items.filter((i) => i.fijo.tipo === tipo && i.estado !== 'omitido')
  const pagados = validos.filter((i) => i.estado === 'pagado')
  return {
    total: validos.length,
    pagados: pagados.length,
    importePagado: pagados.reduce((t, i) => t + cuentaImporte(i), 0),
    importeTotal: validos.reduce((t, i) => t + cuentaImporte(i), 0),
  }
}

/** Importe previsto de los fijos de un tipo aún sin pagar ni omitir. */
export function previstoPendiente(items: FijoDelMes[], tipo: Fijo['tipo']): number {
  return items
    .filter((i) => i.fijo.tipo === tipo && (i.estado === 'pendiente' || i.estado === 'esperado'))
    .reduce((t, i) => t + i.fijo.importe, 0)
}

/** Movimiento que se crea al marcar un fijo como pagado (o cobrado, o hecho). */
export function movimientoDePago(
  fijo: Fijo,
  mes: Mes,
  datos: { fecha: Fecha; importe: number; cuentaId: string },
): NuevoMovimiento {
  const esTraspaso = fijo.tipo === 'traspaso'
  // Un ingreso cobrado en otro mes (la nómina que llega antes) cuenta para el mes del fijo.
  const propio = mesDeFecha(datos.fecha)
  const imputable = fijo.tipo === 'ingreso' && Math.abs(diferenciaMeses(propio, mes)) === 1
  return {
    tipo: fijo.tipo,
    importe: datos.importe,
    fecha: datos.fecha,
    cuentaId: datos.cuentaId,
    cuentaDestinoId: esTraspaso ? fijo.cuentaDestinoId : null,
    categoriaId: esTraspaso ? null : fijo.categoriaId,
    nota: fijo.nombre,
    fijoId: fijo.id,
    fijoMes: mes,
    mesImputado: imputable ? mes : null,
  }
}

/** Datos para crear un fijo a partir de un movimiento (interruptor "Es fijo"). */
export function fijoDesdeMovimiento(
  m: Pick<
    NuevoMovimiento,
    'tipo' | 'importe' | 'fecha' | 'cuentaId' | 'cuentaDestinoId' | 'categoriaId' | 'mesImputado'
  >,
  nombre: string,
): { fijo: NuevoFijo; mes: Mes } | null {
  if (m.tipo === 'devolucion') return null
  const mes = m.mesImputado ?? mesDeFecha(m.fecha)
  return {
    mes,
    fijo: {
      nombre: nombre.trim(),
      tipo: m.tipo,
      importe: m.importe,
      cuentaId: m.cuentaId,
      cuentaDestinoId: m.cuentaDestinoId,
      categoriaId: m.categoriaId,
      diaMes: diaDeFecha(m.fecha),
      cadaMeses: 1,
      desde: mes,
      hasta: null,
      activo: true,
    },
  }
}

export function validarFijo(f: NuevoFijo): string | null {
  if (!f.nombre.trim()) return 'Escribe un nombre para el fijo.'
  if (!Number.isSafeInteger(f.importe) || f.importe <= 0) return 'Escribe un importe mayor que 0.'
  if (!f.cuentaId) return 'Elige una cuenta.'
  if (f.tipo === 'traspaso') {
    if (!f.cuentaDestinoId) return 'Elige la cuenta de destino.'
    if (f.cuentaDestinoId === f.cuentaId) return 'La cuenta de origen y la de destino deben ser distintas.'
  } else if (!f.categoriaId) {
    return 'Elige una categoría.'
  }
  if (!Number.isInteger(f.diaMes) || f.diaMes < 1 || f.diaMes > 31) return 'El día del mes debe estar entre 1 y 31.'
  if (!/^\d{4}-\d{2}-01$/.test(f.desde)) return 'Elige el primer mes en que toca.'
  if (f.hasta && (!/^\d{4}-\d{2}-01$/.test(f.hasta) || f.hasta < f.desde)) return 'El último mes no puede ser anterior al primero.'
  return null
}
