import { describe, expect, it } from 'vitest'
import type { Movimiento } from '../data/types'
import {
  agruparPorDia,
  detectarFrecuentes,
  filtrarMovimientos,
  normalizarConcepto,
  ordenarPorUso,
  sugerirCategoria,
  sugerirConceptos,
  ultimaCuentaUsada,
  validarMovimiento,
} from './movimientos'

let contador = 0
function mov(parcial: Partial<Movimiento>): Movimiento {
  contador += 1
  return {
    id: `m${contador}`,
    tipo: 'gasto',
    importe: 100,
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
    ...parcial,
  }
}

const HOY = '2026-09-29'

describe('validarMovimiento', () => {
  const gasto = {
    tipo: 'gasto' as const,
    importe: 450,
    fecha: '2026-09-29',
    cuentaId: 'c1',
    cuentaDestinoId: null,
    categoriaId: 'comida',
    mesImputado: null,
    grupoId: null,
    traspasoId: null,
    hora: null,
  }

  it('acepta un gasto correcto', () => {
    expect(validarMovimiento(gasto)).toBeNull()
  })

  it('exige importe positivo y entero', () => {
    expect(validarMovimiento({ ...gasto, importe: 0 })).toMatch(/importe/)
    expect(validarMovimiento({ ...gasto, importe: -5 })).toMatch(/importe/)
    expect(validarMovimiento({ ...gasto, importe: 4.5 })).toMatch(/importe/)
  })

  it('exige cuenta y categoría en gastos, ingresos y devoluciones', () => {
    expect(validarMovimiento({ ...gasto, cuentaId: '' })).toMatch(/cuenta/)
    expect(validarMovimiento({ ...gasto, categoriaId: null })).toMatch(/categoría/)
    expect(validarMovimiento({ ...gasto, tipo: 'devolucion', categoriaId: null })).toMatch(/categoría/)
    expect(validarMovimiento({ ...gasto, cuentaDestinoId: 'c2' })).toMatch(/destino/)
  })

  it('traspaso: con destino distinto y sin categoría', () => {
    const t = { ...gasto, tipo: 'traspaso' as const, categoriaId: null, cuentaDestinoId: 'c2' }
    expect(validarMovimiento(t)).toBeNull()
    expect(validarMovimiento({ ...t, cuentaDestinoId: null })).toMatch(/destino/)
    expect(validarMovimiento({ ...t, cuentaDestinoId: 'c1' })).toMatch(/distintas/)
    expect(validarMovimiento({ ...t, categoriaId: 'comida' })).toMatch(/categoría/)
  })

  it('mes imputado: solo ingresos y solo el mes anterior o el siguiente', () => {
    const ingreso = { ...gasto, tipo: 'ingreso' as const, categoriaId: 'nomina', fecha: '2026-09-29' }
    expect(validarMovimiento({ ...ingreso, mesImputado: '2026-10-01' })).toBeNull()
    expect(validarMovimiento({ ...ingreso, mesImputado: '2026-08-01' })).toBeNull()
    expect(validarMovimiento({ ...ingreso, mesImputado: '2026-11-01' })).toMatch(/anterior o el siguiente/)
    expect(validarMovimiento({ ...ingreso, mesImputado: '2026-09-01' })).toMatch(/anterior o el siguiente/)
    expect(validarMovimiento({ ...gasto, mesImputado: '2026-10-01' })).toMatch(/ingresos/)
  })

  it('grupo: solo en gastos', () => {
    expect(validarMovimiento({ ...gasto, grupoId: 'g1' })).toBeNull()
    expect(validarMovimiento({ ...gasto, tipo: 'devolucion', grupoId: 'g1' })).toMatch(/grupo/)
    expect(validarMovimiento({ ...gasto, tipo: 'ingreso', categoriaId: 'nomina', grupoId: 'g1' })).toMatch(/grupo/)
    expect(
      validarMovimiento({ ...gasto, tipo: 'traspaso', categoriaId: null, cuentaDestinoId: 'c2', grupoId: 'g1' }),
    ).toMatch(/grupo/)
  })

  it('hora: HH:MM válida o ninguna', () => {
    expect(validarMovimiento({ ...gasto, hora: '09:35' })).toBeNull()
    expect(validarMovimiento({ ...gasto, hora: '23:59' })).toBeNull()
    expect(validarMovimiento({ ...gasto, hora: '24:00' })).toMatch(/hora/)
    expect(validarMovimiento({ ...gasto, hora: '9:5' })).toMatch(/hora/)
  })

  it('mes imputado cruzando de año', () => {
    const ingreso = { ...gasto, tipo: 'ingreso' as const, categoriaId: 'nomina', fecha: '2026-12-30' }
    expect(validarMovimiento({ ...ingreso, mesImputado: '2027-01-01' })).toBeNull()
  })
})

