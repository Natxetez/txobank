// Fechas y meses naturales. El resto de la app no calcula fechas de mes por su cuenta (SPEC.md, sección 6).
import type { Fecha, Mes } from '../../data/types'

const dos = (n: number) => String(n).padStart(2, '0')

const NOMBRES_MES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function partes(fecha: Fecha): [number, number, number] {
  const [a, m, d] = fecha.split('-').map(Number)
  return [a, m, d ?? 1]
}

/** Fecha local de hoy (no UTC) como `YYYY-MM-DD`. */
export function hoyISO(ahora: Date = new Date()): Fecha {
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`
}

/** `2026-09-29` → `2026-09-01` */
export function mesDeFecha(fecha: Fecha): Mes {
  return `${fecha.slice(0, 7)}-01`
}

/** Mes natural en curso como `YYYY-MM-01`. */
export function mesActual(ahora: Date = new Date()): Mes {
  return mesDeFecha(hoyISO(ahora))
}

/** Suma (o resta, con n negativo) meses a un mes. Cambia de año cuando toca. */
export function sumarMeses(mes: Mes, n: number): Mes {
  const [a, m] = partes(mes)
  const indice = a * 12 + (m - 1) + n
  return `${Math.floor(indice / 12)}-${dos((indice % 12) + 1)}-01`
}

/** Suma (o resta) días a una fecha. */
export function sumarDias(fecha: Fecha, n: number): Fecha {
  const [a, m, d] = partes(fecha)
  return hoyISO(new Date(a, m - 1, d + n))
}

/** Último día del mes: `2026-02-01` → `2026-02-28`. */
export function finDeMes(mes: Mes): Fecha {
  const [a, m] = partes(mes)
  return `${a}-${dos(m)}-${dos(new Date(a, m, 0).getDate())}`
}

/** Número de días del mes. */
export function diasDelMes(mes: Mes): number {
  return Number(finDeMes(mes).slice(8))
}

/** `2026-09-01` → "septiembre" */
export function nombreMes(mes: Mes): string {
  return NOMBRES_MES[partes(mes)[1] - 1]
}

/** `2026-09-01` → "septiembre 2026" */
export function etiquetaMes(mes: Mes): string {
  return `${nombreMes(mes)} ${partes(mes)[0]}`
}

/** `2026-09-29` → "martes 29 de septiembre" */
export function formatoDia(fecha: Fecha): string {
  const [a, m, d] = partes(fecha)
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(a, m - 1, d),
  )
}

/** Meses de diferencia entre dos meses: `diferenciaMeses('2026-01-01', '2026-04-01')` = 3. */
export function diferenciaMeses(a: Mes, b: Mes): number {
  const [ya, ma] = partes(a)
  const [yb, mb] = partes(b)
  return (yb - ya) * 12 + (mb - ma)
}

/** Día del mes de una fecha. */
export function diaDeFecha(fecha: Fecha): number {
  return partes(fecha)[2]
}

/** Todos los meses entre dos meses, ambos incluidos (vacío si `hasta` es anterior a `desde`). */
export function mesesEntre(desde: Mes, hasta: Mes): Mes[] {
  const n = diferenciaMeses(desde, hasta)
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => sumarMeses(desde, i))
}

/** Fecha con ese día dentro del mes, ajustando al último día si el mes es más corto (31 → 30, 28…). */
export function fechaEnMes(mes: Mes, dia: number): Fecha {
  const [a, m] = partes(mes)
  return `${a}-${dos(m)}-${dos(Math.min(dia, diasDelMes(mes)))}`
}
