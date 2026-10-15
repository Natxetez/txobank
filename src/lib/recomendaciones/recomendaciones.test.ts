import { describe, expect, it } from 'vitest'
import type { Categoria, Fijo, Movimiento, Presupuesto } from '../../data/types'
import { generarRecomendaciones, mesesCompletos } from './index'
import type { ContextoRecomendaciones } from './index'

const fmt = (c: number) => `${c / 100} €`

const CATEGORIAS: Categoria[] = [
  { id: 'comida', nombre: 'Comida', tipo: 'gasto', color: '#000', icono: null, orden: 0, archivada: false },
  { id: 'ocio', nombre: 'Ocio', tipo: 'gasto', color: '#000', icono: null, orden: 1, archivada: false },
  { id: 'casa', nombre: 'Casa', tipo: 'gasto', color: '#000', icono: null, orden: 2, archivada: false },
  { id: 'subs', nombre: 'Suscripciones', tipo: 'gasto', color: '#000', icono: null, orden: 3, archivada: false },
  { id: 'nomina', nombre: 'Nómina', tipo: 'ingreso', color: '#000', icono: null, orden: 0, archivada: false },
]

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
    hora: null,
    ...p,
  }
}

function fijo(p: Partial<Fijo> = {}): Fijo {
  return {
    id: 'f1',
    nombre: 'Luz',
    descripcion: '',
    tipo: 'gasto',
    importe: 7000,
    cuentaId: 'c1',
    cuentaDestinoId: null,
    categoriaId: 'casa',
    diaMes: 20,
    cadaMeses: 1,
    desde: '2026-01-01',
    hasta: null,
    activo: true,
    ...p,
  }
}

const presupuesto = (importe: number, categoriaId: string | null = null, mes = '2026-01-01'): Presupuesto => ({
  id: `${mes}${categoriaId}`,
  mes,
  categoriaId,
  importe,
})

/** Un mes de historia: ingresos el día 1 y un gasto de una categoría el día 10. */
function historial(mes: string, { ingresos = 0, gasto = 0, categoriaId = 'comida' } = {}): Movimiento[] {
  const m = mes.slice(0, 7)
  const r: Movimiento[] = []
  if (ingresos) r.push(mov({ tipo: 'ingreso', importe: ingresos, fecha: `${m}-01`, categoriaId: 'nomina' }))
  if (gasto) r.push(mov({ importe: gasto, fecha: `${m}-10`, categoriaId }))
  return r
}

const MESES_PREVIOS = ['2026-06-01', '2026-07-01', '2026-08-01']

function ctx(movimientos: Movimiento[], extra: Partial<ContextoRecomendaciones> = {}): ContextoRecomendaciones {
  return {
    hoy: '2026-09-16',
    movimientos,
    categorias: CATEGORIAS,
    presupuestos: [],
    ajustes: { ahorroTipo: null, ahorroValor: null },
    fijos: [],
    omitidos: [],
    ...extra,
  }
}

const ids = (c: ContextoRecomendaciones) => generarRecomendaciones(c, fmt).recomendaciones.map((r) => r.id.split(':').slice(0, -1).join(':'))
const tiene = (c: ContextoRecomendaciones, clave: string) => ids(c).includes(clave)

describe('mesesCompletos', () => {
  it('cuenta los meses anteriores al actual desde el primer movimiento', () => {
    expect(mesesCompletos([], '2026-09-01')).toBe(0)
    expect(mesesCompletos([mov({ fecha: '2026-09-02' })], '2026-09-01')).toBe(0)
    expect(mesesCompletos([mov({ fecha: '2026-07-20' })], '2026-09-01')).toBe(2)
    expect(mesesCompletos([mov({ fecha: '2025-12-20' })], '2026-02-01')).toBe(2)
  })
})

describe('faltan datos', () => {
  it('con menos de 2 meses completos se indica', () => {
    expect(generarRecomendaciones(ctx([mov({ fecha: '2026-08-10' })]), fmt).faltanDatos).toBe(true)
    expect(generarRecomendaciones(ctx(MESES_PREVIOS.flatMap((m) => historial(m, { gasto: 1000 }))), fmt).faltanDatos).toBe(false)
  })
})

