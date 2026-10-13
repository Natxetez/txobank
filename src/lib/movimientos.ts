// Lógica pura de movimientos: validación, entrada rápida (frecuentes, sugerencias), agrupado y filtros.
import type { Categoria, Fecha, Movimiento, TipoCategoria, TipoMovimiento } from '../data/types'
import { mesDeFecha, sumarDias, sumarMeses } from './meses'

const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Para comparar conceptos sin importar mayúsculas, acentos ni espacios repetidos. */
export const normalizarConcepto = (s: string) => quitarAcentos(s).trim().toLowerCase().replace(/\s+/g, ' ')

/** Tipo de categoría que usa un tipo de movimiento; los traspasos no llevan. */
export function tipoCategoriaDe(tipo: TipoMovimiento): TipoCategoria | null {
  if (tipo === 'traspaso') return null
  return tipo === 'ingreso' ? 'ingreso' : 'gasto'
}

const enVentana = (m: Movimiento, hoy: Fecha, dias: number) => m.fecha >= sumarDias(hoy, -dias) && m.fecha <= hoy

// --- Validación ------------------------------------------------------------

export type DatosValidables = Pick<
  Movimiento,
  'tipo' | 'importe' | 'fecha' | 'cuentaId' | 'cuentaDestinoId' | 'categoriaId' | 'mesImputado'
>

/** Devuelve el mensaje de error en español, o null si el movimiento es coherente. */
export function validarMovimiento(m: DatosValidables): string | null {
  if (!Number.isSafeInteger(m.importe) || m.importe <= 0) return 'Escribe un importe mayor que 0.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha)) return 'Elige una fecha válida.'
  if (!m.cuentaId) return 'Elige una cuenta.'
  if (m.tipo === 'traspaso') {
    if (!m.cuentaDestinoId) return 'Elige la cuenta de destino.'
    if (m.cuentaDestinoId === m.cuentaId) return 'La cuenta de origen y la de destino deben ser distintas.'
    if (m.categoriaId) return 'Un traspaso no lleva categoría.'
  } else {
    if (!m.categoriaId) return 'Elige una categoría.'
    if (m.cuentaDestinoId) return 'Solo los traspasos llevan cuenta de destino.'
  }
  if (m.mesImputado) {
    if (m.tipo !== 'ingreso') return 'Solo los ingresos pueden contar para otro mes.'
    const propio = mesDeFecha(m.fecha)
    if (m.mesImputado !== sumarMeses(propio, -1) && m.mesImputado !== sumarMeses(propio, 1)) {
      return 'Un ingreso solo puede contar para el mes anterior o el siguiente al de su fecha.'
    }
  }
  return null
}

// --- Entrada rápida --------------------------------------------------------

export interface Frecuente {
  nota: string
  categoriaId: string
  /** Importe habitual: el más repetido (a igualdad, el más reciente). */
  importe: number
  cuentaId: string
  veces: number
}

/**
 * Gastos repetidos: mismo concepto y categoría al menos `minVeces` veces en `dias` días.
 * Los pagos de fijos no cuentan (no son gastos de entrada rápida).
 */
export function detectarFrecuentes(
  movs: Movimiento[],
  hoy: Fecha,
  { dias = 90, minVeces = 3, max = 6 }: { dias?: number; minVeces?: number; max?: number } = {},
): Frecuente[] {
  const grupos = new Map<string, Movimiento[]>()
  for (const m of movs) {
    if (m.tipo !== 'gasto' || m.fijoId || !m.categoriaId || !m.nota.trim() || !enVentana(m, hoy, dias)) continue
    const clave = `${normalizarConcepto(m.nota)}|${m.categoriaId}`
    grupos.set(clave, [...(grupos.get(clave) ?? []), m])
  }

  const resultado: (Frecuente & { ultima: Fecha })[] = []
  for (const lista of grupos.values()) {
    if (lista.length < minVeces) continue
    const reciente = lista.reduce((a, b) => (b.fecha > a.fecha ? b : a))

    const porImporte = new Map<number, { n: number; ultima: Fecha }>()
    for (const m of lista) {
      const e = porImporte.get(m.importe) ?? { n: 0, ultima: '' }
      e.n += 1
      if (m.fecha > e.ultima) e.ultima = m.fecha
      porImporte.set(m.importe, e)
    }
    let habitual = reciente.importe
    let mejor = { n: 0, ultima: '' }
    for (const [importe, e] of porImporte) {
      if (e.n > mejor.n || (e.n === mejor.n && e.ultima > mejor.ultima)) {
        habitual = importe
        mejor = e
      }
    }

    resultado.push({
      nota: reciente.nota.trim(),
      categoriaId: reciente.categoriaId!,
      importe: habitual,
      cuentaId: reciente.cuentaId,
      veces: lista.length,
      ultima: reciente.fecha,
    })
  }

  resultado.sort((a, b) => b.veces - a.veces || (a.ultima < b.ultima ? 1 : a.ultima > b.ultima ? -1 : 0))
  return resultado.slice(0, max).map(({ ultima: _ultima, ...f }) => f)
}