describe('normalizarConcepto', () => {
  it('ignora mayúsculas, acentos y espacios', () => {
    expect(normalizarConcepto('  CaFé   con  leche ')).toBe('cafe con leche')
  })
})

describe('detectarFrecuentes', () => {
  const cafe = (fecha: string, importe = 150) => mov({ nota: 'Café', importe, fecha })

  it('necesita 3 repeticiones del mismo concepto y categoría en 90 días', () => {
    const dos = [cafe('2026-09-01'), cafe('2026-09-02')]
    expect(detectarFrecuentes(dos, HOY)).toEqual([])
    const tres = [...dos, cafe('2026-09-03')]
    expect(detectarFrecuentes(tres, HOY)).toHaveLength(1)
  })

  it('ignora lo anterior a 90 días, lo futuro, los pagos de fijos y otros tipos', () => {
    const viejos = [cafe('2026-06-01'), cafe('2026-06-02'), cafe('2026-06-03')]
    expect(detectarFrecuentes(viejos, HOY)).toEqual([])
    const futuros = [cafe('2026-10-01'), cafe('2026-10-02'), cafe('2026-10-03')]
    expect(detectarFrecuentes(futuros, HOY)).toEqual([])
    const fijos = ['2026-09-01', '2026-09-02', '2026-09-03'].map((f) =>
      mov({ nota: 'Café', fecha: f, fijoId: 'f1', fijoMes: '2026-09-01' }),
    )
    expect(detectarFrecuentes(fijos, HOY)).toEqual([])
    const ingresos = ['2026-09-01', '2026-09-02', '2026-09-03'].map((f) => mov({ nota: 'Café', fecha: f, tipo: 'ingreso' }))
    expect(detectarFrecuentes(ingresos, HOY)).toEqual([])
  })

  it('ignora las entradas de grupos', () => {
    const agrupados = ['2026-09-01', '2026-09-02', '2026-09-03'].map((f) => mov({ nota: 'Café', fecha: f, grupoId: 'g1' }))
    expect(detectarFrecuentes(agrupados, HOY)).toEqual([])
    expect(detectarFrecuentes([...agrupados, cafe('2026-09-04'), cafe('2026-09-05')], HOY)).toEqual([])
    const r = detectarFrecuentes([...agrupados, cafe('2026-09-04'), cafe('2026-09-05'), cafe('2026-09-06')], HOY)
    expect(r[0].veces).toBe(3)
  })

  it('agrupa sin distinguir mayúsculas ni acentos y no mezcla categorías', () => {
    const movs = [
      mov({ nota: 'cafe', fecha: '2026-09-01' }),
      mov({ nota: 'CAFÉ', fecha: '2026-09-02' }),
      mov({ nota: 'Café', fecha: '2026-09-03', categoriaId: 'ocio' }),
    ]
    expect(detectarFrecuentes(movs, HOY)).toEqual([])
  })

  it('usa el importe más repetido y, a igualdad, el más reciente', () => {
    const movs = [cafe('2026-09-01', 150), cafe('2026-09-02', 150), cafe('2026-09-03', 200)]
    expect(detectarFrecuentes(movs, HOY)[0].importe).toBe(150)
    const empate = [cafe('2026-09-01', 150), cafe('2026-09-02', 200), cafe('2026-09-03', 250)]
    expect(detectarFrecuentes(empate, HOY)[0].importe).toBe(250)
  })

  it('ordena por número de veces y limita a 6', () => {
    const movs: Movimiento[] = []
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 3 + i; j++) movs.push(mov({ nota: `Gasto ${i}`, fecha: '2026-09-05' }))
    }
    const r = detectarFrecuentes(movs, HOY)
    expect(r).toHaveLength(6)
    expect(r[0].nota).toBe('Gasto 7')
    expect(r[0].veces).toBe(10)
  })
})

