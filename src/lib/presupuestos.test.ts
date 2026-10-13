import { describe, expect, it } from 'vitest'
import type { Movimiento, Presupuesto } from '../data/types'
import {
  aplicarPlan,
  excesoSobreTotal,
  mediaMensual,
  nivelPresupuesto,
  planCambioPresupuesto,
  presupuestoVigente,
  redondearDiezEuros,
  sugerirDesdeMedia,
} from './presupuestos'

const p = (mes: string, importe: number | null, categoriaId: string | null = null): Presupuesto => ({
  id: `${mes}|${categoriaId}`,
  mes,
  categoriaId,
  importe,
})

describe('presupuestoVigente', () => {
  const ps = [p('2026-01-01', 100000), p('2026-04-01', 120000), p('2026-04-01', 20000, 'comida')]

  it('el último definido en ese mes o antes', () => {
    expect(presupuestoVigente(ps, '2026-01-01', null)).toEqual({ importe: 100000, definidoEn: '2026-01-01' })
    expect(presupuestoVigente(ps, '2026-03-01', null)).toEqual({ importe: 100000, definidoEn: '2026-01-01' })
    expect(presupuestoVigente(ps, '2026-04-01', null)).toEqual({ importe: 120000, definidoEn: '2026-04-01' })
    expect(presupuestoVigente(ps, '2027-08-01', null).importe).toBe(120000)
  })

  it('ninguno antes del primero definido', () => {
    expect(presupuestoVigente(ps, '2025-12-01', null)).toEqual({ importe: null, definidoEn: null })
  })

  it('total y categorías no se mezclan', () => {
    expect(presupuestoVigente(ps, '2026-05-01', 'comida').importe).toBe(20000)
    expect(presupuestoVigente(ps, '2026-05-01', 'ocio').importe).toBeNull()
  })

  it('un importe null significa sin presupuesto desde ese mes', () => {
    expect(presupuestoVigente([p('2026-01-01', 100000), p('2026-03-01', null)], '2026-05-01', null).importe).toBeNull()
  })
})

describe('planCambioPresupuesto', () => {
  it('solo este mes: el siguiente conserva el importe anterior (el caso de diciembre)', () => {
    const ps = [p('2026-01-01', 100000)]
    const plan = planCambioPresupuesto(ps, '2026-12-01', null, 150000, 'mes')
    const despues = aplicarPlan(ps, plan, '2026-12-01', null)
    expect(presupuestoVigente(despues, '2026-11-01', null).importe).toBe(100000)
    expect(presupuestoVigente(despues, '2026-12-01', null).importe).toBe(150000)
    expect(presupuestoVigente(despues, '2027-01-01', null).importe).toBe(100000)
    expect(presupuestoVigente(despues, '2027-06-01', null).importe).toBe(100000)
  })

  it('solo este mes: si el siguiente ya tenía uno propio, no se toca', () => {
    const ps = [p('2026-01-01', 100000), p('2027-01-01', 90000)]
    const plan = planCambioPresupuesto(ps, '2026-12-01', null, 150000, 'mes')
    expect(plan.guardar).toHaveLength(1)
    const despues = aplicarPlan(ps, plan, '2026-12-01', null)
    expect(presupuestoVigente(despues, '2027-01-01', null).importe).toBe(90000)
  })

  it('este mes y los siguientes: se borran los definidos después', () => {
    const ps = [p('2026-01-01', 100000), p('2026-06-01', 110000), p('2026-09-01', 130000)]
    const plan = planCambioPresupuesto(ps, '2026-05-01', null, 95000, 'siguientes')
    expect(plan.eliminarPosteriores).toBe(true)
    const despues = aplicarPlan(ps, plan, '2026-05-01', null)
    expect(presupuestoVigente(despues, '2026-04-01', null).importe).toBe(100000)
    expect(presupuestoVigente(despues, '2026-05-01', null).importe).toBe(95000)
    expect(presupuestoVigente(despues, '2026-10-01', null).importe).toBe(95000)
    expect(despues).toHaveLength(2)
  })

  it('solo afecta a su categoría', () => {
    const ps = [p('2026-01-01', 100000), p('2026-01-01', 20000, 'comida'), p('2026-08-01', 25000, 'comida')]
    const plan = planCambioPresupuesto(ps, '2026-05-01', 'comida', 30000, 'siguientes')
    const despues = aplicarPlan(ps, plan, '2026-05-01', 'comida')
    expect(presupuestoVigente(despues, '2026-10-01', 'comida').importe).toBe(30000)
    expect(presupuestoVigente(despues, '2026-10-01', null).importe).toBe(100000)
  })

  it('quitar el presupuesto solo este mes deja el siguiente con el anterior', () => {
    const ps = [p('2026-01-01', 100000)]
    const despues = aplicarPlan(ps, planCambioPresupuesto(ps, '2026-05-01', null, null, 'mes'), '2026-05-01', null)
    expect(presupuestoVigente(despues, '2026-05-01', null).importe).toBeNull()
    expect(presupuestoVigente(despues, '2026-06-01', null).importe).toBe(100000)
  })

  it('cambiar solo un mes sin nada anterior: el siguiente queda sin presupuesto', () => {
    const despues = aplicarPlan([], planCambioPresupuesto([], '2026-05-01', null, 50000, 'mes'), '2026-05-01', null)
    expect(presupuestoVigente(despues, '2026-05-01', null).importe).toBe(50000)
    expect(presupuestoVigente(despues, '2026-06-01', null).importe).toBeNull()
  })
})

