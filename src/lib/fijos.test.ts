import { describe, expect, it } from 'vitest'
import type { Fijo, Movimiento } from '../data/types'
import {
  costeAnual,
  costeMensual,
  fijoDesdeMovimiento,
  fijosDelMes,
  movimientoDePago,
  previstoPendiente,
  proximoMesQueToca,
  resumenFijos,
  tocaEnMes,
  validarFijo,
} from './fijos'

function fijo(p: Partial<Fijo> = {}): Fijo {
  return {
    id: 'f1',
    nombre: 'Alquiler',
    tipo: 'gasto',
    importe: 60000,
    cuentaId: 'c1',
    cuentaDestinoId: null,
    categoriaId: 'casa',
    diaMes: 5,
    cadaMeses: 1,
    desde: '2026-01-01',
    hasta: null,
    activo: true,
    ...p,
  }
}

function pago(p: Partial<Movimiento> = {}): Movimiento {
  return {
    id: 'm1',
    tipo: 'gasto',
    importe: 60000,
    fecha: '2026-09-05',
    cuentaId: 'c1',
    cuentaDestinoId: null,
    categoriaId: 'casa',
    nota: 'Alquiler',
    fijoId: 'f1',
    fijoMes: '2026-09-01',
    mesImputado: null,
    ...p,
  }
}

describe('coste', () => {
  it('mensual y anual según la periodicidad', () => {
    expect(costeMensual(fijo({ importe: 30000, cadaMeses: 3 }))).toBe(10000)
    expect(costeAnual(fijo({ importe: 30000, cadaMeses: 3 }))).toBe(120000)
    expect(costeAnual(fijo({ importe: 60000, cadaMeses: 1 }))).toBe(720000)
    expect(costeAnual(fijo({ importe: 12000, cadaMeses: 12 }))).toBe(12000)
  })
})

describe('tocaEnMes', () => {
  it('mensual: desde el mes de inicio, todos los meses', () => {
    const f = fijo()
    expect(tocaEnMes(f, '2025-12-01')).toBe(false)
    expect(tocaEnMes(f, '2026-01-01')).toBe(true)
    expect(tocaEnMes(f, '2027-06-01')).toBe(true)
  })

  it('trimestral: solo cada 3 meses desde el mes de inicio, también cruzando de año', () => {
    const f = fijo({ cadaMeses: 3, desde: '2026-02-01' })
    expect(tocaEnMes(f, '2026-02-01')).toBe(true)
    expect(tocaEnMes(f, '2026-03-01')).toBe(false)
    expect(tocaEnMes(f, '2026-05-01')).toBe(true)
    expect(tocaEnMes(f, '2026-11-01')).toBe(true)
    expect(tocaEnMes(f, '2027-02-01')).toBe(true)
    expect(tocaEnMes(f, '2027-03-01')).toBe(false)
  })

  it('anual', () => {
    const f = fijo({ cadaMeses: 12, desde: '2026-04-01' })
    expect(tocaEnMes(f, '2027-04-01')).toBe(true)
    expect(tocaEnMes(f, '2027-05-01')).toBe(false)
  })

  it('respeta hasta y pausa', () => {
    expect(tocaEnMes(fijo({ hasta: '2026-06-01' }), '2026-06-01')).toBe(true)
    expect(tocaEnMes(fijo({ hasta: '2026-06-01' }), '2026-07-01')).toBe(false)
    expect(tocaEnMes(fijo({ activo: false }), '2026-09-01')).toBe(false)
  })
})

describe('proximoMesQueToca', () => {
  it('encuentra el siguiente mes y devuelve null si está pausado o terminó', () => {
    const f = fijo({ cadaMeses: 3, desde: '2026-02-01' })
    expect(proximoMesQueToca(f, '2026-09-01')).toBe('2026-11-01')
    expect(proximoMesQueToca(f, '2026-11-01')).toBe('2026-11-01')
    expect(proximoMesQueToca(fijo({ activo: false }), '2026-09-01')).toBeNull()
    expect(proximoMesQueToca(fijo({ hasta: '2026-06-01' }), '2026-09-01')).toBeNull()
  })
})

