import { describe, expect, it } from 'vitest'
import type { Categoria, Cuenta, Fijo, Grupo, Movimiento } from '../data/types'
import { CABECERA_CSV, campoCsv, conBom, importeCsv, movimientosACsv } from './csv'

const cuentas = [
  { id: 'c1', nombre: 'Nómina' },
  { id: 'c2', nombre: 'Ahorro' },
] as Cuenta[]
const categorias = [
  { id: 'comida', nombre: 'Comida' },
  { id: 'nomina', nombre: 'Nómina' },
] as Categoria[]
const fijos = [{ id: 'f1', nombre: 'Alquiler' }] as Fijo[]
const grupos = [{ id: 'g1', nombre: 'Cafés y pintxos' }] as Grupo[]

function mov(p: Partial<Movimiento>): Movimiento {
  return {
    id: 'm',
    tipo: 'gasto',
    importe: 1250,
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

describe('importeCsv', () => {
  it('decimales con coma y siempre dos cifras', () => {
    expect(importeCsv(1250)).toBe('12,50')
    expect(importeCsv(5)).toBe('0,05')
    expect(importeCsv(100000)).toBe('1000,00')
    expect(importeCsv(-525)).toBe('-5,25')
  })
})

describe('campoCsv', () => {
  it('entrecomilla lo que lleva ; comillas o saltos de línea', () => {
    expect(campoCsv('Café')).toBe('Café')
    expect(campoCsv('a;b')).toBe('"a;b"')
    expect(campoCsv('dijo "hola"')).toBe('"dijo ""hola"""')
    expect(campoCsv('línea\ncorte')).toBe('"línea\ncorte"')
  })
})

describe('movimientosACsv', () => {
  it('cabecera, orden por fecha y columnas', () => {
    const csv = movimientosACsv(
      [
        mov({ fecha: '2026-09-12', nota: 'Café; con leche' }),
        mov({ fecha: '2026-09-01', tipo: 'ingreso', importe: 200000, categoriaId: 'nomina', fecha_: undefined } as Partial<Movimiento>),
        mov({ fecha: '2026-09-05', tipo: 'traspaso', categoriaId: null, cuentaDestinoId: 'c2' }),
        mov({ fecha: '2026-09-06', fijoId: 'f1', fijoMes: '2026-09-01', nota: 'Alquiler', descripcion: 'Transferencia' }),
        mov({ fecha: '2026-08-29', tipo: 'ingreso', categoriaId: 'nomina', mesImputado: '2026-09-01' }),
      ],
      cuentas,
      categorias,
      fijos,
      grupos,
    )
    const lineas = csv.trimEnd().split('\r\n')
    expect(lineas[0]).toBe(CABECERA_CSV.join(';'))
    expect(lineas.map((l) => l.slice(0, 10)).slice(1)).toEqual(['2026-08-29', '2026-09-01', '2026-09-05', '2026-09-06', '2026-09-12'])
    expect(lineas[1]).toBe('2026-08-29;;ingreso;12,50;Nómina;;Nómina;;;;;2026-09')
    expect(lineas[3]).toBe('2026-09-05;;traspaso;12,50;Nómina;Ahorro;;;;;;')
    expect(lineas[4]).toBe('2026-09-06;;gasto;12,50;Nómina;;Comida;Alquiler;Transferencia;;Alquiler;')
    expect(lineas[5]).toBe('2026-09-12;;gasto;12,50;Nómina;;Comida;"Café; con leche";;;;')
  })

  it('hora después de la fecha y nombre del grupo después de la descripción', () => {
    expect(CABECERA_CSV.slice(0, 3)).toEqual(['fecha', 'hora', 'tipo'])
    expect(CABECERA_CSV[CABECERA_CSV.indexOf('descripcion') + 1]).toBe('grupo')
    const csv = movimientosACsv(
      [
        mov({ fecha: '2026-09-14', hora: '18:10', grupoId: 'g1', nota: 'Cafés y pintxos', importe: 220 }),
        mov({ fecha: '2026-09-14', hora: '09:35', grupoId: 'g1', nota: 'Cafés y pintxos', descripcion: 'Con Ane', importe: 150 }),
        mov({ fecha: '2026-09-14', nota: 'Pan' }),
      ],
      cuentas,
      categorias,
      fijos,
      grupos,
    )
    const lineas = csv.trimEnd().split('\r\n')
    expect(lineas.slice(1)).toEqual([
      '2026-09-14;;gasto;12,50;Nómina;;Comida;Pan;;;;',
      '2026-09-14;09:35;gasto;1,50;Nómina;;Comida;Cafés y pintxos;Con Ane;Cafés y pintxos;;',
      '2026-09-14;18:10;gasto;2,20;Nómina;;Comida;Cafés y pintxos;;Cafés y pintxos;;',
    ])
  })

  it('con BOM para Excel', () => {
    expect(conBom('x').charCodeAt(0)).toBe(0xfeff)
  })

  it('sin movimientos, solo la cabecera', () => {
    expect(movimientosACsv([], cuentas, categorias, fijos, grupos)).toBe(CABECERA_CSV.join(';') + '\r\n')
  })
})