describe('proyección de fin de mes', () => {
  it('con límite: avisa si la proyección lo supera, con el exceso', () => {
    const c = ctx([mov({ importe: 80000, fecha: '2026-09-10' })], { presupuestos: [presupuesto(100000)] })
    const r = generarRecomendaciones(c, fmt).recomendaciones.find((x) => x.id.startsWith('proyeccion'))
    expect(r?.tipo).toBe('aviso')
    // 800 € en 16 días = 50 €/día → 1.500 € a fin de mes, 500 € por encima del límite de 1.000 €
    expect(r?.texto).toBe('A este ritmo terminarás el mes 500 € por encima de tu límite.')
  })

  it('no avisa si va bien, ni antes del día 7', () => {
    expect(tiene(ctx([mov({ importe: 10000 })], { presupuestos: [presupuesto(100000)] }), 'proyeccion')).toBe(false)
    const temprano = ctx([mov({ importe: 90000, fecha: '2026-09-03' })], { presupuestos: [presupuesto(100000)], hoy: '2026-09-05' })
    expect(tiene(temprano, 'proyeccion')).toBe(false)
  })

  it('sin límite: compara con la media de 3 meses (y necesita 2 meses de datos)', () => {
    const hist = MESES_PREVIOS.flatMap((m) => historial(m, { gasto: 100000 }))
    expect(tiene(ctx([...hist, mov({ importe: 90000, fecha: '2026-09-10' })]), 'proyeccion')).toBe(true)
    expect(tiene(ctx([...hist, mov({ importe: 30000, fecha: '2026-09-10' })]), 'proyeccion')).toBe(false)
    expect(tiene(ctx([mov({ importe: 900000, fecha: '2026-09-10' })]), 'proyeccion')).toBe(false)
  })
})

describe('ritmo diario bajo', () => {
  it('avisa cuando el disponible por día cae por debajo de la mitad del ritmo previsto', () => {
    expect(tiene(ctx([mov({ importe: 120000 })], { presupuestos: [presupuesto(150000)] }), 'ritmo-bajo')).toBe(true)
    expect(tiene(ctx([mov({ importe: 60000 })], { presupuestos: [presupuesto(150000)] }), 'ritmo-bajo')).toBe(false)
  })

  it('no repite el aviso cuando ya se ha pasado (disponible negativo)', () => {
    expect(tiene(ctx([mov({ importe: 170000 })], { presupuestos: [presupuesto(150000)] }), 'ritmo-bajo')).toBe(false)
  })
})

describe('presupuesto en riesgo', () => {
  const ps = [presupuesto(20000, 'ocio')]

  it('avisa si la proyección de la categoría supera su presupuesto', () => {
    const r = generarRecomendaciones(ctx([mov({ importe: 18000, categoriaId: 'ocio' })], { presupuestos: ps }), fmt).recomendaciones
    const a = r.find((x) => x.id.startsWith('presupuesto-riesgo:ocio'))
    expect(a?.texto).toBe('Ocio: llevas 180 € de 200 € y quedan 14 días.')
    expect(a?.accion).toEqual({ tipo: 'ver-movimientos', mes: '2026-09-01', categoriaId: 'ocio' })
  })

  it('no avisa si va bien', () => {
    expect(tiene(ctx([mov({ importe: 5000, categoriaId: 'ocio' })], { presupuestos: ps }), 'presupuesto-riesgo:ocio')).toBe(false)
  })

  it('un fijo ya pagado no se proyecta como si se repitiera cada día', () => {
    const pagoFijo = mov({ importe: 15000, categoriaId: 'casa', fijoId: 'f1', fijoMes: '2026-09-01', fecha: '2026-09-01' })
    const c = ctx([pagoFijo], { presupuestos: [presupuesto(20000, 'casa')], fijos: [fijo({ importe: 15000, diaMes: 1 })] })
    expect(tiene(c, 'presupuesto-riesgo:casa')).toBe(false)
  })
})

