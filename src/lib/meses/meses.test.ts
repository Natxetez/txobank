import { describe, expect, it } from 'vitest'
import {
  diasDelMes,
  etiquetaMes,
  finDeMes,
  formatoDia,
  hoyISO,
  mesActual,
  mesDeFecha,
  nombreMes,
  sumarDias,
  sumarMeses,
} from './index'

describe('meses', () => {
  it('mesDeFecha lleva la fecha al día 1', () => {
    expect(mesDeFecha('2026-09-29')).toBe('2026-09-01')
    expect(mesDeFecha('2026-12-31')).toBe('2026-12-01')
    expect(mesDeFecha('2027-01-01')).toBe('2027-01-01')
  })

  it('hoyISO usa la fecha local', () => {
    expect(hoyISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('mesActual devuelve el día 1 del mes local', () => {
    expect(mesActual(new Date(2026, 8, 29))).toBe('2026-09-01')
  })

  it('sumarMeses cambia de año en los dos sentidos', () => {
    expect(sumarMeses('2026-09-01', 1)).toBe('2026-10-01')
    expect(sumarMeses('2026-12-01', 1)).toBe('2027-01-01')
    expect(sumarMeses('2027-01-01', -1)).toBe('2026-12-01')
    expect(sumarMeses('2026-03-01', -14)).toBe('2025-01-01')
    expect(sumarMeses('2026-03-01', 0)).toBe('2026-03-01')
  })

  it('sumarDias cruza meses y años', () => {
    expect(sumarDias('2026-09-29', -90)).toBe('2026-07-01')
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31')
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('finDeMes y diasDelMes, con febrero bisiesto', () => {
    expect(finDeMes('2026-09-01')).toBe('2026-09-30')
    expect(finDeMes('2026-12-01')).toBe('2026-12-31')
    expect(finDeMes('2026-02-01')).toBe('2026-02-28')
    expect(finDeMes('2028-02-01')).toBe('2028-02-29')
    expect(diasDelMes('2028-02-01')).toBe(29)
  })

  it('nombres en español', () => {
    expect(nombreMes('2026-09-01')).toBe('septiembre')
    expect(etiquetaMes('2027-01-01')).toBe('enero 2027')
    expect(formatoDia('2026-09-29')).toBe('martes, 29 de septiembre')
  })
})

import { diaDeFecha, diferenciaMeses, fechaEnMes, mesesEntre } from './index'

describe('meses (rangos)', () => {
  it('diferenciaMeses', () => {
    expect(diferenciaMeses('2026-01-01', '2026-04-01')).toBe(3)
    expect(diferenciaMeses('2026-11-01', '2027-02-01')).toBe(3)
    expect(diferenciaMeses('2026-04-01', '2026-01-01')).toBe(-3)
  })

  it('mesesEntre incluye los extremos', () => {
    expect(mesesEntre('2026-11-01', '2027-01-01')).toEqual(['2026-11-01', '2026-12-01', '2027-01-01'])
    expect(mesesEntre('2026-05-01', '2026-05-01')).toEqual(['2026-05-01'])
    expect(mesesEntre('2026-05-01', '2026-03-01')).toEqual([])
  })

  it('fechaEnMes ajusta al último día', () => {
    expect(fechaEnMes('2026-02-01', 31)).toBe('2026-02-28')
    expect(fechaEnMes('2026-09-01', 5)).toBe('2026-09-05')
    expect(fechaEnMes('2026-09-01', 31)).toBe('2026-09-30')
  })

  it('diaDeFecha', () => {
    expect(diaDeFecha('2026-09-05')).toBe(5)
  })
})
