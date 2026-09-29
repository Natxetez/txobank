import { describe, expect, it } from 'vitest'
import { aTextoEditable, formatEuros, parseImporte } from './dinero'

const sinEspaciosRaros = (s: string) => s.replace(/ /g, ' ')

describe('parseImporte', () => {
  it('acepta coma y punto como decimal', () => {
    expect(parseImporte('12,5')).toBe(1250)
    expect(parseImporte('12.5')).toBe(1250)
    expect(parseImporte('12,50')).toBe(1250)
    expect(parseImporte('0,05')).toBe(5)
    expect(parseImporte(',5')).toBe(50)
  })

  it('acepta enteros y separadores de miles', () => {
    expect(parseImporte('12')).toBe(1200)
    expect(parseImporte('1.234,56')).toBe(123456)
    expect(parseImporte('1,234.56')).toBe(123456)
    expect(parseImporte('1.234.567')).toBe(123456700)
  })

  it('ignora espacios y el símbolo €', () => {
    expect(parseImporte(' 12,5 € ')).toBe(1250)
  })

  it('rechaza lo que no es un importe', () => {
    expect(parseImporte('')).toBeNull()
    expect(parseImporte('abc')).toBeNull()
    expect(parseImporte(',')).toBeNull()
    expect(parseImporte('12,345')).toBeNull()
    expect(parseImporte('1..2')).toBeNull()
    expect(parseImporte('1.23.4')).toBeNull()
  })

  it('los negativos solo si se permiten', () => {
    expect(parseImporte('-5')).toBeNull()
    expect(parseImporte('-5,25', { permitirNegativo: true })).toBe(-525)
  })

  it('no pierde céntimos por coma flotante', () => {
    expect(parseImporte('0,29')).toBe(29)
    expect(parseImporte('1,15')).toBe(115)
    expect(parseImporte('19,99')).toBe(1999)
  })
})

describe('formatEuros', () => {
  it('formatea en es-ES', () => {
    expect(sinEspaciosRaros(formatEuros(1250))).toBe('12,50 €')
    expect(sinEspaciosRaros(formatEuros(123456))).toBe('1.234,56 €')
    expect(sinEspaciosRaros(formatEuros(0))).toBe('0,00 €')
  })

  it('agrupa también los miles de 4 cifras', () => {
    expect(sinEspaciosRaros(formatEuros(135000))).toBe('1.350,00 €')
  })

  it('formatea negativos', () => {
    expect(sinEspaciosRaros(formatEuros(-525))).toBe('-5,25 €')
  })
})

describe('aTextoEditable', () => {
  it('ida y vuelta con parseImporte', () => {
    for (const c of [0, 5, 100, 1250, 123456, -525]) {
      expect(parseImporte(aTextoEditable(c), { permitirNegativo: true })).toBe(c)
    }
  })

  it('omite los decimales cuando son cero', () => {
    expect(aTextoEditable(1200)).toBe('12')
    expect(aTextoEditable(1205)).toBe('12,05')
  })
})
