// Copia de seguridad (SPEC.md, sección 14): crear el archivo, leerlo y prepararlo para restaurarlo.
// Funciones puras.
import type { CopiaSeguridad, Economia, EconomiaEnCopia, FechaHora } from '../data/types'

export const FORMATO_COPIA = 'txobank-copia'

export function crearCopia(economias: EconomiaEnCopia[], versionApp: string, creada: FechaHora): CopiaSeguridad {
  return { formato: FORMATO_COPIA, version: 1, creada, versionApp, economias }
}

/** Nombre del archivo: `txobank-copia-2026-10-28.json`. */
export const nombreArchivoCopia = (fecha: string) => `txobank-copia-${fecha}.json`

const LISTAS = [
  'cuentas',
  'categorias',
  'presupuestos',
  'fijos',
  'omitidos',
  'fechas',
  'movimientos',
  'grupos',
  'otrosSaldos',
  'historial',
] as const

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Lee el texto de un archivo de copia. Lanza un error con el motivo, en español, si no es válido. */
export function leerCopia(texto: string): CopiaSeguridad {
  let datos: unknown
  try {
    datos = JSON.parse(texto)
  } catch {
    throw new Error('El archivo no es una copia de TxoBank (no se puede leer).')
  }
  if (!esObjeto(datos) || datos.formato !== FORMATO_COPIA) throw new Error('El archivo no es una copia de TxoBank.')
  if (datos.version !== 1) throw new Error('Esta copia es de una versión de TxoBank que esta app no conoce. Actualiza la app.')
  if (!Array.isArray(datos.economias) || datos.economias.length === 0) throw new Error('La copia no tiene ninguna economía.')
  for (const e of datos.economias) {
    const bien =
      esObjeto(e) &&
      esObjeto(e.economia) &&
      typeof e.economia.id === 'string' &&
      typeof e.economia.nombre === 'string' &&
      esObjeto(e.ajustes) &&
      LISTAS.every((l) => Array.isArray(e[l]))
    if (!bien) throw new Error('La copia está incompleta o dañada.')
  }
  return datos as unknown as CopiaSeguridad
}

export interface ResumenCopia {
  creada: FechaHora
  economias: { nombre: string; cuentas: number; movimientos: number; fijos: number }[]
  movimientos: number
}

export function resumenCopia(copia: CopiaSeguridad): ResumenCopia {
  const economias = copia.economias.map((e) => ({
    nombre: e.economia.nombre,
    cuentas: e.cuentas.length,
    movimientos: e.movimientos.length,
    fijos: e.fijos.length,
  }))
  return { creada: copia.creada, economias, movimientos: economias.reduce((t, e) => t + e.movimientos, 0) }
}

/** Nombre libre: "Casa", si ya existe "Casa (restaurada)", luego "Casa (restaurada 2)"… */
function nombreLibre(nombre: string, usados: Set<string>): string {
  const clave = (n: string) => n.trim().toLowerCase()
  let candidato = nombre
  for (let i = 1; usados.has(clave(candidato)); i++) candidato = `${nombre} (restaurada${i > 1 ? ` ${i}` : ''})`
  usados.add(clave(candidato))
  return candidato
}

/**
 * Prepara las economías de una copia para restaurarlas junto a las que ya hay, sin tocarlas: cada fila
 * recibe un id nuevo (y se actualizan todas las referencias), las economías con un nombre que ya existe
 * se renombran y van al final. Lo que apunta fuera de la copia se suelta: la otra mitad de un traspaso
 * entre economías que no está en la copia, o el destino de un fijo que traspasa a una de ellas.
 */
