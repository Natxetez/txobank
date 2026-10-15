import { describe, expect, it } from 'vitest'
import type { ActualizacionSaldo, OtroSaldo } from '../data/types'
import {
  aEntradaLocal,
  deEntradaLocal,
  fechaHoraCorta,
  haceCuanto,
  historialDe,
  saldoAFinDeMes,
  saldoEnFecha,
  saldosActuales,
  totalOtrosSaldos,
  totalOtrosSaldosEnFecha,
  ultimaActualizacion,
} from './patrimonio'

// Fechas en hora local, para que los tests no dependan de la zona horaria.
const local = (a: number, m: number, d: number, h = 12, min = 0) => new Date(a, m - 1, d, h, min).toISOString()

function otro(id: string, archivado = false): OtroSaldo {
  return { id, nombre: id, color: '#12B886', icono: null, orden: 0, archivado }
}

let n = 0
function act(otroSaldoId: string, saldo: number, fechaHora: string): ActualizacionSaldo {
  n += 1
  return { id: `h${n}`, otroSaldoId, saldo, fechaHora }
}

const historial = [
  // Desordenado a propósito.
  act('fondo', 320000, local(2026, 9, 20, 18, 30)),
  act('revolut', 10000, local(2026, 10, 1, 10, 15)),
  act('fondo', 300000, local(2026, 8, 20, 18, 30)),
  act('fondo', 290000, local(2026, 10, 15, 9, 0)),
  act('viejo', 5000, local(2026, 7, 1)),
]

describe('saldo actual', () => {
  it('es el de la última actualización, aunque el historial venga desordenado', () => {
    const r = saldosActuales([otro('fondo'), otro('revolut')], historial)
    expect(r[0]).toMatchObject({ saldo: 290000, fechaHora: local(2026, 10, 15, 9, 0) })
    expect(r[1]).toMatchObject({ saldo: 10000 })
  })

  it('sin actualizaciones: 0 y sin fecha', () => {
    expect(saldosActuales([otro('nuevo')], historial)[0]).toMatchObject({ saldo: 0, fechaHora: null })
    expect(ultimaActualizacion(historial, 'nuevo')).toBeNull()
  })

  it('con la misma fecha y hora gana la registrada después', () => {
    const t = local(2026, 10, 10)
    const h = [act('x', 100, t), act('x', 200, t)]
    expect(ultimaActualizacion(h, 'x')?.saldo).toBe(200)
  })

  it('admite saldos negativos', () => {
    const h = [act('deuda', -15000, local(2026, 10, 1))]
    expect(saldosActuales([otro('deuda')], h)[0].saldo).toBe(-15000)
  })
})

describe('saldo en una fecha', () => {
  it('última actualización hasta el final de ese día', () => {
    expect(saldoEnFecha(historial, 'fondo', '2026-09-20')).toBe(320000)
    expect(saldoEnFecha(historial, 'fondo', '2026-09-19')).toBe(300000)
    expect(saldoEnFecha(historial, 'fondo', '2026-10-14')).toBe(320000)
  })

  it('0 si aún no existía', () => {
    expect(saldoEnFecha(historial, 'fondo', '2026-08-19')).toBe(0)
    expect(saldoEnFecha(historial, 'revolut', '2026-09-30')).toBe(0)
  })

  it('a fin de mes, y hasta hoy en el mes en curso', () => {
    expect(saldoAFinDeMes(historial, 'fondo', '2026-08-01')).toBe(300000)
    expect(saldoAFinDeMes(historial, 'fondo', '2026-09-01')).toBe(320000)
    expect(saldoAFinDeMes(historial, 'fondo', '2026-10-01')).toBe(290000)
    expect(saldoAFinDeMes(historial, 'fondo', '2026-10-01', '2026-10-10')).toBe(320000)
    expect(saldoAFinDeMes(historial, 'revolut', '2026-08-01')).toBe(0)
  })
})

describe('totales', () => {
  const otros = [otro('fondo'), otro('revolut'), otro('viejo', true)]

  it('total actual: solo los activos', () => {
    expect(totalOtrosSaldos(otros, historial)).toBe(290000 + 10000)
    expect(totalOtrosSaldos([otro('viejo', false)], historial)).toBe(5000)
    expect(totalOtrosSaldos([], historial)).toBe(0)
  })

  it('total en una fecha: solo los activos y los que ya existían', () => {
    expect(totalOtrosSaldosEnFecha(otros, historial, '2026-09-30')).toBe(320000)
    expect(totalOtrosSaldosEnFecha(otros, historial, '2026-10-31')).toBe(300000)
    expect(totalOtrosSaldosEnFecha(otros, historial, '2026-07-31')).toBe(0)
  })
})

describe('historial', () => {
  it('del más reciente al más antiguo, con la diferencia con el anterior', () => {
    const h = historialDe(historial, 'fondo')
    expect(h.map((e) => e.actualizacion.saldo)).toEqual([290000, 320000, 300000])
    expect(h.map((e) => e.diferencia)).toEqual([-30000, 20000, null])
  })

  it('vacío si no tiene actualizaciones', () => {
    expect(historialDe(historial, 'nuevo')).toEqual([])
  })
})

describe('formato de fecha y hora', () => {
  const ahora = new Date(2026, 9, 15, 20, 0)

  it('fecha y hora corta en hora local', () => {
    expect(fechaHoraCorta(local(2026, 10, 15, 18, 30), ahora)).toBe('15/10 a las 18:30')
    expect(fechaHoraCorta(local(2025, 3, 5, 8, 5), ahora)).toBe('05/03/2025 a las 08:05')
  })

  it('hace cuánto', () => {
    expect(haceCuanto(local(2026, 10, 15, 9), ahora)).toBe('hoy')
    expect(haceCuanto(local(2026, 10, 14, 23), ahora)).toBe('ayer')
    expect(haceCuanto(local(2026, 10, 12), ahora)).toBe('hace 3 días')
    expect(haceCuanto(local(2026, 9, 1), ahora)).toBe('el 01/09')
    expect(haceCuanto(local(2025, 9, 1), ahora)).toBe('el 01/09/2025')
  })

  it('entrada datetime-local de ida y vuelta', () => {
    const d = new Date(2026, 9, 15, 18, 30)
    expect(aEntradaLocal(d)).toBe('2026-10-15T18:30')
    expect(deEntradaLocal('2026-10-15T18:30')).toBe(d.toISOString())
    expect(deEntradaLocal('')).toBeNull()
    expect(deEntradaLocal('2026-02-30T10:00')).toBeNull()
  })
})