describe('ordenarPorUso', () => {
  const cats = [{ id: 'comida' }, { id: 'ocio' }, { id: 'salud' }]

  it('pone primero las más usadas en 90 días y respeta el orden en los empates', () => {
    const movs = [mov({ categoriaId: 'salud' }), mov({ categoriaId: 'salud' }), mov({ categoriaId: 'ocio' })]
    expect(ordenarPorUso(cats, movs, HOY).map((c) => c.id)).toEqual(['salud', 'ocio', 'comida'])
    expect(ordenarPorUso(cats, [], HOY).map((c) => c.id)).toEqual(['comida', 'ocio', 'salud'])
  })

  it('no cuenta lo anterior a 90 días', () => {
    const movs = [mov({ categoriaId: 'salud', fecha: '2026-01-01' })]
    expect(ordenarPorUso(cats, movs, HOY).map((c) => c.id)).toEqual(['comida', 'ocio', 'salud'])
  })
})

describe('sugerirCategoria', () => {
  it('propone la categoría más habitual del concepto', () => {
    const movs = [
      mov({ nota: 'Mercadona', categoriaId: 'comida' }),
      mov({ nota: 'mercadona', categoriaId: 'comida' }),
      mov({ nota: 'Mercadona', categoriaId: 'casa' }),
    ]
    expect(sugerirCategoria('MERCADONA', movs, 'gasto')).toBe('comida')
  })

  it('null si no hay coincidencias o el concepto está vacío', () => {
    expect(sugerirCategoria('Nada', [mov({ nota: 'Otra cosa' })], 'gasto')).toBeNull()
    expect(sugerirCategoria('  ', [mov({ nota: 'x' })], 'gasto')).toBeNull()
  })

  it('las devoluciones comparten las categorías de gasto; los ingresos no', () => {
    const movs = [mov({ nota: 'Bizum', tipo: 'ingreso', categoriaId: 'otros-ingresos' })]
    expect(sugerirCategoria('Bizum', movs, 'gasto')).toBeNull()
    expect(sugerirCategoria('Bizum', movs, 'ingreso')).toBe('otros-ingresos')
    const dev = [mov({ nota: 'Amazon', tipo: 'devolucion', categoriaId: 'compras' })]
    expect(sugerirCategoria('Amazon', dev, 'gasto')).toBe('compras')
  })
})

