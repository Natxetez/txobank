import { describe, expect, it } from 'vitest'
import type { Cuenta, Movimiento } from '../data/types'
import {
  calendarioGasto,
  deCuenta,
  detalleCategoria,
  efectoEnCuenta,
  gastoPorCategoria,
  ingresosPorCategoria,
  mesesDelPeriodo,
  mesesPeriodoAnterior,
  patrimonioPorMes,
  rachaSinGasto,
  resumenPeriodo,
  saldoHasta,
  serieMensual,
  serieRitmo,
  variacion,
} from './estadisticas'

let n = 0
function mov(p: Partial<Movimiento>): Movimiento {
  n += 1
  return {
    id: `m${n}`,
    tipo: 'gasto',
    importe: 1000,
    fecha: '2026-09-10',
    cuentaId: 'c1',
    cuentaDestinoId: null,
    categoriaId: 'comida',
    nota: '',
    fijoId: null,
    fijoMes: null,
    mesImputado: null,
    ...p,
  }
}

const cuenta = (id: string, saldoInicial = 0): Cuenta => ({
  id,
  nombre: id,
  tipo: 'corriente',
  saldoInicial,
  color: '#000',
  orden: 0,
  archivada: false,
})

describe('periodos', () => {
  it('meses de cada periodo', () => {
    expect(mesesDelPeriodo('mes', '2026-09-01')).toEqual(['2026-09-01'])
    expect(mesesDelPeriodo('3m', '2026-02-01')).toEqual(['2025-12-01', '2026-01-01', '2026-02-01'])
    expect(mesesDelPeriodo('ano', '2026-04-01')).toEqual(['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'])
    expect(mesesDelPeriodo('12m', '2026-09-01')).toHaveLength(12)
    expect(mesesDelPeriodo('12m', '2026-09-01')[0]).toBe('2025-10-01')
  })

  it('periodo anterior equivalente', () => {
    expect(mesesPeriodoAnterior('mes', '2026-09-01')).toEqual(['2026-08-01'])
    expect(mesesPeriodoAnterior('3m', '2026-09-01')).toEqual(['2026-04-01', '2026-05-01', '2026-06-01'])
    expect(mesesPeriodoAnterior('ano', '2026-03-01')).toEqual(['2025-01-01', '2025-02-01', '2025-03-01'])
    expect(mesesPeriodoAnterior('12m', '2026-09-01')[0]).toBe('2024-10-01')
  })
})

describe('variacion', () => {
  it('relativa, y null sin base', () => {
    expect(variacion(90, 100)).toBeCloseTo(-0.1)
    expect(variacion(150, 100)).toBeCloseTo(0.5)
    expect(variacion(50, 0)).toBeNull()
  })
})

describe('resumenPeriodo', () => {
  const movs = [
    mov({ tipo: 'ingreso', importe: 200000, categoriaId: 'nomina' }),
    mov({ importe: 60000, categoriaId: 'casa', fijoId: 'f' }),
    mov({ importe: 3000 }),
    mov({ tipo: 'devolucion', importe: 1000 }),
    mov({ tipo: 'traspaso', importe: 50000, categoriaId: null, cuentaDestinoId: 'c2' }),
  ]

  it('ingresos, gasto neto (fijo y variable), ahorro y tasa; sin traspasos', () => {
    const r = resumenPeriodo(movs, ['2026-09-01'], '2026-09-20')
    expect(r).toMatchObject({ ingresos: 200000, gastoNeto: 62000, gastoFijo: 60000, gastoVariable: 2000, ahorro: 138000 })
    expect(r.tasaAhorro).toBeCloseTo(0.69)
  })

  it('gasto variable medio diario sobre los días transcurridos', () => {
    expect(resumenPeriodo(movs, ['2026-09-01'], '2026-09-20').variableMedioDiario).toBe(100)
    expect(resumenPeriodo(movs, ['2026-09-01'], '2026-08-31').variableMedioDiario).toBeNull()
  })

  it('sin ingresos no hay tasa de ahorro', () => {
    expect(resumenPeriodo([mov({})], ['2026-09-01'], '2026-09-20').tasaAhorro).toBeNull()
  })
})

describe('gastoPorCategoria', () => {
  const movs = [
    mov({ importe: 10000, categoriaId: 'comida' }),
    mov({ importe: 30000, categoriaId: 'casa' }),
    mov({ importe: 5000, categoriaId: 'comida', fecha: '2026-08-10' }),
    mov({ tipo: 'devolucion', importe: 2000, categoriaId: 'comida' }),
  ]

  it('ordena de mayor a menor con porcentaje y variación frente al periodo anterior', () => {
    const f = gastoPorCategoria(movs, ['2026-09-01'], ['2026-08-01'])
    expect(f.map((x) => x.categoriaId)).toEqual(['casa', 'comida'])
    expect(f[1].importe).toBe(8000)
    expect(f[0].fraccion).toBeCloseTo(30000 / 38000)
    expect(f[1].anterior).toBe(5000)
    expect(f[1].variacion).toBeCloseTo(0.6)
    expect(f[0].variacion).toBeNull()
  })
})