describe('ahorro en riesgo', () => {
  const ingreso = mov({ tipo: 'ingreso', importe: 200000, fecha: '2026-09-01', categoriaId: 'nomina' })

  it('avisa si el ahorro proyectado queda por debajo del objetivo', () => {
    const c = ctx([ingreso, mov({ importe: 150000 })], { ajustes: { ahorroTipo: 'importe', ahorroValor: 30000 } })
    const a = generarRecomendaciones(c, fmt).recomendaciones.find((x) => x.id.startsWith('ahorro-riesgo'))
    expect(a?.texto).toBe('Si sigues así, ahorrarás 0 € de los 300 € previstos.')
  })

  it('no avisa sin objetivo o si se va a cumplir', () => {
    expect(tiene(ctx([ingreso, mov({ importe: 150000 })]), 'ahorro-riesgo')).toBe(false)
    expect(tiene(ctx([ingreso, mov({ importe: 10000 })], { ajustes: { ahorroTipo: 'importe', ahorroValor: 30000 } }), 'ahorro-riesgo')).toBe(false)
  })
})

describe('categoría disparada', () => {
  const hist = MESES_PREVIOS.flatMap((m) => historial(m, { gasto: 10000 }))

  it('por encima del 130 % de su media y con al menos 30 € de diferencia', () => {
    const a = generarRecomendaciones(ctx([...hist, mov({ importe: 14500, fecha: '2026-09-02' })]), fmt).recomendaciones.find((x) => x.id.startsWith('categoria-disparada:comida'))
    expect(a?.texto).toBe('Este mes gastas un 45 % más en Comida que de costumbre.')
  })

  it('no salta con menos del 130 % ni con poca diferencia en euros', () => {
    expect(tiene(ctx([...hist, mov({ importe: 12500, fecha: '2026-09-02' })]), 'categoria-disparada:comida')).toBe(false)
    const pequena = MESES_PREVIOS.flatMap((m) => historial(m, { gasto: 1000 }))
    expect(tiene(ctx([...pequena, mov({ importe: 2500, fecha: '2026-09-02' })]), 'categoria-disparada:comida')).toBe(false)
  })
})

describe('sugerir presupuesto', () => {
  const hist = MESES_PREVIOS.flatMap((m) => historial(m, { gasto: 24000 }))

  it('categoría con gasto medio de más de 100 € y sin presupuesto', () => {
    const a = generarRecomendaciones(ctx(hist), fmt).recomendaciones.find((x) => x.id.startsWith('sugerir-presupuesto:comida'))
    expect(a?.tipo).toBe('sugerencia')
    expect(a?.texto).toBe('Sueles gastar 240 € al mes en Comida. ¿Le pones un presupuesto de 240 €?')
    expect(a?.accion).toEqual({ tipo: 'crear-presupuesto', categoriaId: 'comida', importe: 24000 })
  })

  it('no si ya tiene presupuesto, si gasta poco o si faltan datos', () => {
    expect(tiene(ctx(hist, { presupuestos: [presupuesto(25000, 'comida')] }), 'sugerir-presupuesto:comida')).toBe(false)
    expect(tiene(ctx(MESES_PREVIOS.flatMap((m) => historial(m, { gasto: 9000 }))), 'sugerir-presupuesto:comida')).toBe(false)
    expect(tiene(ctx([mov({ fecha: '2026-08-10', importe: 90000 })]), 'sugerir-presupuesto:comida')).toBe(false)
  })
})

describe('gastos hormiga', () => {
  const pequenos = (k: number, importe = 300) => Array.from({ length: k }, () => mov({ importe, fecha: '2026-09-05' }))

  it('10 o más gastos de menos de 5 € en una categoría', () => {
    const a = generarRecomendaciones(ctx(pequenos(10)), fmt).recomendaciones.find((x) => x.id.startsWith('hormiga:comida'))
    expect(a?.texto).toBe('10 gastos pequeños en Comida suman 30 €.')
  })

  it('no con 9 gastos ni con importes de 5 € o más', () => {
    expect(tiene(ctx(pequenos(9)), 'hormiga:comida')).toBe(false)
    expect(tiene(ctx(pequenos(12, 500)), 'hormiga:comida')).toBe(false)
  })
})

