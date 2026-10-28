import { describe, expect, it } from 'vitest'
import type { CopiaSeguridad, Economia, EconomiaEnCopia, Fijo, Movimiento } from '../data/types'
import { crearCopia, leerCopia, nombreArchivoCopia, prepararRestauracion, resumenCopia } from './copia'

function mov(p: Partial<Movimiento>): Movimiento {
  return {
    id: 'm',
    tipo: 'gasto',
    importe: 1000,
    fecha: '2026-10-01',
    cuentaId: 'c-p',
    cuentaDestinoId: null,
    categoriaId: 'cat-p',
    nota: '',
    descripcion: '',
    fijoId: null,
    fijoMes: null,
    mesImputado: null,
    grupoId: null,
    hora: null,
    traspasoId: null,
    ...p,
  }
}

function fijo(p: Partial<Fijo>): Fijo {
  return {
    id: 'f',
    nombre: 'Fijo',
    descripcion: '',
    tipo: 'gasto',
    importe: 1000,
    cuentaId: 'c-p',
    cuentaDestinoId: null,
    categoriaId: 'cat-p',
    categoriaDestinoId: null,
    diaMes: 1,
    cadaMeses: 1,
    desde: '2026-01-01',
    hasta: null,
    activo: true,
    ...p,
  }
}

function economia(id: string, nombre: string, p: Partial<EconomiaEnCopia> = {}): EconomiaEnCopia {
  return {
    economia: { id, nombre, color: '#12B886', orden: 0 },
    ajustes: { ahorroTipo: null, ahorroValor: null },
    cuentas: [],
    categorias: [],
    presupuestos: [],
    fijos: [],
    omitidos: [],
    fechas: [],
    movimientos: [],
    grupos: [],
    otrosSaldos: [],
    historial: [],
    ...p,
  }
}

const cuenta = (id: string) => ({ id, nombre: id, tipo: 'corriente' as const, saldoInicial: 0, color: '#000', orden: 0, archivada: false })
const categoria = (id: string, tipo: 'gasto' | 'ingreso' = 'gasto') => ({
  id,
  nombre: id,
  tipo,
  color: '#000',
  icono: null,
  orden: 0,
  archivada: false,
})

const personal = economia('e-p', 'Personal', {
  cuentas: [cuenta('c-p')],
  categorias: [categoria('cat-p')],
  grupos: [{ id: 'g', nombre: 'Cafés', categoriaId: 'cat-p', orden: 0, archivado: false }],
  otrosSaldos: [{ id: 'o', nombre: 'Fondo', color: '#000', icono: null, orden: 0, archivado: false }],
  historial: [{ id: 'h', otroSaldoId: 'o', saldo: 500, fechaHora: '2026-10-01T10:00:00.000Z' }],
  presupuestos: [
    { id: 'p1', mes: '2026-10-01', categoriaId: null, importe: 100000 },
    { id: 'p2', mes: '2026-10-01', categoriaId: 'cat-p', importe: 20000 },
  ],
  fijos: [
    fijo({ id: 'f-aporta', cuentaDestinoId: 'c-c', categoriaDestinoId: 'cat-c' }),
    fijo({ id: 'f-fuera', cuentaDestinoId: 'c-otra', categoriaDestinoId: 'cat-otra' }),
  ],
  omitidos: [{ fijoId: 'f-aporta', mes: '2026-11-01' }],
  fechas: [{ fijoId: 'f-aporta', mes: '2026-12-01', fecha: '2026-12-03' }],
  movimientos: [
    mov({ id: 'm1', grupoId: 'g' }),
    mov({ id: 'm2', traspasoId: 't-dentro', fijoId: 'f-aporta', fijoMes: '2026-10-01' }),
    mov({ id: 'm3', traspasoId: 't-fuera' }),
  ],
})
const casa = economia('e-c', 'Casa', {
  cuentas: [cuenta('c-c')],
  categorias: [categoria('cat-c', 'ingreso')],
  movimientos: [mov({ id: 'm4', tipo: 'ingreso', cuentaId: 'c-c', categoriaId: 'cat-c', traspasoId: 't-dentro' })],
})
const copia: CopiaSeguridad = crearCopia([personal, casa], '1.7.0', '2026-10-28T09:00:00.000Z')

const existente: Economia = { id: 'e-x', nombre: 'Casa', color: '#000', orden: 3, propia: true }

function preparar() {
  let n = 0
  return prepararRestauracion(copia, [existente], () => `n${++n}`)
}