/** Categorías con las más usadas en los últimos `dias` días primero; a igualdad, su orden original. */
export function ordenarPorUso<T extends Pick<Categoria, 'id'>>(
  categorias: T[],
  movs: Movimiento[],
  hoy: Fecha,
  dias = 90,
): T[] {
  const uso = new Map<string, number>()
  for (const m of movs) {
    if (m.categoriaId && enVentana(m, hoy, dias)) uso.set(m.categoriaId, (uso.get(m.categoriaId) ?? 0) + 1)
  }
  return categorias
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (uso.get(b.c.id) ?? 0) - (uso.get(a.c.id) ?? 0) || a.i - b.i)
    .map((x) => x.c)
}

/** Categoría más habitual para un concepto exacto (a igualdad, la más reciente). */
export function sugerirCategoria(nota: string, movs: Movimiento[], tipoCategoria: TipoCategoria): string | null {
  const objetivo = normalizarConcepto(nota)
  if (!objetivo) return null
  const cuenta = new Map<string, { n: number; ultima: Fecha }>()
  for (const m of movs) {
    if (!m.categoriaId || tipoCategoriaDe(m.tipo) !== tipoCategoria || normalizarConcepto(m.nota) !== objetivo) continue
    const e = cuenta.get(m.categoriaId) ?? { n: 0, ultima: '' }
    e.n += 1
    if (m.fecha > e.ultima) e.ultima = m.fecha
    cuenta.set(m.categoriaId, e)
  }
  let mejorId: string | null = null
  let mejor = { n: 0, ultima: '' }
  for (const [id, e] of cuenta) {
    if (e.n > mejor.n || (e.n === mejor.n && e.ultima > mejor.ultima)) {
      mejorId = id
      mejor = e
    }
  }
  return mejorId
}

/** Conceptos anteriores que contienen lo escrito: primero los que empiezan igual, luego los más usados. */
export function sugerirConceptos(
  texto: string,
  movs: Movimiento[],
  tipoCategoria: TipoCategoria,
  max = 5,
): string[] {
  const q = normalizarConcepto(texto)
  if (!q) return []
  const conceptos = new Map<string, { nota: string; n: number; ultima: Fecha }>()
  for (const m of movs) {
    if (!m.nota.trim() || tipoCategoriaDe(m.tipo) !== tipoCategoria) continue
    const clave = normalizarConcepto(m.nota)
    if (!clave.includes(q) || clave === q) continue
    const e = conceptos.get(clave) ?? { nota: m.nota.trim(), n: 0, ultima: '' }
    e.n += 1
    if (m.fecha > e.ultima) {
      e.ultima = m.fecha
      e.nota = m.nota.trim()
    }
    conceptos.set(clave, e)
  }
  return [...conceptos.entries()]
    .sort(([ka, a], [kb, b]) => {
      const pa = ka.startsWith(q) ? 0 : 1
      const pb = kb.startsWith(q) ? 0 : 1
      return pa - pb || b.n - a.n || (a.ultima < b.ultima ? 1 : a.ultima > b.ultima ? -1 : 0)
    })
    .slice(0, max)
    .map(([, e]) => e.nota)
}

/** Cuenta del movimiento más reciente (a igualdad de fecha, el primero de la lista). */
export function ultimaCuentaUsada(movs: Movimiento[]): string | null {
  let mejor: Movimiento | null = null
  for (const m of movs) if (!mejor || m.fecha > mejor.fecha) mejor = m
  return mejor?.cuentaId ?? null
}

// --- Lista -----------------------------------------------------------------

export interface GrupoDia {
  fecha: Fecha
  movimientos: Movimiento[]
  /** Gastos menos devoluciones del día. Los ingresos y traspasos no cuentan. */
  gastoNeto: number
}

/** Agrupa por día, del más reciente al más antiguo, respetando el orden dentro de cada día. */
export function agruparPorDia(movs: Movimiento[]): GrupoDia[] {
  const grupos = new Map<Fecha, Movimiento[]>()
  for (const m of movs) grupos.set(m.fecha, [...(grupos.get(m.fecha) ?? []), m])
  return [...grupos.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([fecha, movimientos]) => ({
      fecha,
      movimientos,
      gastoNeto: movimientos.reduce(
        (t, m) => t + (m.tipo === 'gasto' ? m.importe : m.tipo === 'devolucion' ? -m.importe : 0),
        0,
      ),
    }))
}

export interface FiltroMovimientos {
  cuentaId?: string
  categoriaId?: string
  tipo?: TipoMovimiento
  texto?: string
  /** Solo pagos de fijos, o solo el resto (variables). */
  fijo?: 'fijo' | 'variable'
}

export function filtrarMovimientos(movs: Movimiento[], f: FiltroMovimientos): Movimiento[] {
  const texto = f.texto ? normalizarConcepto(f.texto) : ''
  return movs.filter(
    (m) =>
      (!f.cuentaId || m.cuentaId === f.cuentaId || m.cuentaDestinoId === f.cuentaId) &&
      (!f.categoriaId || m.categoriaId === f.categoriaId) &&
      (!f.tipo || m.tipo === f.tipo) &&
      (!f.fijo || (f.fijo === 'fijo') === (m.fijoId !== null)) &&
      (!texto || normalizarConcepto(`${m.nota} ${m.descripcion}`).includes(texto)),
  )
}
