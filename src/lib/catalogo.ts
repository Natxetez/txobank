import type { NuevaCategoria, TipoCuenta } from '../data/types'

/** 10 colores armónicos con la paleta de la app, asignados en orden al crear (SPEC.md, sección 12). */
export const PALETA = [
  '#12B886',
  '#4C6EF5',
  '#F59F00',
  '#E64980',
  '#7950F2',
  '#15AABF',
  '#F76707',
  '#82C91E',
  '#FA5252',
  '#868E96',
]

export const colorPorPosicion = (n: number) => PALETA[n % PALETA.length]

export const ETIQUETA_TIPO_CUENTA: Record<TipoCuenta, string> = {
  corriente: 'Cuenta corriente',
  ahorro: 'Ahorro',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
}

const GASTO: [string, string][] = [
  ['Comida', '🛒'],
  ['Casa', '🏠'],
  ['Transporte', '🚌'],
  ['Ocio', '🎉'],
  ['Salud', '💊'],
  ['Compras', '🛍️'],
  ['Suscripciones', '🔁'],
  ['Otros', '📦'],
]

const INGRESO: [string, string][] = [
  ['Nómina', '💼'],
  ['Otros ingresos', '➕'],
]

/** Categorías que se crean en el asistente de primera vez. */
export function categoriasPorDefecto(): NuevaCategoria[] {
  const crear = (tipo: NuevaCategoria['tipo'], lista: [string, string][]) =>
    lista.map(([nombre, icono], i) => ({
      nombre,
      tipo,
      icono,
      color: colorPorPosicion(i),
      orden: i,
      archivada: false,
    }))
  return [...crear('gasto', GASTO), ...crear('ingreso', INGRESO)]
}
