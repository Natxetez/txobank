// Grupos de gastos ("Cafés y pintxos"): gastos repetidos reunidos bajo un nombre y una categoría fija.
// El grupo es permanente; su total se cuenta por meses (cada mes empieza de cero sin crear nada).
// Las entradas son gastos normales: aquí solo se separan y resumen para mostrarlas.
import type { Categoria, Grupo, Mes, Movimiento } from '../data/types'
import { mesDeFecha } from './meses'
import { normalizarConcepto } from './movimientos'

/** Un movimiento es entrada de un grupo si es un gasto con un `grupoId` de los grupos conocidos. */
const esEntradaDe = (m: Movimiento, ids: Set<string>) => m.tipo === 'gasto' && m.grupoId !== null && ids.has(m.grupoId)

/**
 * Separa los movimientos de un mes en sueltos y entradas de grupos, respetando el orden recibido.
 * Lo que no es de ese mes se descarta. Un `grupoId` que no está en `grupos` (o en algo que no es
 * un gasto) cuenta como suelto, para que nunca desaparezca de las listas.
 */
export function separarPorGrupo(
  movs: Movimiento[],
  grupos: Pick<Grupo, 'id'>[],
  mes: Mes,
): { sueltos: Movimiento[]; agrupados: Movimiento[] } {
  const ids = new Set(grupos.map((g) => g.id))
  const sueltos: Movimiento[] = []
  const agrupados: Movimiento[] = []
  for (const m of movs) {
    if (mesDeFecha(m.fecha) !== mes) continue
    ;(esEntradaDe(m, ids) ? agrupados : sueltos).push(m)
  }
  return { sueltos, agrupados }
}

/** Ordena entradas de la más reciente a la más antigua: por fecha y, dentro del día, por hora (sin hora, al final). */
export function ordenarEntradas(entradas: Movimiento[]): Movimiento[] {
  return entradas
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      if (a.m.fecha !== b.m.fecha) return a.m.fecha < b.m.fecha ? 1 : -1
      const ha = a.m.hora ?? ''
      const hb = b.m.hora ?? ''
      if (ha !== hb) return ha < hb ? 1 : -1
      return a.i - b.i
    })
    .map((x) => x.m)
}

export interface ResumenGrupo {
  grupo: Grupo
  /** Suma de sus entradas del mes, en céntimos. */
  total: number
  numEntradas: number
  /** Entradas del mes, de la más reciente a la más antigua. */
  entradas: Movimiento[]
}

/**
 * Resumen de cada grupo en un mes, en el orden de los grupos (`orden` y, a igualdad, nombre).
 * Por defecto solo salen los grupos con entradas ese mes (archivados incluidos).
 * Con `incluirVacios`, salen también los grupos activos sin entradas (con total 0).
 */
export function resumenGrupos(
  movs: Movimiento[],
  grupos: Grupo[],
  mes: Mes,
  { incluirVacios = false }: { incluirVacios?: boolean } = {},
): ResumenGrupo[] {
  const { agrupados } = separarPorGrupo(movs, grupos, mes)
  const porGrupo = new Map<string, Movimiento[]>()
  for (const m of agrupados) porGrupo.set(m.grupoId!, [...(porGrupo.get(m.grupoId!) ?? []), m])

  return ordenarGrupos(grupos)
    .filter((g) => porGrupo.has(g.id) || (incluirVacios && !g.archivado))
    .map((grupo) => {
      const entradas = ordenarEntradas(porGrupo.get(grupo.id) ?? [])
      return {
        grupo,
        total: entradas.reduce((t, m) => t + m.importe, 0),
        numEntradas: entradas.length,
        entradas,
      }
    })
}

/** Grupos por `orden` y, a igualdad, por nombre. */
export function ordenarGrupos<T extends Pick<Grupo, 'orden' | 'nombre'>>(grupos: T[]): T[] {
  return [...grupos].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
}

/** `orden` para un grupo nuevo: detrás del último. */
export const siguienteOrdenGrupo = (grupos: Pick<Grupo, 'orden'>[]) =>
  grupos.reduce((max, g) => Math.max(max, g.orden + 1), 0)

/** "1 entrada", "23 entradas". */
export const textoEntradas = (n: number) => (n === 1 ? '1 entrada' : `${n} entradas`)

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** Fecha y hora de una entrada: "mar 14 · 09:35" (sin hora, "mar 14"). */
export function etiquetaEntrada(m: Pick<Movimiento, 'fecha' | 'hora'>): string {
  const [a, mes, d] = m.fecha.split('-').map(Number)
  const dia = `${DIAS_CORTOS[new Date(a, mes - 1, d).getDay()]} ${d}`
  return m.hora ? `${dia} · ${m.hora}` : dia
}

export interface DatosGrupo {
  nombre: string
  categoriaId: string | null
}

/**
 * Valida un grupo antes de crearlo o editarlo. Devuelve el mensaje de error en español, o null.
 * El nombre es obligatorio y único (sin distinguir mayúsculas ni acentos); la categoría, de gasto.
 * `idPropio` es el del grupo que se edita, para no chocar consigo mismo.
 */
export function validarGrupo(
  datos: DatosGrupo,
  categorias: Pick<Categoria, 'id' | 'tipo'>[],
  grupos: Pick<Grupo, 'id' | 'nombre'>[],
  idPropio?: string,
): string | null {
  const nombre = normalizarConcepto(datos.nombre)
  if (!nombre) return 'Escribe un nombre para el grupo.'
  if (datos.nombre.trim().length > 60) return 'El nombre es demasiado largo (máximo 60 caracteres).'
  if (grupos.some((g) => g.id !== idPropio && normalizarConcepto(g.nombre) === nombre)) {
    return 'Ya tienes un grupo con ese nombre.'
  }
  if (!datos.categoriaId) return 'Elige una categoría.'
  const cat = categorias.find((c) => c.id === datos.categoriaId)
  if (!cat) return 'Elige una categoría.'
  if (cat.tipo !== 'gasto') return 'La categoría de un grupo tiene que ser de gasto.'
  return null
}