describe('sugerirConceptos', () => {
  const movs = [
    mov({ nota: 'Café con leche', fecha: '2026-09-01' }),
    mov({ nota: 'Café con leche', fecha: '2026-09-02' }),
    mov({ nota: 'Descafeinado', fecha: '2026-09-03' }),
    mov({ nota: 'Cena', fecha: '2026-09-04' }),
  ]

  it('primero los que empiezan por lo escrito, luego los que lo contienen', () => {
    expect(sugerirConceptos('caf', movs, 'gasto')).toEqual(['Café con leche', 'Descafeinado'])
  })

  it('no repite lo ya escrito por completo ni sugiere con texto vacío', () => {
    expect(sugerirConceptos('café con leche', movs, 'gasto')).toEqual([])
    expect(sugerirConceptos('', movs, 'gasto')).toEqual([])
  })

  it('no sugiere el concepto de las entradas de grupos', () => {
    const conGrupo = [...movs, mov({ nota: 'Cafés y pintxos', grupoId: 'g1' })]
    expect(sugerirConceptos('caf', conGrupo, 'gasto')).toEqual(['Café con leche', 'Descafeinado'])
  })

  it('respeta el máximo', () => {
    const muchos = Array.from({ length: 10 }, (_, i) => mov({ nota: `Comida ${i}` }))
    expect(sugerirConceptos('comida', muchos, 'gasto', 3)).toHaveLength(3)
  })
})

describe('ultimaCuentaUsada', () => {
  it('es la del movimiento más reciente', () => {
    const movs = [
      mov({ fecha: '2026-09-01', cuentaId: 'a' }),
      mov({ fecha: '2026-09-20', cuentaId: 'b' }),
      mov({ fecha: '2026-09-10', cuentaId: 'c' }),
    ]
    expect(ultimaCuentaUsada(movs)).toBe('b')
    expect(ultimaCuentaUsada([])).toBeNull()
  })
})

describe('agruparPorDia', () => {
  const movs = [
    mov({ fecha: '2026-09-10', importe: 1000, tipo: 'gasto' }),
    mov({ fecha: '2026-09-12', importe: 500, tipo: 'gasto' }),
    mov({ fecha: '2026-09-10', importe: 300, tipo: 'devolucion' }),
    mov({ fecha: '2026-09-10', importe: 99999, tipo: 'ingreso', categoriaId: 'nomina' }),
    mov({ fecha: '2026-09-10', importe: 5000, tipo: 'traspaso', categoriaId: null, cuentaDestinoId: 'c2' }),
  ]

  it('ordena los días del más reciente al más antiguo', () => {
    expect(agruparPorDia(movs).map((g) => g.fecha)).toEqual(['2026-09-12', '2026-09-10'])
  })

  it('el total del día es gasto neto: sin ingresos ni traspasos y restando devoluciones', () => {
    expect(agruparPorDia(movs)[1].gastoNeto).toBe(700)
    expect(agruparPorDia(movs)[0].gastoNeto).toBe(500)
  })

  it('lista vacía', () => {
    expect(agruparPorDia([])).toEqual([])
  })
})

describe('filtrarMovimientos', () => {
  const movs = [
    mov({ nota: 'Café', cuentaId: 'a', categoriaId: 'comida' }),
    mov({ nota: 'Cine', descripcion: 'Estreno con Ana', cuentaId: 'b', categoriaId: 'ocio' }),
    mov({ nota: 'Ahorro', tipo: 'traspaso', cuentaId: 'a', cuentaDestinoId: 'b', categoriaId: null }),
  ]

  it('por cuenta incluye traspasos entrantes y salientes', () => {
    expect(filtrarMovimientos(movs, { cuentaId: 'b' })).toHaveLength(2)
    expect(filtrarMovimientos(movs, { cuentaId: 'a' })).toHaveLength(2)
  })

  it('por categoría, tipo y texto sin acentos ni mayúsculas', () => {
    expect(filtrarMovimientos(movs, { categoriaId: 'ocio' })).toHaveLength(1)
    expect(filtrarMovimientos(movs, { tipo: 'traspaso' })).toHaveLength(1)
    expect(filtrarMovimientos(movs, { texto: 'CAFE' })).toHaveLength(1)
    expect(filtrarMovimientos(movs, { texto: 'estreno' })).toHaveLength(1)
  })

  it('combina filtros y sin filtros devuelve todo', () => {
    expect(filtrarMovimientos(movs, { cuentaId: 'a', tipo: 'gasto' })).toHaveLength(1)
    expect(filtrarMovimientos(movs, {})).toHaveLength(3)
  })
})
