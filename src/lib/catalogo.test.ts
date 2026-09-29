import { describe, expect, it } from 'vitest'
import { PALETA, categoriasPorDefecto, colorPorPosicion } from './catalogo'

describe('categoriasPorDefecto', () => {
  const cats = categoriasPorDefecto()

  it('crea 8 de gasto y 2 de ingreso', () => {
    expect(cats.filter((c) => c.tipo === 'gasto')).toHaveLength(8)
    expect(cats.filter((c) => c.tipo === 'ingreso').map((c) => c.nombre)).toEqual(['Nómina', 'Otros ingresos'])
  })

  it('no repite nombre dentro de un tipo y el orden empieza en 0', () => {
    for (const tipo of ['gasto', 'ingreso'] as const) {
      const delTipo = cats.filter((c) => c.tipo === tipo)
      expect(new Set(delTipo.map((c) => c.nombre)).size).toBe(delTipo.length)
      expect(delTipo.map((c) => c.orden)).toEqual(delTipo.map((_, i) => i))
    }
  })
})

describe('colorPorPosicion', () => {
  it('da la vuelta a la paleta', () => {
    expect(PALETA).toHaveLength(10)
    expect(colorPorPosicion(0)).toBe(PALETA[0])
    expect(colorPorPosicion(10)).toBe(PALETA[0])
    expect(colorPorPosicion(13)).toBe(PALETA[3])
  })
})