describe('nivelPresupuesto', () => {
  it('umbrales del 80 % y el 100 %', () => {
    expect(nivelPresupuesto(7999, 10000)).toBe('normal')
    expect(nivelPresupuesto(8000, 10000)).toBe('aviso')
    expect(nivelPresupuesto(10000, 10000)).toBe('superado')
  })
})

describe('excesoSobreTotal', () => {
  it('avisa si las categorías suman más que el total', () => {
    const ps = [p('2026-01-01', 120000), p('2026-01-01', 80000, 'a'), p('2026-01-01', 55000, 'b')]
    expect(excesoSobreTotal(ps, '2026-01-01', ['a', 'b'])).toEqual({ suma: 135000, total: 120000 })
    expect(excesoSobreTotal(ps, '2026-01-01', ['a'])).toBeNull()
    expect(excesoSobreTotal([p('2026-01-01', 80000, 'a')], '2026-01-01', ['a'])).toBeNull()
  })
})

describe('sugerencias desde la media', () => {
  const g = (fecha: string, importe: number, categoriaId = 'comida'): Movimiento => ({
    id: fecha + importe + categoriaId,
    tipo: 'gasto',
    importe,
    fecha,
    cuentaId: 'c',
    cuentaDestinoId: null,
    categoriaId,
    nota: '',
    descripcion: '',
    fijoId: null,
    fijoMes: null,
    mesImputado: null,
  })

  it('redondea a 10 €', () => {
    expect(redondearDiezEuros(24999)).toBe(25000)
    expect(redondearDiezEuros(22400)).toBe(22000)
    expect(redondearDiezEuros(499)).toBe(0)
  })

  it('media de los 3 meses anteriores, redondeada', () => {
    const movs = [g('2026-06-10', 20000), g('2026-07-10', 25000), g('2026-08-10', 27000), g('2026-09-05', 99999)]
    const s = sugerirDesdeMedia(movs, '2026-09-01', ['comida', 'ocio'])
    expect(s.total).toBe(24000) // (20000+25000+27000)/3 = 24000
    expect(s.porCategoria).toEqual([{ categoriaId: 'comida', importe: 24000 }])
  })

  it('con menos de 3 meses de historia usa los que haya', () => {
    const movs = [g('2026-08-10', 30000)]
    expect(mediaMensual(movs, '2026-09-01')?.meses).toEqual(['2026-08-01'])
    expect(sugerirDesdeMedia(movs, '2026-09-01', ['comida']).porCategoria).toEqual([{ categoriaId: 'comida', importe: 30000 }])
  })

  it('sin historia previa no sugiere nada', () => {
    expect(sugerirDesdeMedia([], '2026-09-01', ['comida'])).toEqual({ total: null, porCategoria: [] })
    expect(sugerirDesdeMedia([g('2026-09-05', 1000)], '2026-09-01', ['comida']).total).toBeNull()
  })
})