describe('fijo más caro', () => {
  const pagos = (importes: number[]) =>
    importes.map((importe, i) => {
      const mes = ['2026-06-01', '2026-07-01', '2026-08-01'][i]
      return mov({ importe, categoriaId: 'casa', fijoId: 'f1', fijoMes: mes, fecha: mes.slice(0, 7) + '-20' })
    })
  const actual = (importe: number) => mov({ importe, categoriaId: 'casa', fijoId: 'f1', fijoMes: '2026-09-01', fecha: '2026-09-12' })

  it('más de un 10 % sobre la media de sus últimos pagos', () => {
    const c = ctx([...pagos([6000, 6000, 6000]), actual(7500)], { fijos: [fijo()] })
    const a = generarRecomendaciones(c, fmt).recomendaciones.find((x) => x.id.startsWith('fijo-caro'))
    expect(a?.texto).toBe('El pago de «Luz» de este mes (75 €) es un 25 % más caro que tu media.')
  })

  it('no si sube poco o hay pocos pagos previos', () => {
    expect(tiene(ctx([...pagos([6000, 6000, 6000]), actual(6500)], { fijos: [fijo()] }), 'fijo-caro:f1')).toBe(false)
    expect(tiene(ctx([...pagos([6000]), actual(9000)], { fijos: [fijo()] }), 'fijo-caro:f1')).toBe(false)
  })
})

describe('suscripciones', () => {
  const subs = fijo({ id: 's1', nombre: 'Netflix', importe: 1500, categoriaId: 'subs' })
  const base = [mov({ fecha: '2026-06-10' })]

  it('al empezar el trimestre, con su coste anual', () => {
    const a = generarRecomendaciones(ctx(base, { hoy: '2026-10-03', fijos: [subs, fijo({ id: 's2', importe: 1000, categoriaId: 'subs' })] }), fmt).recomendaciones.find((x) => x.id.startsWith('suscripciones'))
    expect(a?.texto).toBe('Tus suscripciones suman 300 € al año. ¿Las usas todas?')
  })

  it('no fuera de esa ventana, ni sin suscripciones', () => {
    expect(tiene(ctx(base, { hoy: '2026-09-03', fijos: [subs] }), 'suscripciones')).toBe(false)
    expect(tiene(ctx(base, { hoy: '2026-10-20', fijos: [subs] }), 'suscripciones')).toBe(false)
    expect(tiene(ctx(base, { hoy: '2026-10-03', fijos: [fijo()] }), 'suscripciones')).toBe(false)
  })
})

describe('peso de los fijos', () => {
  const hist = MESES_PREVIOS.flatMap((m) => historial(m, { ingresos: 200000, gasto: 1000 }))

  it('más del 50 % de los ingresos medios', () => {
    const a = generarRecomendaciones(ctx(hist, { fijos: [fijo({ importe: 116000 })] }), fmt).recomendaciones.find((x) => x.id.startsWith('peso-fijos'))
    expect(a?.texto).toBe('Tus gastos fijos son el 58 % de tus ingresos.')
  })

  it('no si es menor, y cuenta los no mensuales por su coste mensual', () => {
    expect(tiene(ctx(hist, { fijos: [fijo({ importe: 50000 })] }), 'peso-fijos')).toBe(false)
    expect(tiene(ctx(hist, { fijos: [fijo({ importe: 360000, cadaMeses: 12 })] }), 'peso-fijos')).toBe(false)
  })
})

describe('gasto inusual', () => {
  const previos = (k: number) => Array.from({ length: k }, (_, i) => mov({ importe: 1000, categoriaId: 'ocio', fecha: `2026-08-${String(i + 1).padStart(2, '0')}` }))

  it('más de 3 veces la mediana de su categoría, con al menos 5 gastos previos', () => {
    const a = generarRecomendaciones(ctx([...previos(6), mov({ importe: 32000, categoriaId: 'ocio', fecha: '2026-09-12' })]), fmt).recomendaciones.find((x) => x.id.startsWith('gasto-inusual'))
    expect(a?.texto).toBe('El gasto de 320 € en Ocio del día 12 es mucho mayor de lo habitual.')
  })

  it('no con menos de 5 gastos previos ni si no llega a 3 veces la mediana', () => {
    expect(tiene(ctx([...previos(4), mov({ importe: 32000, categoriaId: 'ocio', fecha: '2026-09-12' })]), 'gasto-inusual')).toBe(false)
    expect(ids(ctx([...previos(6), mov({ importe: 2500, categoriaId: 'ocio', fecha: '2026-09-12' })])).some((i) => i.startsWith('gasto-inusual'))).toBe(false)
  })
})