describe('crear y leer la copia', () => {
  it('nombre del archivo con la fecha', () => expect(nombreArchivoCopia('2026-10-28')).toBe('txobank-copia-2026-10-28.json'))

  it('ida y vuelta por JSON', () => {
    const leida = leerCopia(JSON.stringify(copia))
    expect(leida).toEqual(copia)
    expect(resumenCopia(leida)).toEqual({
      creada: '2026-10-28T09:00:00.000Z',
      economias: [
        { nombre: 'Personal', cuentas: 1, movimientos: 3, fijos: 2 },
        { nombre: 'Casa', cuentas: 1, movimientos: 1, fijos: 0 },
      ],
      movimientos: 4,
    })
  })

  it('rechaza lo que no es una copia válida', () => {
    expect(() => leerCopia('no es json')).toThrow(/no es una copia/)
    expect(() => leerCopia('{"formato":"otra"}')).toThrow(/no es una copia/)
    expect(() => leerCopia(JSON.stringify({ ...copia, version: 9 }))).toThrow(/versión/)
    expect(() => leerCopia(JSON.stringify({ ...copia, economias: [] }))).toThrow(/ninguna economía/)
    const rota = { ...copia, economias: [{ ...personal, movimientos: undefined }] }
    expect(() => leerCopia(JSON.stringify(rota))).toThrow(/dañada/)
  })
})

describe('prepararRestauracion', () => {
  const [p, c] = preparar()

  it('todo lleva ids nuevos', () => {
    const viejos = new Set(['e-p', 'e-c', 'c-p', 'c-c', 'cat-p', 'cat-c', 'g', 'o', 'h', 'f-aporta', 'm1', 'm2', 'm3', 'm4', 'p1', 'p2'])
    const todos = [
      p.economia.id,
      c.economia.id,
      ...[p, c].flatMap((e) => [
        ...e.cuentas,
        ...e.categorias,
        ...e.grupos,
        ...e.otrosSaldos,
        ...e.historial,
        ...e.fijos,
        ...e.movimientos,
        ...e.presupuestos,
      ].map((x) => x.id)),
    ]
    expect(todos.some((id) => viejos.has(id))).toBe(false)
    expect(new Set(todos).size).toBe(todos.length)
  })

  it('renombra si el nombre ya existe y las pone al final', () => {
    expect([p.economia.nombre, c.economia.nombre]).toEqual(['Personal', 'Casa (restaurada)'])
    expect([p.economia.orden, c.economia.orden]).toEqual([4, 5])
  })

  it('mantiene las referencias dentro de la copia', () => {
    const cuentaP = p.cuentas[0].id
    const catP = p.categorias[0].id
    expect(p.grupos[0].categoriaId).toBe(catP)
    expect(p.historial[0].otroSaldoId).toBe(p.otrosSaldos[0].id)
    expect(p.presupuestos.map((x) => x.categoriaId)).toEqual([null, catP])
    const m1 = p.movimientos[0]
    expect([m1.cuentaId, m1.categoriaId, m1.grupoId]).toEqual([cuentaP, catP, p.grupos[0].id])
    const aporta = p.fijos[0]
    expect([aporta.cuentaDestinoId, aporta.categoriaDestinoId]).toEqual([c.cuentas[0].id, c.categorias[0].id])
    expect(p.omitidos[0].fijoId).toBe(aporta.id)
    expect(p.fechas[0].fijoId).toBe(aporta.id)
    expect(p.movimientos[1].fijoId).toBe(aporta.id)
  })

  it('las dos mitades de un traspaso comparten un id nuevo; una mitad sola se suelta', () => {
    const t = p.movimientos[1].traspasoId
    expect(t).not.toBeNull()
    expect(t).not.toBe('t-dentro')
    expect(c.movimientos[0].traspasoId).toBe(t)
    expect(p.movimientos[2].traspasoId).toBeNull()
  })

  it('un fijo que traspasa a una economía que no está en la copia pasa a ser un gasto normal', () => {
    expect(p.fijos[1]).toMatchObject({ tipo: 'gasto', cuentaDestinoId: null, categoriaDestinoId: null })
  })

  it('descarta lo que apunta a algo que no está en la copia', () => {
    const retocada = crearCopia(
      [
        economia('e', 'Sola', {
          cuentas: [cuenta('c')],
          movimientos: [mov({ id: 'bien', cuentaId: 'c', categoriaId: null }), mov({ id: 'mal', cuentaId: 'no-existe' })],
          historial: [{ id: 'h', otroSaldoId: 'no-existe', saldo: 1, fechaHora: '2026-10-01T00:00:00.000Z' }],
        }),
      ],
      '1.7.0',
      '2026-10-28T09:00:00.000Z',
    )
    const [r] = prepararRestauracion(retocada, [], () => crypto.randomUUID())
    expect(r.movimientos).toHaveLength(1)
    expect(r.historial).toHaveLength(0)
  })
})
