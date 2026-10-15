import { describe, expect, it } from 'vitest'
import { saldoInicialParaCerrar, traspasoDeCierre } from './cuentas'

const ing = { id: 'ing', nombre: 'ING' }

describe('traspasoDeCierre', () => {
  it('con saldo positivo, el dinero sale de la cuenta que se cierra', () => {
    expect(traspasoDeCierre(ing, 5000, 'nomina', '2026-10-15', '10:00')).toMatchObject({
      tipo: 'traspaso',
      importe: 5000,
      cuentaId: 'ing',
      cuentaDestinoId: 'nomina',
      categoriaId: null,
      nota: 'Cierre de ING',
      fecha: '2026-10-15',
      hora: '10:00',
    })
  })

  it('con saldo negativo (deuda de tarjeta), el dinero entra en la cuenta que se cierra', () => {
    expect(traspasoDeCierre(ing, -3000, 'nomina', '2026-10-15', '10:00')).toMatchObject({
      importe: 3000,
      cuentaId: 'nomina',
      cuentaDestinoId: 'ing',
    })
  })
})

describe('saldoInicialParaCerrar', () => {
  it('ajusta el saldo inicial para que el saldo quede a 0', () => {
    expect(saldoInicialParaCerrar(10000, 5000)).toBe(5000)
    expect(saldoInicialParaCerrar(0, -2500)).toBe(2500)
  })
})
