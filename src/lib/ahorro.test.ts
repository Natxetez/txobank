import { describe, expect, it } from 'vitest'
import { ajustesDesdeCampos, camposDesdeAjustes } from './ahorro'

describe('ajustesDesdeCampos', () => {
  it('sin objetivo', () => {
    expect(ajustesDesdeCampos({ tipo: '', valor: '' })).toEqual({ ahorroTipo: null, ahorroValor: null })
  })

  it('importe en céntimos', () => {
    expect(ajustesDesdeCampos({ tipo: 'importe', valor: '300' })).toEqual({ ahorroTipo: 'importe', ahorroValor: 30000 })
  })

  it('porcentaje entero entre 1 y 100', () => {
    expect(ajustesDesdeCampos({ tipo: 'porcentaje', valor: '15' })).toEqual({
      ahorroTipo: 'porcentaje',
      ahorroValor: 15,
    })
    expect(ajustesDesdeCampos({ tipo: 'porcentaje', valor: '0' })).toBeNull()
    expect(ajustesDesdeCampos({ tipo: 'porcentaje', valor: '101' })).toBeNull()
    expect(ajustesDesdeCampos({ tipo: 'porcentaje', valor: '12,5' })).toBeNull()
  })

  it('rechaza importes vacíos, cero o inválidos', () => {
    expect(ajustesDesdeCampos({ tipo: 'importe', valor: '' })).toBeNull()
    expect(ajustesDesdeCampos({ tipo: 'importe', valor: '0' })).toBeNull()
    expect(ajustesDesdeCampos({ tipo: 'importe', valor: 'abc' })).toBeNull()
  })
})

describe('camposDesdeAjustes', () => {
  it('ida y vuelta', () => {
    const a = { ahorroTipo: 'importe' as const, ahorroValor: 30050 }
    expect(ajustesDesdeCampos(camposDesdeAjustes(a))).toEqual(a)
    expect(camposDesdeAjustes({ ahorroTipo: null, ahorroValor: null })).toEqual({ tipo: '', valor: '' })
  })
})
