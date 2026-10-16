import { describe, expect, it } from 'vitest'
import type { Ajustes, Fijo, Movimiento, Presupuesto } from '../data/types'
import { avisoTrasGasto } from './avisos'
import {
  calcularControl,
  ingresosFrenteAGastos,
  limiteMes,
  mesDeCuenta,
  objetivoAhorro,
  progresoPresupuestos,
  resumenMes,
} from './control'
import type { EntradaControl } from './control'

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
    descripcion: '',
    fijoId: null,
    fijoMes: null,
    mesImputado: null,
    grupoId: null,
    traspasoId: null,
    hora: null,
    ...p,
  }
}

const SIN_AHORRO: Ajustes = { ahorroTipo: null, ahorroValor: null }
const MES = '2026-09-01'

function entrada(p: Partial<EntradaControl> = {}): EntradaControl {
  return {
    mes: MES,
    hoy: '2026-09-16',
    movimientos: [],
    presupuestos: [],
    ajustes: SIN_AHORRO,
    fijos: [],
    pagos: [],
    omitidos: [],
    ...p,
  }
}

function fijo(p: Partial<Fijo> = {}): Fijo {
  return {
    id: 'f1',
    nombre: 'Alquiler',
    descripcion: '',
    tipo: 'gasto',
    importe: 60000,
    cuentaId: 'c1',
    cuentaDestinoId: null,
    categoriaId: 'casa',
    diaMes: 28,
    cadaMeses: 1,
    desde: '2026-01-01',
    hasta: null,
    activo: true,
    categoriaDestinoId: null,
    ...p,
  }
}

const presupuesto = (importe: number | null, categoriaId: string | null = null, mes = MES): Presupuesto => ({
  id: `${mes}${categoriaId}`,
  mes,
  categoriaId,
  importe,
})

describe('mesDeCuenta', () => {
  it('los ingresos usan mes_imputado y el resto su fecha', () => {
    expect(mesDeCuenta(mov({ tipo: 'ingreso', fecha: '2026-09-29', mesImputado: '2026-10-01' }))).toBe('2026-10-01')
    expect(mesDeCuenta(mov({ tipo: 'ingreso', fecha: '2026-09-29' }))).toBe('2026-09-01')
    expect(mesDeCuenta(mov({ tipo: 'gasto', fecha: '2026-09-29' }))).toBe('2026-09-01')
  })
})

describe('resumenMes', () => {
  const movs = [
    mov({ importe: 5000, categoriaId: 'comida' }),
    mov({ importe: 60000, categoriaId: 'casa', fijoId: 'f1', fijoMes: MES }),
    mov({ tipo: 'devolucion', importe: 2000, categoriaId: 'comida' }),
    mov({ tipo: 'ingreso', importe: 200000, categoriaId: 'nomina' }),
    mov({ tipo: 'traspaso', importe: 99999, categoriaId: null, cuentaDestinoId: 'c2' }),
    mov({ importe: 777, fecha: '2026-08-31' }),
  ]

  it('gasto neto = gastos − devoluciones, con fijo y variable por separado', () => {
    const r = resumenMes(movs, MES)
    expect(r.gastos).toBe(65000)
    expect(r.devoluciones).toBe(2000)
    expect(r.gastoNeto).toBe(63000)
    expect(r.gastoFijo).toBe(60000)
    expect(r.gastoVariable).toBe(3000)
  })

  it('las devoluciones restan de su categoría y no cuentan como ingresos; los traspasos no cuentan', () => {
    const r = resumenMes(movs, MES)
    expect(r.porCategoria).toEqual({ comida: 3000, casa: 60000 })
    expect(r.ingresos).toBe(200000)
  })

  it('la nómina adelantada cuenta en octubre y no en septiembre', () => {
    const nomina = mov({ tipo: 'ingreso', importe: 200000, categoriaId: 'nomina', fecha: '2026-09-29', mesImputado: '2026-10-01' })
    expect(resumenMes([nomina], '2026-09-01').ingresos).toBe(0)
    expect(resumenMes([nomina], '2026-10-01').ingresos).toBe(200000)
  })

  it('la nómina retrasada (cobrada el 2 de octubre para septiembre) cuenta en septiembre', () => {
    const nomina = mov({ tipo: 'ingreso', importe: 200000, categoriaId: 'nomina', fecha: '2026-10-02', mesImputado: '2026-09-01' })
    expect(resumenMes([nomina], '2026-09-01').ingresos).toBe(200000)
    expect(resumenMes([nomina], '2026-10-01').ingresos).toBe(0)
  })

  it('cambio de año: un gasto del 31 de diciembre es de diciembre', () => {
    expect(resumenMes([mov({ fecha: '2026-12-31' })], '2026-12-01').gastoNeto).toBe(1000)
    expect(resumenMes([mov({ fecha: '2026-12-31' })], '2027-01-01').gastoNeto).toBe(0)
  })
})

