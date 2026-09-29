// Presupuestos por mes (SPEC.md, sección 6): herencia, cambio "solo este mes" / "este mes y los siguientes" y sugerencias.
import type { Mes, Movimiento, Presupuesto } from '../data/types'
import { resumenMes } from './control'
import { mesDeFecha, sumarMeses } from './meses'

export interface Vigente {
  importe: number | null
  /** Mes en que se definió el importe vigente (puede ser anterior al consultado: es heredado). */
  definidoEn: Mes | null
}

/** El presupuesto vigente de un mes es el último definido en ese mes o antes. `categoriaId` null = total. */
export function presupuestoVigente(ps: Presupuesto[], mes: Mes, categoriaId: string | null): Vigente {
  let mejor: Presupuesto | null = null
  for (const p of ps) {
    if (p.categoriaId === categoriaId && p.mes <= mes && (!mejor || p.mes > mejor.mes)) mejor = p
  }
  return mejor ? { importe: mejor.importe, definidoEn: mejor.mes } : { importe: null, definidoEn: null }
}

export type Alcance = 'mes' | 'siguientes'

export interface CambioPresupuesto {
  mes: Mes
  categoriaId: string | null
  importe: number | null
}

export interface PlanPresupuesto {
  guardar: CambioPresupuesto[]
  /** Borrar los presupuestos de esa categoría definidos en meses posteriores a `mes`. */
  eliminarPosteriores: boolean
}

/**
 * Qué hay que guardar al cambiar un presupuesto.
 * - Solo este mes: se guarda en ese mes y, si el siguiente no tenía uno propio, se le guarda el importe
 *   anterior para que no herede el cambio (útil para diciembre).
 * - Este mes y los siguientes: se guarda en ese mes y se borran los definidos para meses posteriores.
 * `nuevo` null quita el presupuesto desde ese mes.
 */
export function planCambioPresupuesto(
  ps: Presupuesto[],
  mes: Mes,
  categoriaId: string | null,
  nuevo: number | null,
  alcance: Alcance,
): PlanPresupuesto {
  const guardar: CambioPresupuesto[] = [{ mes, categoriaId, importe: nuevo }]
  if (alcance === 'siguientes') return { guardar, eliminarPosteriores: true }

  const siguiente = sumarMeses(mes, 1)
  const siguienteTienePropio = ps.some((p) => p.categoriaId === categoriaId && p.mes === siguiente)
  if (!siguienteTienePropio) {
    guardar.push({ mes: siguiente, categoriaId, importe: presupuestoVigente(ps, mes, categoriaId).importe })
  }
  return { guardar, eliminarPosteriores: false }
}

/** Aplica un plan a una lista (para comprobar el resultado sin base de datos). */
export function aplicarPlan(ps: Presupuesto[], plan: PlanPresupuesto, mes: Mes, categoriaId: string | null): Presupuesto[] {
  let resultado = plan.eliminarPosteriores
    ? ps.filter((p) => !(p.categoriaId === categoriaId && p.mes > mes))
    : [...ps]
  for (const c of plan.guardar) {
    resultado = resultado.filter((p) => !(p.categoriaId === c.categoriaId && p.mes === c.mes))
    resultado.push({ id: `${c.mes}|${c.categoriaId}`, mes: c.mes, categoriaId: c.categoriaId, importe: c.importe })
  }
  return resultado
}

export type NivelPresupuesto = 'normal' | 'aviso' | 'superado'

/** Normal hasta el 80 %, aviso del 80 % al 100 %, superado a partir del 100 %. */
export function nivelPresupuesto(gastado: number, presupuesto: number): NivelPresupuesto {
  if (presupuesto <= 0) return 'superado'
  if (gastado >= presupuesto) return 'superado'
  if (gastado >= presupuesto * 0.8) return 'aviso'
  return 'normal'
}

/** Si las categorías suman más que el total del mes, devuelve ambas cifras para avisar. */
export function excesoSobreTotal(
  ps: Presupuesto[],
  mes: Mes,
  categoriaIds: string[],
): { suma: number; total: number } | null {
  const total = presupuestoVigente(ps, mes, null).importe
  if (total === null) return null
  const suma = categoriaIds.reduce((t, id) => t + (presupuestoVigente(ps, mes, id).importe ?? 0), 0)
  return suma > total ? { suma, total } : null
}

/** Redondea a múltiplos de 10 €. */
export const redondearDiezEuros = (centimos: number) => Math.round(centimos / 1000) * 1000

/**
 * Media de gasto neto de los hasta `n` meses anteriores a `mes`, contando solo desde el primer mes con
 * movimientos. Devuelve null si no hay ningún mes previo con datos.
 */
export function mediaMensual(
  movs: Movimiento[],
  mes: Mes,
  n = 3,
): { meses: Mes[]; total: number; porCategoria: Record<string, number> } | null {
  if (movs.length === 0) return null
  const primero = movs.reduce((a, m) => (m.fecha < a ? m.fecha : a), movs[0].fecha)
  const primerMes = mesDeFecha(primero)
  const meses = Array.from({ length: n }, (_, i) => sumarMeses(mes, -(i + 1))).filter((m) => m >= primerMes)
  if (meses.length === 0) return null

  const porCategoria: Record<string, number> = {}
  let total = 0
  for (const m of meses) {
    const r = resumenMes(movs, m)
    total += r.gastoNeto
    for (const [id, importe] of Object.entries(r.porCategoria)) porCategoria[id] = (porCategoria[id] ?? 0) + importe
  }
  for (const id of Object.keys(porCategoria)) porCategoria[id] = porCategoria[id] / meses.length
  return { meses, total: total / meses.length, porCategoria }
}

/** Presupuestos sugeridos con la media de 3 meses, redondeada a 10 €. Solo importes positivos. */
export function sugerirDesdeMedia(
  movs: Movimiento[],
  mes: Mes,
  categoriaIds: string[],
): { total: number | null; porCategoria: { categoriaId: string; importe: number }[] } {
  const media = mediaMensual(movs, mes)
  if (!media) return { total: null, porCategoria: [] }
  const total = redondearDiezEuros(media.total)
  return {
    total: total > 0 ? total : null,
    porCategoria: categoriaIds
      .map((categoriaId) => ({ categoriaId, importe: redondearDiezEuros(media.porCategoria[categoriaId] ?? 0) }))
      .filter((s) => s.importe > 0),
  }
}
