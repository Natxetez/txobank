import type { Ajustes } from '../data/types'
import { aTextoEditable, parseImporte } from './dinero'

/** Estado de los campos del formulario del objetivo de ahorro. */
export interface CamposAhorro {
  tipo: '' | 'importe' | 'porcentaje'
  valor: string
}

export function camposDesdeAjustes(a: Ajustes): CamposAhorro {
  if (!a.ahorroTipo || a.ahorroValor === null) return { tipo: '', valor: '' }
  return {
    tipo: a.ahorroTipo,
    valor: a.ahorroTipo === 'importe' ? aTextoEditable(a.ahorroValor) : String(a.ahorroValor),
  }
}

/** Devuelve los ajustes a guardar, o null si el valor escrito no es válido. */
export function ajustesDesdeCampos(c: CamposAhorro): Ajustes | null {
  if (c.tipo === '') return { ahorroTipo: null, ahorroValor: null }
  if (c.tipo === 'importe') {
    const v = parseImporte(c.valor)
    return v && v > 0 ? { ahorroTipo: 'importe', ahorroValor: v } : null
  }
  const t = c.valor.trim()
  if (!/^\d{1,3}$/.test(t)) return null
  const pct = Number(t)
  return pct >= 1 && pct <= 100 ? { ahorroTipo: 'porcentaje', ahorroValor: pct } : null
}
