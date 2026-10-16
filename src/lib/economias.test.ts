import { describe, expect, it } from 'vitest'
import type { ActualizacionSaldo, DeEconomia, Economia, Fijo, Movimiento, OtroSaldo, TraspasoEconomias } from '../data/types'
import {
  economiaInicial,
  esTraspasoAOtraEconomia,
  mitadesDeTraspaso,
  patrimonioPorEconomia,
  siguienteOrdenEconomia,
  traspasoDeMitades,
  traspasoDePago,
  validarEconomia,
  validarTraspasoEconomias,
} from './economias'

const eco = (id: string, nombre = id, orden = 0): Economia => ({ id, nombre, color: '#12B886', orden, propia: true })

const traspaso: TraspasoEconomias = {
  importe: 60000,
  fecha: '2026-10-01',
  hora: '09:00',
  nota: 'Aportación',
  descripcion: 'Octubre',
  origen: { economiaId: 'personal', cuentaId: 'c-nomina', categoriaId: 'cat-aportacion' },
  destino: { economiaId: 'casa', cuentaId: 'c-comun', categoriaId: 'cat-aportaciones' },
  fijoId: 'f-aporta',
  fijoMes: '2026-10-01',
}

function fijo(cambios: Partial<Fijo> = {}): Fijo {
  return {
    id: 'f-aporta',
    nombre: 'Aportación Casa',
    descripcion: 'Mi parte',
    tipo: 'gasto',
    importe: 60000,
    cuentaId: 'c-nomina',
    cuentaDestinoId: 'c-comun',
    categoriaId: 'cat-aportacion',
    categoriaDestinoId: 'cat-aportaciones',
    diaMes: 1,
    cadaMeses: 1,
    desde: '2026-01-01',
    hasta: null,
    activo: true,
    ...cambios,
  }
}

describe('economiaInicial', () => {
  const lista = [eco('a'), eco('b')]
  it('usa la guardada si sigue existiendo', () => expect(economiaInicial(lista, 'b')).toBe('b'))
  it('si no, la primera', () => expect(economiaInicial(lista, 'borrada')).toBe('a'))
  it('sin economías, ninguna', () => expect(economiaInicial([], 'a')).toBeNull())
})

describe('validarEconomia', () => {
  const lista = [eco('a', 'Personal'), eco('b', 'Casa', 1)]
  it('exige nombre', () => expect(validarEconomia('  ', lista)).toMatch(/nombre/))
  it('no repite nombres, sin distinguir mayúsculas', () => expect(validarEconomia(' casa ', lista)).toMatch(/Ya tienes/))
  it('al editar, su propio nombre vale', () => expect(validarEconomia('Casa', lista, 'b')).toBeNull())
  it('siguiente orden', () => expect(siguienteOrdenEconomia(lista)).toBe(2))
})

describe('mitadesDeTraspaso', () => {
  const { origen, destino } = mitadesDeTraspaso(traspaso, 't1')

  it('el origen es un gasto con la categoría de gasto y el fijo', () => {
    expect(origen).toMatchObject({
      tipo: 'gasto',
      cuentaId: 'c-nomina',
      categoriaId: 'cat-aportacion',
      fijoId: 'f-aporta',
      fijoMes: '2026-10-01',
      traspasoId: 't1',
      cuentaDestinoId: null,
    })
  })

  it('el destino es un ingreso sin fijo', () => {
    expect(destino).toMatchObject({
      tipo: 'ingreso',
      cuentaId: 'c-comun',
      categoriaId: 'cat-aportaciones',
      fijoId: null,
      fijoMes: null,
      mesImputado: null,
      traspasoId: 't1',
    })
  })

  it('comparten importe, fecha, hora, concepto y descripción', () => {
    for (const m of [origen, destino]) {
      expect(m).toMatchObject({ importe: 60000, fecha: '2026-10-01', hora: '09:00', nota: 'Aportación', descripcion: 'Octubre' })
    }
  })
})