describe('fijosDelMes: estados', () => {
  const mes = '2026-09-01'

  it('pendiente si el día aún no ha pasado', () => {
    const [i] = fijosDelMes([fijo({ diaMes: 20 })], mes, [], [], '2026-09-10')
    expect(i.estado).toBe('pendiente')
  })

  it('esperado ("se esperaba el día 5") si el día ya pasó, y no el mismo día', () => {
    expect(fijosDelMes([fijo({ diaMes: 5 })], mes, [], [], '2026-09-10')[0].estado).toBe('esperado')
    expect(fijosDelMes([fijo({ diaMes: 5 })], mes, [], [], '2026-09-05')[0].estado).toBe('pendiente')
  })

  it('un mes pasado sin pagar sigue esperado', () => {
    expect(fijosDelMes([fijo()], '2026-08-01', [], [], '2026-09-10')[0].estado).toBe('esperado')
  })

  it('el día 31 en un mes de 30 días se espera el 30', () => {
    expect(fijosDelMes([fijo({ diaMes: 31 })], mes, [], [], '2026-09-30')[0].estado).toBe('pendiente')
    expect(fijosDelMes([fijo({ diaMes: 31 })], mes, [], [], '2026-10-01')[0].estado).toBe('esperado')
  })

  it('pagado si hay un movimiento con su fijo_mes, aunque la fecha sea de otro mes', () => {
    const adelantado = pago({ fecha: '2026-08-30', fijoMes: '2026-09-01' })
    const [i] = fijosDelMes([fijo()], mes, [adelantado], [], '2026-09-10')
    expect(i.estado).toBe('pagado')
    expect(i.pago?.id).toBe('m1')
    expect(fijosDelMes([fijo()], '2026-08-01', [adelantado], [], '2026-09-10')[0].estado).toBe('esperado')
  })

  it('omitido si se omitió ese mes, pero pagado gana a omitido', () => {
    const om = [{ fijoId: 'f1', mes }]
    expect(fijosDelMes([fijo()], mes, [], om, '2026-09-10')[0].estado).toBe('omitido')
    expect(fijosDelMes([fijo()], mes, [pago()], om, '2026-09-10')[0].estado).toBe('pagado')
    expect(fijosDelMes([fijo()], '2026-10-01', [], om, '2026-10-10')[0].estado).toBe('esperado')
  })

  it('no aparecen los que no tocan; sí uno pausado que ya se pagó ese mes', () => {
    const trimestral = fijo({ cadaMeses: 3, desde: '2026-01-01' })
    expect(fijosDelMes([trimestral], '2026-07-01', [], [], '2026-09-10')).toHaveLength(1)
    expect(fijosDelMes([trimestral], '2026-08-01', [], [], '2026-09-10')).toHaveLength(0)
    const pausado = fijo({ activo: false })
    expect(fijosDelMes([pausado], mes, [], [], '2026-09-10')).toHaveLength(0)
    expect(fijosDelMes([pausado], mes, [pago()], [], '2026-09-10')).toHaveLength(1)
  })

  it('orden: esperados, pendientes, pagados, omitidos', () => {
    const fijos = [
      fijo({ id: 'a', nombre: 'A pagado', diaMes: 1 }),
      fijo({ id: 'b', nombre: 'B pendiente', diaMes: 25 }),
      fijo({ id: 'c', nombre: 'C esperado', diaMes: 3 }),
      fijo({ id: 'd', nombre: 'D omitido', diaMes: 2 }),
    ]
    const r = fijosDelMes(fijos, mes, [pago({ fijoId: 'a' })], [{ fijoId: 'd', mes }], '2026-09-10')
    expect(r.map((i) => i.fijo.id)).toEqual(['c', 'b', 'a', 'd'])
  })
})

describe('resumenFijos y pendiente', () => {
  const mes = '2026-09-01'
  const fijos = [
    fijo({ id: 'a', importe: 60000, diaMes: 1 }),
    fijo({ id: 'b', importe: 8000, diaMes: 3 }),
    fijo({ id: 'c', importe: 5000, diaMes: 25 }),
    fijo({ id: 'd', importe: 2000, diaMes: 2 }),
    fijo({ id: 'n', tipo: 'ingreso', importe: 200000, diaMes: 27 }),
  ]
  const items = fijosDelMes(fijos, mes, [pago({ fijoId: 'a', importe: 60000 }), pago({ id: 'm2', fijoId: 'b', importe: 9500 })], [{ fijoId: 'd', mes }], '2026-09-10')

  it('cuenta pagados, importe real pagado y total (real + previsto pendiente), sin omitidos ni ingresos', () => {
    expect(resumenFijos(items)).toEqual({ total: 3, pagados: 2, importePagado: 69500, importeTotal: 74500 })
    expect(resumenFijos(items, 'ingreso')).toMatchObject({ total: 1, pagados: 0, importeTotal: 200000 })
  })

  it('previsto pendiente por tipo', () => {
    expect(previstoPendiente(items, 'gasto')).toBe(5000)
    expect(previstoPendiente(items, 'ingreso')).toBe(200000)
  })
})