describe('límite del mes: tres variantes', () => {
  it('con presupuesto total: es el presupuesto', () => {
    expect(limiteMes(120000)).toEqual({ valor: 120000 })
  })

  it('sin presupuesto: ingresos previstos menos objetivo de ahorro', () => {
    expect(limiteMes(null)).toBeNull()
  })

  it('sin presupuesto ni ingresos previstos: no hay límite', () => {
  })

  it('objetivo de ahorro en importe o en porcentaje de los ingresos', () => {
    expect(objetivoAhorro({ ahorroTipo: 'importe', ahorroValor: 30000 }, 200000)).toBe(30000)
    expect(objetivoAhorro({ ahorroTipo: 'porcentaje', ahorroValor: 15 }, 200000)).toBe(30000)
    expect(objetivoAhorro(SIN_AHORRO, 200000)).toBe(0)
  })
})

describe('calcularControl', () => {
  it('sin presupuesto ni ingresos: no hay límite ni estado', () => {
    const c = calcularControl(entrada({ movimientos: [mov({ importe: 5000 })] }))
    expect(c.limite).toBeNull()
    expect(c.disponible).toBeNull()
    expect(c.disponibleSinPendientes).toBeNull()
    expect(c.estado).toBeNull()
    expect(c.resumen.gastoNeto).toBe(5000)
  })

  it('con presupuesto total: disponible = límite − gasto neto − fijos pendientes', () => {
    const c = calcularControl(
      entrada({
        presupuestos: [presupuesto(120000)],
        movimientos: [mov({ importe: 30000 })],
        fijos: [fijo({ importe: 60000, diaMes: 28 })],
      }),
    )
    expect(c.limite).toEqual({ valor: 120000 })
    expect(c.fijosGastoPendiente).toBe(60000)
    expect(c.disponible).toBe(30000)
    // La cifra grande de Inicio no cuenta los fijos pendientes hasta que se cobran.
    expect(c.disponibleSinPendientes).toBe(90000)
  })

  it('un fijo pagado ya está en el gasto neto y no se descuenta dos veces', () => {
    const pago = mov({ importe: 61000, categoriaId: 'casa', fijoId: 'f1', fijoMes: MES })
    const c = calcularControl(
      entrada({
        presupuestos: [presupuesto(120000)],
        movimientos: [pago],
        pagos: [pago],
        fijos: [fijo({ importe: 60000 })],
      }),
    )
    expect(c.fijosGastoPendiente).toBe(0)
    expect(c.resumen.gastoFijo).toBe(61000)
    expect(c.disponible).toBe(59000)
  })

  it('un fijo omitido no cuenta', () => {
    const c = calcularControl(
      entrada({
        presupuestos: [presupuesto(120000)],
        fijos: [fijo()],
        omitidos: [{ fijoId: 'f1', mes: MES }],
      }),
    )
    expect(c.fijosGastoPendiente).toBe(0)
    expect(c.disponible).toBe(120000)
  })

  it('sin presupuesto no hay límite aunque haya ingresos: no se deduce de ellos', () => {
    const nomina = mov({ tipo: 'ingreso', importe: 100000, categoriaId: 'nomina', fecha: '2026-08-29', mesImputado: MES })
    const c = calcularControl(
      entrada({
        movimientos: [nomina],
        ajustes: { ahorroTipo: 'importe', ahorroValor: 30000 },
        fijos: [fijo({ id: 'f2', tipo: 'ingreso', importe: 50000, categoriaId: 'nomina', diaMes: 27 })],
      }),
    )
    expect(c.ingresosPrevistos).toBe(150000)
    expect(c.objetivoAhorro).toBe(30000)
    expect(c.limite).toBeNull()
    expect(c.disponible).toBeNull()
    expect(c.estado).toBeNull()
  })

  it('ingresos frente a gastos: cobrado, por cobrar, fijo, variable, pendiente y ahorro', () => {
    const nomina = mov({ tipo: 'ingreso', importe: 100000, categoriaId: 'nomina' })
    const pago = mov({ importe: 61000, categoriaId: 'casa', fijoId: 'f1', fijoMes: MES })
    const c = calcularControl(
      entrada({
        movimientos: [nomina, pago, mov({ importe: 9000 }), mov({ tipo: 'devolucion', importe: 1000 })],
        pagos: [pago],
        ajustes: { ahorroTipo: 'importe', ahorroValor: 30000 },
        fijos: [
          fijo({ importe: 60000 }),
          fijo({ id: 'f2', importe: 5000, diaMes: 28 }),
          fijo({ id: 'f3', tipo: 'ingreso', importe: 50000, categoriaId: 'nomina', diaMes: 28 }),
        ],
      }),
    )
    expect(ingresosFrenteAGastos(c)).toEqual({
      ingresos: 100000,
      ingresosPendientes: 50000,
      gastoFijo: 61000,
      gastoVariable: 8000,
      gastosPendientes: 5000,
      ahorro: 31000,
      ahorroPrevisto: 76000,
      objetivoAhorro: 30000,
      escala: 150000,
    })
  })

  it('ingresos frente a gastos: más devoluciones que gasto variable no dibuja en negativo', () => {
    const c = calcularControl(entrada({ movimientos: [mov({ tipo: 'devolucion', importe: 2000 })] }))
    const r = ingresosFrenteAGastos(c)
    expect(r.gastoVariable).toBe(0)
    expect(r.ahorro).toBe(2000)
  })

  it('días que quedan (incluido hoy) y disponible por día', () => {
    // 16 de septiembre: quedan 15 días (16..30)
    const c = calcularControl(entrada({ presupuestos: [presupuesto(150000)], movimientos: [mov({ importe: 30000 })] }))
    expect(c.diasQueQuedan).toBe(15)
    expect(c.diasTranscurridos).toBe(16)
    expect(c.disponible).toBe(120000)
    expect(c.disponiblePorDia).toBe(8000)
    expect(c.ritmoPrevisto).toBe(5000)
  })

  it('estado: bien, ajustado y pasado', () => {
    const base = { presupuestos: [presupuesto(150000)] }
    // ritmo previsto 5.000 céntimos/día; hoy quedan 15 días
    expect(calcularControl(entrada({ ...base, movimientos: [mov({ importe: 30000 })] })).estado).toBe('bien')
    // gastado 100.000: disponible 50.000 → 3.333/día < 5.000
    expect(calcularControl(entrada({ ...base, movimientos: [mov({ importe: 100000 })] })).estado).toBe('ajustado')
    // gastado 154.500: disponible −4.500
    const pasado = calcularControl(entrada({ ...base, movimientos: [mov({ importe: 154500 })] }))
    expect(pasado.estado).toBe('pasado')
    expect(pasado.disponible).toBe(-4500)
  })

  it('el ritmo previsto descuenta los fijos del mes', () => {
    const c = calcularControl(entrada({ presupuestos: [presupuesto(150000)], fijos: [fijo({ importe: 60000 })] }))
    expect(c.ritmoPrevisto).toBe(3000)
  })

  it('mes pasado: sin días que quedar, estado según el signo del disponible', () => {
    const pasado = calcularControl(
      entrada({ mes: '2026-08-01', presupuestos: [presupuesto(100000, null, '2026-08-01')], movimientos: [mov({ fecha: '2026-08-10', importe: 40000 })] }),
    )
    expect(pasado.diasQueQuedan).toBe(0)
    expect(pasado.disponiblePorDia).toBeNull()
    expect(pasado.estado).toBe('bien')
  })

  it('mes futuro: todos los días por delante', () => {
    const c = calcularControl(entrada({ mes: '2026-10-01', presupuestos: [presupuesto(100000)] }))
    expect(c.diasQueQuedan).toBe(31)
    expect(c.diasTranscurridos).toBe(0)
  })

  it('el presupuesto heredado de un mes anterior se aplica', () => {
    const c = calcularControl(entrada({ presupuestos: [presupuesto(90000, null, '2026-06-01')] }))
    expect(c.presupuestoTotal).toBe(90000)
  })
})