export function prepararRestauracion(
  copia: CopiaSeguridad,
  existentes: Economia[],
  nuevoId: () => string,
): EconomiaEnCopia[] {
  const ids = new Map<string, string>()
  const nuevo = (viejo: string) => {
    let id = ids.get(viejo)
    if (!id) {
      id = nuevoId()
      ids.set(viejo, id)
    }
    return id
  }
  const siExiste = (viejo: string | null) => (viejo !== null && ids.has(viejo) ? ids.get(viejo)! : null)

  // Primero los ids de todo lo que se puede referenciar, para que se resuelvan aunque esté en otra economía.
  // Lo que apunta a algo que no está en la copia (una copia retocada a mano) se descarta.
  for (const e of copia.economias) {
    nuevo(e.economia.id)
    for (const lista of [e.cuentas, e.categorias, e.fijos, e.grupos, e.otrosSaldos]) for (const x of lista) nuevo(x.id)
  }
  // Traspasos entre economías: solo se mantienen si las dos mitades están en la copia.
  const mitades = new Map<string, number>()
  for (const e of copia.economias) {
    for (const m of e.movimientos) if (m.traspasoId) mitades.set(m.traspasoId, (mitades.get(m.traspasoId) ?? 0) + 1)
  }
  const traspasos = new Map<string, string>()
  const traspaso = (viejo: string | null) => {
    if (!viejo || mitades.get(viejo) !== 2) return null
    if (!traspasos.has(viejo)) traspasos.set(viejo, nuevoId())
    return traspasos.get(viejo)!
  }

  const usados = new Set(existentes.map((e) => e.nombre.trim().toLowerCase()))
  const primerOrden = existentes.reduce((max, e) => Math.max(max, e.orden + 1), 0)

  return copia.economias.map((e, i) => ({
    economia: {
      id: nuevo(e.economia.id),
      nombre: nombreLibre(e.economia.nombre, usados),
      color: e.economia.color,
      orden: primerOrden + i,
    },
    ajustes: { ...e.ajustes },
    cuentas: e.cuentas.map((c) => ({ ...c, id: nuevo(c.id) })),
    categorias: e.categorias.map((c) => ({ ...c, id: nuevo(c.id) })),
    grupos: e.grupos
      .filter((g) => ids.has(g.categoriaId))
      .map((g) => ({ ...g, id: nuevo(g.id), categoriaId: nuevo(g.categoriaId) })),
    otrosSaldos: e.otrosSaldos.map((o) => ({ ...o, id: nuevo(o.id) })),
    historial: e.historial
      .filter((h) => ids.has(h.otroSaldoId))
      .map((h) => ({ ...h, id: nuevoId(), otroSaldoId: nuevo(h.otroSaldoId) })),
    presupuestos: e.presupuestos.map((p) => ({ ...p, id: nuevoId(), categoriaId: siExiste(p.categoriaId) })),
    fijos: e.fijos.filter((f) => ids.has(f.cuentaId)).map((f) => {
      const destino = siExiste(f.cuentaDestinoId)
      // Un traspaso a otra economía cuyo destino no está en la copia pasa a ser un gasto normal.
      const sinDestino = f.cuentaDestinoId !== null && destino === null && f.tipo === 'gasto'
      return {
        ...f,
        id: nuevo(f.id),
        cuentaId: nuevo(f.cuentaId),
        cuentaDestinoId: sinDestino ? null : destino,
        categoriaId: siExiste(f.categoriaId),
        categoriaDestinoId: sinDestino ? null : siExiste(f.categoriaDestinoId),
      }
    }),
    omitidos: e.omitidos.filter((o) => ids.has(o.fijoId)).map((o) => ({ ...o, fijoId: nuevo(o.fijoId) })),
    fechas: e.fechas.filter((x) => ids.has(x.fijoId)).map((x) => ({ ...x, fijoId: nuevo(x.fijoId) })),
    movimientos: e.movimientos.filter((m) => ids.has(m.cuentaId)).map((m) => ({
      ...m,
      id: nuevoId(),
      cuentaId: nuevo(m.cuentaId),
      cuentaDestinoId: siExiste(m.cuentaDestinoId),
      categoriaId: siExiste(m.categoriaId),
      fijoId: siExiste(m.fijoId),
      grupoId: siExiste(m.grupoId),
      traspasoId: traspaso(m.traspasoId),
    })),
  }))
}