describe('movimientoDePago', () => {
  it('gasto: copia categoría y cuenta, con nombre del fijo y su mes', () => {
    const m = movimientoDePago(fijo(), '2026-09-01', { fecha: '2026-09-07', importe: 61000, cuentaId: 'c2' })
    expect(m).toMatchObject({
      tipo: 'gasto',
      importe: 61000,
      fecha: '2026-09-07',
      cuentaId: 'c2',
      categoriaId: 'casa',
      cuentaDestinoId: null,
      nota: 'Alquiler',
      fijoId: 'f1',
      fijoMes: '2026-09-01',
      mesImputado: null,
    })
  })

  it('gasto pagado por adelantado: el fijo_mes es el del pendiente y no se imputa', () => {
    const m = movimientoDePago(fijo(), '2026-10-01', { fecha: '2026-09-30', importe: 60000, cuentaId: 'c1' })
    expect(m.fijoMes).toBe('2026-10-01')
    expect(m.mesImputado).toBeNull()
  })

  it('ingreso cobrado antes (nómina de octubre el 29 de septiembre) cuenta para octubre', () => {
    const nomina = fijo({ tipo: 'ingreso', categoriaId: 'nomina' })
    const m = movimientoDePago(nomina, '2026-10-01', { fecha: '2026-09-29', importe: 200000, cuentaId: 'c1' })
    expect(m.mesImputado).toBe('2026-10-01')
    const normal = movimientoDePago(nomina, '2026-10-01', { fecha: '2026-10-27', importe: 200000, cuentaId: 'c1' })
    expect(normal.mesImputado).toBeNull()
  })

  it('ingreso cobrado con más de un mes de diferencia no se imputa (no es válido)', () => {
    const nomina = fijo({ tipo: 'ingreso', categoriaId: 'nomina' })
    expect(movimientoDePago(nomina, '2026-12-01', { fecha: '2026-09-29', importe: 1, cuentaId: 'c1' }).mesImputado).toBeNull()
  })

  it('traspaso: con destino y sin categoría', () => {
    const t = fijo({ tipo: 'traspaso', cuentaDestinoId: 'c3', categoriaId: null })
    expect(movimientoDePago(t, '2026-09-01', { fecha: '2026-09-01', importe: 10000, cuentaId: 'c1' })).toMatchObject({
      tipo: 'traspaso',
      cuentaDestinoId: 'c3',
      categoriaId: null,
    })
  })
})

describe('fijoDesdeMovimiento', () => {
  const base = {
    tipo: 'gasto' as const,
    importe: 4500,
    fecha: '2026-09-17',
    cuentaId: 'c1',
    cuentaDestinoId: null,
    categoriaId: 'suscripciones',
    mesImputado: null,
  }

  it('mensual, día = día de la fecha, desde el mes de la fecha', () => {
    const r = fijoDesdeMovimiento(base, '  Gimnasio ')!
    expect(r.mes).toBe('2026-09-01')
    expect(r.fijo).toMatchObject({ nombre: 'Gimnasio', cadaMeses: 1, diaMes: 17, desde: '2026-09-01', activo: true, hasta: null })
  })

  it('un ingreso imputado a otro mes deja ese mes como pagado', () => {
    const r = fijoDesdeMovimiento({ ...base, tipo: 'ingreso', fecha: '2026-09-29', mesImputado: '2026-10-01' }, 'Nómina')!
    expect(r.mes).toBe('2026-10-01')
    expect(r.fijo.desde).toBe('2026-10-01')
    expect(r.fijo.diaMes).toBe(29)
  })

  it('una devolución no puede ser fija', () => {
    expect(fijoDesdeMovimiento({ ...base, tipo: 'devolucion' }, 'x')).toBeNull()
  })
})

describe('validarFijo', () => {
  const { id: _id, ...ok } = fijo()

  it('acepta un fijo correcto', () => {
    expect(validarFijo(ok)).toBeNull()
  })

  it('rechaza lo incoherente', () => {
    expect(validarFijo({ ...ok, nombre: ' ' })).toMatch(/nombre/)
    expect(validarFijo({ ...ok, importe: 0 })).toMatch(/importe/)
    expect(validarFijo({ ...ok, categoriaId: null })).toMatch(/categoría/)
    expect(validarFijo({ ...ok, diaMes: 32 })).toMatch(/día/)
    expect(validarFijo({ ...ok, desde: '2026-01-15' })).toMatch(/mes/)
    expect(validarFijo({ ...ok, hasta: '2025-12-01' })).toMatch(/último mes/)
    expect(validarFijo({ ...ok, tipo: 'traspaso', categoriaId: null, cuentaDestinoId: 'c1' })).toMatch(/distintas/)
    expect(validarFijo({ ...ok, tipo: 'traspaso', categoriaId: null, cuentaDestinoId: 'c2' })).toBeNull()
  })
})
