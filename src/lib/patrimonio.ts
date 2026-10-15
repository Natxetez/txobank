// Patrimonio: "otros saldos" (fuera de las cuentas) y su historial de actualizaciones.
// Funciones puras. El saldo de un otro saldo en un momento es el de su última actualización hasta ese momento
// (0 si aún no tenía ninguna). No afectan al control del mes.
import type { ActualizacionSaldo, Fecha, FechaHora, Mes, OtroSaldo } from '../data/types'
import { finDeMes } from './meses'

const dos = (n: number) => String(n).padStart(2, '0')

/** Instante (ms) de una fecha y hora ISO. */
export const instante = (fh: FechaHora): number => Date.parse(fh)

/** Último instante (23:59:59,999 hora local) de una fecha `YYYY-MM-DD`. */
export function finDelDia(fecha: Fecha): number {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(a, m - 1, d, 23, 59, 59, 999).getTime()
}

/**
 * Última actualización de un otro saldo, opcionalmente hasta un instante (incluido).
 * Si dos tienen la misma fecha y hora, gana la que aparece después en la lista.
 */
export function ultimaActualizacion(
  historial: ActualizacionSaldo[],
  otroSaldoId: string,
  hasta: number = Number.POSITIVE_INFINITY,
): ActualizacionSaldo | null {
  let mejor: ActualizacionSaldo | null = null
  let tMejor = Number.NEGATIVE_INFINITY
  for (const h of historial) {
    if (h.otroSaldoId !== otroSaldoId) continue
    const t = instante(h.fechaHora)
    if (Number.isNaN(t) || t > hasta) continue
    if (t >= tMejor) {
      mejor = h
      tMejor = t
    }
  }
  return mejor
}

export interface SaldoActual {
  otro: OtroSaldo
  /** Céntimos; 0 si aún no tiene actualizaciones. */
  saldo: number
  /** Fecha y hora de la última actualización, o null si no tiene ninguna. */
  fechaHora: FechaHora | null
}

/** Saldo actual (última actualización) de cada otro saldo, en el mismo orden. */
export function saldosActuales(otros: OtroSaldo[], historial: ActualizacionSaldo[]): SaldoActual[] {
  return otros.map((otro) => {
    const u = ultimaActualizacion(historial, otro.id)
    return { otro, saldo: u?.saldo ?? 0, fechaHora: u?.fechaHora ?? null }
  })
}

/** Saldo de un otro saldo en una fecha (al final de ese día, hora local): 0 si aún no existía. */
export function saldoEnFecha(historial: ActualizacionSaldo[], otroSaldoId: string, fecha: Fecha): number {
  return ultimaActualizacion(historial, otroSaldoId, finDelDia(fecha))?.saldo ?? 0
}

/** Saldo de un otro saldo a fin de mes (o hasta `hoy`, si el mes aún no ha terminado). */
export function saldoAFinDeMes(historial: ActualizacionSaldo[], otroSaldoId: string, mes: Mes, hoy?: Fecha): number {
  const fin = finDeMes(mes)
  return saldoEnFecha(historial, otroSaldoId, hoy && hoy < fin ? hoy : fin)
}

/** Total actual de los otros saldos activos (no archivados). */
export function totalOtrosSaldos(otros: OtroSaldo[], historial: ActualizacionSaldo[]): number {
  return saldosActuales(
    otros.filter((o) => !o.archivado),
    historial,
  ).reduce((t, s) => t + s.saldo, 0)
}

/** Total de los otros saldos activos (no archivados) en una fecha. */
export function totalOtrosSaldosEnFecha(otros: OtroSaldo[], historial: ActualizacionSaldo[], fecha: Fecha): number {
  return otros.filter((o) => !o.archivado).reduce((t, o) => t + saldoEnFecha(historial, o.id, fecha), 0)
}

export interface EntradaHistorial {
  actualizacion: ActualizacionSaldo
  /** Diferencia con la actualización anterior (null en la primera). */
  diferencia: number | null
}

/** Historial de un otro saldo, de la más reciente a la más antigua, con la diferencia con la anterior. */
export function historialDe(historial: ActualizacionSaldo[], otroSaldoId: string): EntradaHistorial[] {
  const propias = historial
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.otroSaldoId === otroSaldoId)
    .sort((a, b) => instante(a.h.fechaHora) - instante(b.h.fechaHora) || a.i - b.i)
    .map(({ h }) => h)
  return propias
    .map((h, i) => ({ actualizacion: h, diferencia: i === 0 ? null : h.saldo - propias[i - 1].saldo }))
    .reverse()
}

// --- Formato de fecha y hora (hora local) ----------------------------------

/** "15/10 a las 18:30" (añade el año si no es el de `ahora`). */
export function fechaHoraCorta(fh: FechaHora, ahora: Date = new Date()): string {
  const d = new Date(fh)
  const anio = d.getFullYear() !== ahora.getFullYear() ? `/${d.getFullYear()}` : ''
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}${anio} a las ${dos(d.getHours())}:${dos(d.getMinutes())}`
}

/** Días naturales (hora local) entre dos instantes. */
function diasNaturales(desde: Date, hasta: Date): number {
  const a = Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate())
  const b = Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate())
  return Math.round((b - a) / 86400000)
}

/** "hoy", "ayer", "hace 3 días"… y, a partir de 30 días, la fecha ("el 15/10"). */
export function haceCuanto(fh: FechaHora, ahora: Date = new Date()): string {
  const d = new Date(fh)
  const dias = diasNaturales(d, ahora)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  const anio = d.getFullYear() !== ahora.getFullYear() ? `/${d.getFullYear()}` : ''
  return `el ${dos(d.getDate())}/${dos(d.getMonth() + 1)}${anio}`
}

/** Valor para un `<input type="datetime-local">` (hora local): `2026-10-15T18:30`. */
export function aEntradaLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`
}

/** Lee el valor de un `<input type="datetime-local">` (hora local) y devuelve la fecha y hora ISO, o null. */
export function deEntradaLocal(valor: string): FechaHora | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor)
  if (!m) return null
  const [a, mes, d, h, min] = m.slice(1).map(Number)
  const fecha = new Date(a, mes - 1, d, h, min)
  if (Number.isNaN(fecha.getTime()) || fecha.getMonth() !== mes - 1) return null
  return fecha.toISOString()
}