describe('logros', () => {
  it('racha de 3 o más días sin gasto', () => {
    const a = generarRecomendaciones(ctx([mov({ fecha: '2026-09-10' })]), fmt).recomendaciones.find((x) => x.id.startsWith('racha'))
    expect(a?.tipo).toBe('logro')
    expect(a?.texto).toBe('Llevas 6 días seguidos sin gasto variable.')
    expect(tiene(ctx([mov({ fecha: '2026-09-15' })]), 'racha')).toBe(false)
  })

  it('varios meses seguidos ahorrando', () => {
    const hist = MESES_PREVIOS.flatMap((m) => historial(m, { ingresos: 200000, gasto: 156000 }))
    const a = generarRecomendaciones(ctx(hist), fmt).recomendaciones.find((x) => x.id.startsWith('meses-ahorrando'))
    expect(a?.texto).toBe('Llevas 3 meses seguidos ahorrando: el último, un 22 % de tus ingresos.')
  })

  it('no si un mes se rompe la racha de ahorro', () => {
    const hist = [...historial('2026-06-01', { ingresos: 200000, gasto: 50000 }), ...historial('2026-07-01', { ingresos: 200000, gasto: 250000 }), ...historial('2026-08-01', { ingresos: 200000, gasto: 50000 })]
    expect(tiene(ctx(hist), 'meses-ahorrando')).toBe(false)
  })

  it('objetivo de ahorro cumplido el mes anterior', () => {
    const hist = historial('2026-08-01', { ingresos: 200000, gasto: 100000 })
    const a = generarRecomendaciones(ctx(hist, { ajustes: { ahorroTipo: 'importe', ahorroValor: 30000 } }), fmt).recomendaciones.find((x) => x.id.startsWith('objetivo-cumplido'))
    expect(a?.texto).toBe('En agosto ahorraste 1000 €, por encima de tu objetivo de 300 €.')
  })
})

describe('orden, ids y descarte', () => {
  it('avisos, luego sugerencias, luego logros', () => {
    const hist = MESES_PREVIOS.flatMap((m) => historial(m, { ingresos: 200000, gasto: 24000 }))
    const r = generarRecomendaciones(ctx([...hist, mov({ importe: 5000, fecha: '2026-09-02' })], { presupuestos: [presupuesto(20000)] }), fmt).recomendaciones
    const orden = r.map((x) => x.tipo)
    expect(orden).toEqual([...orden].sort((a, b) => ['aviso', 'sugerencia', 'logro'].indexOf(a) - ['aviso', 'sugerencia', 'logro'].indexOf(b)))
    expect(orden).toContain('sugerencia')
  })

  it('el id incluye el mes: descartar dura hasta el mes siguiente', () => {
    const hist = [mov({ fecha: '2026-06-01' })]
    const septiembre = generarRecomendaciones(ctx(hist, { hoy: '2026-09-16' }), fmt).recomendaciones.find((x) => x.id.startsWith('racha'))
    const octubre = generarRecomendaciones(ctx(hist, { hoy: '2026-10-16' }), fmt).recomendaciones.find((x) => x.id.startsWith('racha'))
    expect(septiembre?.id).toBe('racha:2026-09-01')
    expect(octubre?.id).toBe('racha:2026-10-01')
  })

  it('sin movimientos no hay nada que recomendar', () => {
    const r = generarRecomendaciones(ctx([]), fmt)
    expect(r.recomendaciones).toEqual([])
    expect(r.faltanDatos).toBe(true)
  })
})

describe('detalles de redacción y ventanas', () => {
  it('"quedan 1 día" en singular', () => {
    const c = ctx([mov({ importe: 19500, categoriaId: 'ocio', fecha: '2026-09-29' })], { hoy: '2026-09-29', presupuestos: [presupuesto(20000, 'ocio')] })
    const a = generarRecomendaciones(c, fmt).recomendaciones.find((x) => x.id.startsWith('presupuesto-riesgo:ocio'))
    expect(a?.texto).toBe('Ocio: llevas 195 € de 200 € y quedan 1 día.')
  })

  it('un gasto inusual de hace más de una semana ya no se avisa', () => {
    const previos = Array.from({ length: 6 }, (_, i) => mov({ importe: 1000, categoriaId: 'ocio', fecha: `2026-08-${String(i + 1).padStart(2, '0')}` }))
    const viejo = mov({ importe: 32000, categoriaId: 'ocio', fecha: '2026-09-02' })
    expect(tiene(ctx([...previos, viejo]), 'gasto-inusual')).toBe(false)
  })
})
