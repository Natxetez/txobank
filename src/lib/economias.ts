// Economías (SPEC.md, sección 5): elegir la activa, validar, traspasos entre economías y patrimonio total.
// Funciones puras.
import type {
  ActualizacionSaldo,
  DeEconomia,
  Economia,
  Fecha,
  Fijo,
  Mes,
  Movimiento,
  NuevoMovimiento,
  OtroSaldo,
  Saldo,
  TraspasoEconomias,
} from '../data/types'
import { totalOtrosSaldos } from './patrimonio'

/** Economía con la que se entra: la última usada si sigue existiendo; si no, la primera. */
export function economiaInicial(economias: Economia[], guardada: string | null): string | null {
  return economias.find((e) => e.id === guardada)?.id ?? economias[0]?.id ?? null
}

export const siguienteOrdenEconomia = (economias: Economia[]) =>
  economias.reduce((max, e) => Math.max(max, e.orden + 1), 0)

/** Nombre obligatorio y sin repetir (sin distinguir mayúsculas). `id`: la que se está editando. */
export function validarEconomia(nombre: string, economias: Economia[], id?: string): string | null {
  const limpio = nombre.trim()
  if (!limpio) return 'Escribe un nombre para la economía.'
  if (economias.some((e) => e.id !== id && e.nombre.trim().toLowerCase() === limpio.toLowerCase())) {
    return 'Ya tienes una economía con ese nombre.'
  }
  return null
}

// --- Traspasos entre economías ---------------------------------------------

/** Fijo que es un traspaso a otra economía: un gasto aquí con cuenta de destino allí. */
export const esTraspasoAOtraEconomia = (f: Pick<Fijo, 'tipo' | 'cuentaDestinoId'>) =>
  f.tipo === 'gasto' && f.cuentaDestinoId !== null

/** Las dos mitades: un gasto en la economía de origen y un ingreso en la de destino, con el mismo `traspasoId`. */
export function mitadesDeTraspaso(
  t: TraspasoEconomias,
  traspasoId: string,
): { origen: NuevoMovimiento; destino: NuevoMovimiento } {
  const comun = {
    importe: t.importe,
    fecha: t.fecha,
    hora: t.hora,
    nota: t.nota,
    descripcion: t.descripcion,
    cuentaDestinoId: null,
    mesImputado: null,
    grupoId: null,
    traspasoId,
  }
  return {
    origen: {
      ...comun,
      tipo: 'gasto',
      cuentaId: t.origen.cuentaId,
      categoriaId: t.origen.categoriaId,
      fijoId: t.fijoId,
      fijoMes: t.fijoMes,
    },
    destino: {
      ...comun,
      tipo: 'ingreso',
      cuentaId: t.destino.cuentaId,
      categoriaId: t.destino.categoriaId,
      fijoId: null,
      fijoMes: null,
    },
  }
}

/** Reconstruye el traspaso a partir de sus dos mitades (el gasto es el origen; el ingreso, el destino). */
export function traspasoDeMitades(
  a: DeEconomia<Movimiento>,
  b: DeEconomia<Movimiento>,
): TraspasoEconomias | null {
  const origen = a.tipo === 'gasto' ? a : b.tipo === 'gasto' ? b : null
  const destino = a.tipo === 'ingreso' ? a : b.tipo === 'ingreso' ? b : null
  if (!origen || !destino || !origen.categoriaId || !destino.categoriaId) return null
  return {
    importe: origen.importe,
    fecha: origen.fecha,
    hora: origen.hora,
    nota: origen.nota,
    descripcion: origen.descripcion,
    origen: { economiaId: origen.economiaId, cuentaId: origen.cuentaId, categoriaId: origen.categoriaId },
    destino: { economiaId: destino.economiaId, cuentaId: destino.cuentaId, categoriaId: destino.categoriaId },
    fijoId: origen.fijoId,
    fijoMes: origen.fijoMes,
  }
}

export function validarTraspasoEconomias(t: TraspasoEconomias): string | null {
  if (!Number.isSafeInteger(t.importe) || t.importe <= 0) return 'Escribe un importe mayor que 0.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.fecha)) return 'Elige una fecha.'
  if (!t.origen.cuentaId || !t.destino.cuentaId) return 'Elige las cuentas de origen y destino.'
  if (t.origen.economiaId === t.destino.economiaId) return 'Las dos cuentas son de la misma economía.'
  if (!t.origen.categoriaId) return 'Elige en qué categoría de gasto cuenta en la economía de origen.'
  if (!t.destino.categoriaId) return 'Elige en qué categoría de ingreso cuenta en la economía de destino.'
  return null
}

/** Traspaso que se crea al marcar como hecho un fijo que es un traspaso a otra economía. */
export function traspasoDePago(
  fijo: Fijo,
  mes: Mes,
  datos: { fecha: Fecha; importe: number; cuentaId: string },
  economiaOrigen: string,
  economiaDestino: string,
): TraspasoEconomias {
  return {
    importe: datos.importe,
    fecha: datos.fecha,
    hora: null,
    nota: fijo.nombre,
    descripcion: fijo.descripcion,
    origen: { economiaId: economiaOrigen, cuentaId: datos.cuentaId, categoriaId: fijo.categoriaId ?? '' },
    destino: {
      economiaId: economiaDestino,
      cuentaId: fijo.cuentaDestinoId ?? '',
      categoriaId: fijo.categoriaDestinoId ?? '',
    },
    fijoId: fijo.id,
    fijoMes: mes,
  }
}

// --- Patrimonio de todas las economías -------------------------------------

export interface PatrimonioEconomia {
  economia: Economia
  /** Cuentas más otros saldos activos. */
  total: number
}

/** Patrimonio actual de cada economía (en su orden) y la suma de todas. */
export function patrimonioPorEconomia(
  economias: Economia[],
  saldos: DeEconomia<Saldo>[],
  otros: DeEconomia<OtroSaldo>[],
  historial: ActualizacionSaldo[],
): { economias: PatrimonioEconomia[]; total: number } {
  const lista = economias.map((economia) => {
    const cuentas = saldos.filter((s) => s.economiaId === economia.id).reduce((t, s) => t + s.saldo, 0)
    const propios = otros.filter((o) => o.economiaId === economia.id)
    return { economia, total: cuentas + totalOtrosSaldos(propios, historial) }
  })
  return { economias: lista, total: lista.reduce((t, e) => t + e.total, 0) }
}