describe('ingresosPorCategoria y serieMensual', () => {
  const movs = [
    mov({ tipo: 'ingreso', importe: 200000, categoriaId: 'nomina' }),
    mov({ tipo: 'ingreso', importe: 5000, categoriaId: 'otros' }),
    mov({ importe: 30000, fijoId: 'f' }),
    mov({ importe: 4000, fecha: '2026-08-05' }),
  ]

  it('ingresos por categoría', () => {
    expect(ingresosPorCategoria(movs, ['2026-09-01'])).toEqual([
      { categoriaId: 'nomina', importe: 200000 },
      { categoriaId: 'otros', importe: 5000 },
    ])
  })

  it('serie mensual con ahorro', () => {
    const s = serieMensual(movs, ['2026-08-01', '2026-09-01'])
    expect(s[0]).toMatchObject({ mes: '2026-08-01', ingresos: 0, gastoNeto: 4000, ahorro: -4000 })
    expect(s[1]).toMatchObject({ ingresos: 205000, gastoNeto: 30000, gastoFijo: 30000, gastoVariable: 0, ahorro: 175000 })
  })
})

describe('patrimonio', () => {
  const cuentas = [cuenta('c1', 100000), cuenta('c2', 50000)]
  const movs = [
    mov({ tipo: 'ingreso', importe: 20000, fecha: '2026-08-10', categoriaId: 'n' }),
    mov({ importe: 5000, fecha: '2026-08-20' }),
    mov({ tipo: 'traspaso', importe: 30000, fecha: '2026-09-02', categoriaId: null, cuentaDestinoId: 'c2' }),
    mov({ importe: 1000, fecha: '2026-09-15' }),
    mov({ importe: 9999, fecha: '2026-10-05' }),
  ]

  it('efecto por cuenta: origen resta, destino suma, devolución e ingreso suman', () => {
    const t = movs[2]
    expect(efectoEnCuenta(t, 'c1')).toBe(-30000)
    expect(efectoEnCuenta(t, 'c2')).toBe(30000)
    expect(efectoEnCuenta(t, 'c3')).toBe(0)
    expect(efectoEnCuenta(mov({ tipo: 'devolucion', importe: 700 }), 'c1')).toBe(700)
  })

  it('saldo total: los traspasos no cambian el total', () => {
    expect(saldoHasta(cuentas, movs, '2026-08-31')).toBe(150000 + 20000 - 5000)
    expect(saldoHasta(cuentas, movs, '2026-09-30')).toBe(150000 + 20000 - 5000 - 1000)
  })

  it('saldo de una cuenta concreta', () => {
    expect(saldoHasta(cuentas, movs, '2026-09-30', 'c2')).toBe(80000)
    expect(saldoHasta(cuentas, movs, '2026-09-30', 'c1')).toBe(100000 + 20000 - 5000 - 30000 - 1000)
  })

  it('por mes, sin contar lo futuro respecto a hoy', () => {
    const p = patrimonioPorMes(cuentas, movs, ['2026-08-01', '2026-09-01', '2026-10-01'], '2026-10-01')
    expect(p.map((x) => x.saldo)).toEqual([165000, 164000, 164000])
    const conOctubre = patrimonioPorMes(cuentas, movs, ['2026-10-01'], '2026-10-20')
    expect(conOctubre[0].saldo).toBe(164000 - 9999)
    const hoyPrevio = patrimonioPorMes(cuentas, movs, ['2026-09-01'], '2026-09-10')
    expect(hoyPrevio[0].saldo).toBe(165000)
  })

  it('deCuenta filtra por cuenta de origen', () => {
    expect(deCuenta(movs)).toHaveLength(5)
    expect(deCuenta(movs, 'c2')).toHaveLength(0)
  })
})