describe('progresoPresupuestos', () => {
  const categorias = [
    { id: 'comida', nombre: 'Comida', tipo: 'gasto' as const, color: '#000', icono: null, orden: 0, archivada: false },
    { id: 'ocio', nombre: 'Ocio', tipo: 'gasto' as const, color: '#000', icono: null, orden: 1, archivada: false },
    { id: 'salud', nombre: 'Salud', tipo: 'gasto' as const, color: '#000', icono: null, orden: 2, archivada: false },
  ]

  it('solo categorías con presupuesto, con nivel normal / aviso / superado', () => {
    const ps = [presupuesto(20000, 'comida'), presupuesto(10000, 'ocio')]
    const movs = [mov({ importe: 8500, categoriaId: 'ocio' }), mov({ importe: 21000, categoriaId: 'comida' })]
    const c = calcularControl(entrada({ presupuestos: ps, movimientos: movs }))
    const p = progresoPresupuestos(c, ps, categorias)
    expect(p.map((x) => [x.categoria.id, x.nivel])).toEqual([
      ['comida', 'superado'],
      ['ocio', 'aviso'],
    ])
    expect(p[1].fraccion).toBeCloseTo(0.85)
  })

  it('exactamente el 80 % es aviso y el 100 % superado', () => {
    const ps = [presupuesto(10000, 'ocio')]
    const nivel = (importe: number) =>
      progresoPresupuestos(calcularControl(entrada({ presupuestos: ps, movimientos: [mov({ importe, categoriaId: 'ocio' })] })), ps, categorias)[0].nivel
    expect(nivel(7999)).toBe('normal')
    expect(nivel(8000)).toBe('aviso')
    expect(nivel(9999)).toBe('aviso')
    expect(nivel(10000)).toBe('superado')
  })
})