describe('traspasoDeMitades', () => {
  const { origen, destino } = mitadesDeTraspaso(traspaso, 't1')
  const o: DeEconomia<Movimiento> = { ...origen, id: 'm1', economiaId: 'personal' }
  const d: DeEconomia<Movimiento> = { ...destino, id: 'm2', economiaId: 'casa' }

  it('reconstruye el traspaso en cualquier orden', () => {
    expect(traspasoDeMitades(o, d)).toEqual(traspaso)
    expect(traspasoDeMitades(d, o)).toEqual(traspaso)
  })

  it('sin gasto o sin ingreso, null', () => expect(traspasoDeMitades(o, o)).toBeNull())
})

describe('validarTraspasoEconomias', () => {
  it('un traspaso completo es válido', () => expect(validarTraspasoEconomias(traspaso)).toBeNull())
  it('importe positivo', () => expect(validarTraspasoEconomias({ ...traspaso, importe: 0 })).toMatch(/importe/))
  it('economías distintas', () =>
    expect(validarTraspasoEconomias({ ...traspaso, destino: { ...traspaso.destino, economiaId: 'personal' } })).toMatch(
      /misma economía/,
    ))
  it('categoría de gasto en el origen', () =>
    expect(validarTraspasoEconomias({ ...traspaso, origen: { ...traspaso.origen, categoriaId: '' } })).toMatch(/gasto/))
  it('categoría de ingreso en el destino', () =>
    expect(validarTraspasoEconomias({ ...traspaso, destino: { ...traspaso.destino, categoriaId: '' } })).toMatch(
      /ingreso/,
    ))
})

describe('fijos que son traspasos a otra economía', () => {
  it('se reconocen: gasto con cuenta de destino', () => {
    expect(esTraspasoAOtraEconomia(fijo())).toBe(true)
    expect(esTraspasoAOtraEconomia(fijo({ cuentaDestinoId: null }))).toBe(false)
    expect(esTraspasoAOtraEconomia(fijo({ tipo: 'traspaso' }))).toBe(false)
  })

  it('al marcarlo como hecho, sale el traspaso con los datos reales', () => {
    const t = traspasoDePago(fijo(), '2026-10-01', { fecha: '2026-10-02', importe: 65000, cuentaId: 'c-otra' }, 'personal', 'casa')
    expect(t).toEqual({
      importe: 65000,
      fecha: '2026-10-02',
      hora: null,
      nota: 'Aportación Casa',
      descripcion: 'Mi parte',
      origen: { economiaId: 'personal', cuentaId: 'c-otra', categoriaId: 'cat-aportacion' },
      destino: { economiaId: 'casa', cuentaId: 'c-comun', categoriaId: 'cat-aportaciones' },
      fijoId: 'f-aporta',
      fijoMes: '2026-10-01',
    })
    expect(validarTraspasoEconomias(t)).toBeNull()
  })
})

describe('patrimonioPorEconomia', () => {
  const economias = [eco('personal', 'Personal'), eco('casa', 'Casa', 1)]
  const saldos = [
    { cuentaId: 'c1', saldo: 100000, economiaId: 'personal' },
    { cuentaId: 'c2', saldo: 25000, economiaId: 'personal' },
    { cuentaId: 'c3', saldo: 50000, economiaId: 'casa' },
  ]
  const otro = (id: string, economiaId: string, archivado = false): DeEconomia<OtroSaldo> => ({
    id,
    nombre: id,
    color: '#000',
    icono: null,
    orden: 0,
    archivado,
    economiaId,
  })
  const historial: ActualizacionSaldo[] = [
    { id: 'h1', otroSaldoId: 'fondo', saldo: 300000, fechaHora: '2026-10-01T10:00:00.000Z' },
    { id: 'h2', otroSaldoId: 'viejo', saldo: 9999, fechaHora: '2026-10-01T10:00:00.000Z' },
  ]

  it('suma cuentas y otros saldos activos de cada economía', () => {
    const r = patrimonioPorEconomia(economias, saldos, [otro('fondo', 'personal'), otro('viejo', 'casa', true)], historial)
    expect(r.economias.map((e) => [e.economia.id, e.total])).toEqual([
      ['personal', 425000],
      ['casa', 50000],
    ])
    expect(r.total).toBe(475000)
  })
})