describe('serieRitmo', () => {
  const hoy = '2026-09-10'
  const movs = [
    mov({ importe: 1000, fecha: '2026-09-02' }),
    mov({ importe: 2000, fecha: '2026-09-05' }),
    mov({ importe: 60000, fecha: '2026-09-03', fijoId: 'f', categoriaId: 'casa' }),
    // mes anterior
    mov({ importe: 3000, fecha: '2026-08-02' }),
    mov({ importe: 3000, fecha: '2026-08-20' }),
  ]

  it('acumulado real día a día; los fijos se ven como escalones', () => {
    const s = serieRitmo(movs, '2026-09-01', hoy, 0)
    expect(s.puntos).toHaveLength(30)
    expect(s.puntos[0].real).toBe(0)
    expect(s.puntos[1].real).toBe(1000)
    expect(s.puntos[2].real).toBe(61000)
    expect(s.puntos[4].real).toBe(63000)
    expect(s.puntos[9].real).toBe(63000)
    expect(s.puntos[10].real).toBeNull()
  })

  it('proyección: gastado + ritmo variable × días restantes + fijos pendientes', () => {
    // variable 3.000 en 10 días → 300/día; quedan 20 días → 6.000; + 20.000 de fijos pendientes
    const s = serieRitmo(movs, '2026-09-01', hoy, 20000)
    expect(s.ritmoVariableDiario).toBe(300)
    expect(s.proyectadoFinMes).toBe(63000 + 6000 + 20000)
    expect(s.puntos[9].proyeccion).toBe(63000)
    expect(s.puntos[29].proyeccion).toBeCloseTo(s.proyectadoFinMes)
    expect(s.puntos[8].proyeccion).toBeNull()
  })

  it('media de los meses anteriores por día', () => {
    const s = serieRitmo(movs, '2026-09-01', hoy, 0)
    expect(s.puntos[0].media).toBe(0)
    expect(s.puntos[1].media).toBe(3000)
    expect(s.puntos[29].media).toBe(6000)
  })

  it('sin meses anteriores no hay media; en un mes pasado no hay proyección', () => {
    const solo = serieRitmo([mov({ importe: 100 })], '2026-09-01', hoy, 0)
    expect(solo.puntos[0].media).toBeNull()
    const pasado = serieRitmo(movs, '2026-08-01', hoy, 0)
    expect(pasado.puntos.every((p) => p.proyeccion === null)).toBe(true)
    expect(pasado.puntos[30].real).toBe(6000)
  })
})

describe('calendario y rachas', () => {
  const movs = [
    mov({ importe: 1000, fecha: '2026-09-01' }),
    mov({ importe: 4000, fecha: '2026-09-04' }),
    mov({ importe: 60000, fecha: '2026-09-02', fijoId: 'f' }),
    mov({ tipo: 'ingreso', importe: 9999, fecha: '2026-09-03', categoriaId: 'n' }),
  ]

  it('nivel según el día de más gasto; los fijos y los ingresos no cuentan', () => {
    const { dias } = calendarioGasto(movs, '2026-09-01', '2026-09-10')
    expect(dias[0].nivel).toBe(1) // 1000 / 4000 → 1
    expect(dias[1].nivel).toBe(0) // solo un fijo
    expect(dias[2].nivel).toBe(0)
    expect(dias[3].nivel).toBe(4)
    expect(dias[3].gastoVariable).toBe(4000)
  })

  it('días sin gasto: solo hasta hoy', () => {
    expect(calendarioGasto(movs, '2026-09-01', '2026-09-10').diasSinGasto).toBe(8)
    expect(calendarioGasto(movs, '2026-09-01', '2026-09-10').dias[20].futuro).toBe(true)
    expect(calendarioGasto(movs, '2026-09-01', '2026-10-05').diasSinGasto).toBe(28)
  })

  it('racha actual sin gasto variable', () => {
    expect(rachaSinGasto(movs, '2026-09-10')).toBe(6)
    expect(rachaSinGasto(movs, '2026-09-04')).toBe(0)
    expect(rachaSinGasto([], '2026-09-10')).toBe(0)
  })

  it('la racha no cuenta días anteriores al primer movimiento', () => {
    expect(rachaSinGasto([mov({ importe: 100, fecha: '2026-09-08', tipo: 'ingreso', categoriaId: 'n' })], '2026-09-10')).toBe(3)
  })
})

describe('detalleCategoria', () => {
  const movs = [
    mov({ importe: 5000, categoriaId: 'ocio', fecha: '2026-07-10' }),
    mov({ importe: 7000, categoriaId: 'ocio', fecha: '2026-08-10' }),
    mov({ importe: 3000, categoriaId: 'ocio', fecha: '2026-09-10' }),
    mov({ importe: 9000, categoriaId: 'ocio', fecha: '2026-09-11' }),
    mov({ importe: 1000, categoriaId: 'comida', fecha: '2026-09-11' }),
    mov({ importe: 800, categoriaId: 'ocio', fecha: '2025-01-11' }),
  ]

  it('12 meses, media desde el primer mes con gasto, ticket medio y mayores', () => {
    const d = detalleCategoria(movs, 'ocio', '2026-09-01', [
      { id: 'p', mes: '2026-01-01', categoriaId: 'ocio', importe: 8000 },
    ])
    expect(d.meses).toHaveLength(12)
    expect(d.meses[11]).toMatchObject({ mes: '2026-09-01', importe: 12000, presupuesto: 8000 })
    expect(d.meses[0].presupuesto).toBeNull()
    expect(d.media).toBe((5000 + 7000 + 12000) / 3)
    expect(d.numeroGastos).toBe(4)
    expect(d.ticketMedio).toBe(6000)
    expect(d.mayores.map((m) => m.importe)).toEqual([9000, 7000, 5000, 3000])
  })

  it('sin datos: media 0 y sin ticket', () => {
    const d = detalleCategoria([], 'ocio', '2026-09-01', [])
    expect(d.media).toBe(0)
    expect(d.ticketMedio).toBeNull()
    expect(d.mayores).toEqual([])
  })
})
