// Gastos fijos (SPEC.md, sección 7): qué toca cada mes, su estado, coste y cómo se convierte un pago en movimiento.
import type { Fecha, Fijo, FijoFecha, Mes, Movimiento, NuevoFijo, NuevoMovimiento } from '../data/types'
import { diaDeFecha, diasEntre, diferenciaMeses, fechaEnMes, mesDeFecha, sumarDias, sumarMeses } from './meses'

export const PERIODICIDADES = [
  { valor: 1, etiqueta: 'Mensual' },
  { valor: 2, etiqueta: 'Bimestral' },
  { valor: 3, etiqueta: 'Trimestral' },
  { valor: 6, etiqueta: 'Semestral' },
  { valor: 12, etiqueta: 'Anual' },
]

/** Cargo puntual ("Una vez"): toca solo en un mes, el primero y el último a la vez. */
export const esPuntual = (f: Pick<Fijo, 'desde' | 'hasta'>) => f.hasta !== null && f.hasta === f.desde

export const etiquetaPeriodicidad = (f: Pick<Fijo, 'cadaMeses' | 'desde' | 'hasta'>) =>
  esPuntual(f)
    ? 'Una vez'
    : (PERIODICIDADES.find((p) => p.valor === f.cadaMeses)?.etiqueta ?? `Cada ${f.cadaMeses} meses`)

type Coste = Pick<Fijo, 'importe' | 'cadaMeses' | 'desde' | 'hasta'>

/** Coste mensual equivalente: importe / cada_meses. Un cargo puntual no es un coste que se repita: 0. */
export const costeMensual = (f: Coste) => (esPuntual(f) ? 0 : Math.round(f.importe / f.cadaMeses))

/** Coste anual: importe × 12 / cada_meses. Un cargo puntual: 0. */
export const costeAnual = (f: Coste) => (esPuntual(f) ? 0 : Math.round((f.importe * 12) / f.cadaMeses))

/** ¿Toca este fijo en ese mes? Según activo, desde, hasta y periodicidad. */
export function tocaEnMes(f: Fijo, mes: Mes): boolean {
  if (!f.activo) return false
  const desdeInicio = diferenciaMeses(f.desde, mes)
  if (desdeInicio < 0) return false
  if (f.hasta && mes > f.hasta) return false
  return desdeInicio % f.cadaMeses === 0
}

/**
 * Fecha del cargo en ese mes: la fijada para ese mes, si la hay; si no, el día habitual
 * (ajustado si el mes es más corto).
 */
export function fechaEsperada(f: Pick<Fijo, 'id' | 'diaMes'>, mes: Mes, fechas: FijoFecha[] = []): Fecha {
  return fechas.find((x) => x.fijoId === f.id && x.mes === mes)?.fecha ?? fechaEnMes(mes, f.diaMes)
}

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
  /** La fecha de este mes se ha cambiado a mano (no es la del día habitual). */
  fechaCambiada: boolean
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
  fechas: FijoFecha[] = [],
): FijoDelMes[] {
  const resultado: FijoDelMes[] = []
  for (const fijo of fijos) {
    const pago = pagos.find((p) => p.fijoId === fijo.id && p.fijoMes === mes) ?? null
    const toca = tocaEnMes(fijo, mes)
    if (!toca && !pago) continue
    const esperada = fechaEsperada(fijo, mes, fechas)
    const fechaCambiada = fechas.some((x) => x.fijoId === fijo.id && x.mes === mes)
    let estado: EstadoFijo
    if (pago) estado = 'pagado'
    else if (omitidos.some((o) => o.fijoId === fijo.id && o.mes === mes)) estado = 'omitido'
    else estado = esperada < hoy ? 'esperado' : 'pendiente'
    resultado.push({ fijo, estado, pago, fechaEsperada: esperada, fechaCambiada })
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

export interface CargoProximo extends FijoDelMes {
  /** Mes del fijo al que corresponde el cargo (puede ser el siguiente al de hoy). */
  mes: Mes
  /** Días que faltan hasta la fecha del cargo; negativo si ya debería haberse cobrado. */
  dias: number
}

/**
 * Cargos que se acercan: fijos pendientes del mes de hoy y del siguiente cuya fecha cae en los
 * próximos `ventana` días, más los del mes de hoy que ya deberían haberse cobrado. Por fecha.
 */
export function proximosCargos(
  fijos: Fijo[],
  pagos: Movimiento[],
  omitidos: { fijoId: string; mes: Mes }[],
  fechas: FijoFecha[],
  hoy: Fecha,
  ventana = 7,
): CargoProximo[] {
  const limite = sumarDias(hoy, ventana)
  const mesHoy = mesDeFecha(hoy)
  const resultado: CargoProximo[] = []
  for (const mes of [mesHoy, sumarMeses(mesHoy, 1)]) {
    for (const item of fijosDelMes(fijos, mes, pagos, omitidos, hoy, fechas)) {
      if (item.estado !== 'pendiente' && item.estado !== 'esperado') continue
      if (item.fechaEsperada > limite) continue
      resultado.push({ ...item, mes, dias: diasEntre(hoy, item.fechaEsperada) })
    }
  }
  return resultado.sort((a, b) => a.dias - b.dias || a.fijo.nombre.localeCompare(b.fijo.nombre, 'es'))
}

/** "Hoy", "Mañana", "En 3 días", "Hace 2 días" para un cargo próximo. */
export function textoDias(dias: number): string {
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  if (dias > 1) return `En ${dias} días`
  if (dias === -1) return 'Ayer'
  return `Hace ${-dias} días`
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
    descripcion: fijo.descripcion,
    fijoId: fijo.id,
    fijoMes: mes,
    mesImputado: imputable ? mes : null,
  }
}

/** Datos para crear un fijo a partir de un movimiento (interruptor "Es fijo"). */
export function fijoDesdeMovimiento(
  m: Pick<
    NuevoMovimiento,
    'tipo' | 'importe' | 'fecha' | 'cuentaId' | 'cuentaDestinoId' | 'categoriaId' | 'mesImputado' | 'descripcion'
  >,
  nombre: string,
): { fijo: NuevoFijo; mes: Mes } | null {
  if (m.tipo === 'devolucion') return null
  const mes = m.mesImputado ?? mesDeFecha(m.fecha)
  return {
    mes,
    fijo: {
      nombre: nombre.trim(),
      descripcion: m.descripcion.trim(),
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