describe('avisoTrasGasto', () => {
  const fmt = (c: number) => `${c / 100} €`
  const ps200 = [presupuesto(20000, 'comida')]

  function aviso(importe: number, previo: number, lim: number | null) {
    const movs = [mov({ importe: previo, categoriaId: 'comida' }), mov({ importe, categoriaId: 'comida' })]
    const control = calcularControl(entrada({ presupuestos: lim ? [...ps200, presupuesto(lim)] : ps200, movimientos: movs }))
    return avisoTrasGasto({
      importe,
      categoriaNombre: 'Comida',
      gastadoCategoria: previo + importe,
      presupuestoCategoria: 20000,
      control,
      fmt,
    })
  }

  it('muestra el estado de la categoría', () => {
    const a = aviso(500, 16700, null)
    expect(a.texto).toBe('Comida: 172 € de 200 €')
    expect(a.destacado).toBe(false)
  })

  it('destaca al cruzar el 80 % y el 100 % de la categoría', () => {
    expect(aviso(2000, 14000, null).destacado).toBe(true)
    expect(aviso(2000, 14000, null).texto).toMatch(/llevas el 80 %/)
    expect(aviso(2000, 19000, null).texto).toMatch(/superado el presupuesto/)
  })

  it('no destaca si ya se había cruzado antes', () => {
    expect(aviso(500, 17000, null).destacado).toBe(false)
  })

  it('destaca al superar el límite del mes', () => {
    const a = aviso(2000, 19000, 21000)
    expect(a.texto).toMatch(/superado el límite del mes/)
  })
})
