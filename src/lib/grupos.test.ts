import { describe, expect, it } from 'vitest'
import type { Categoria, Grupo, Movimiento } from '../data/types'
import {
  etiquetaEntrada,
  ordenarEntradas,
  ordenarGrupos,
  resumenGrupos,
  separarPorGrupo,
  siguienteOrdenGrupo,
  textoEntradas,
  validarGrupo,
} from './grupos'

let contador = 0
function mov(p: Partial<Movimiento>): Movimiento {
  contador += 1
  return {
    id: `m${contador}`,
    tipo: 'gasto',
    importe: 150,
    fecha: '2026-10-10',
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

const grupo = (p: Partial<Grupo>): Grupo => ({ id: 'g', nombre: 'Grupo', categoriaId: 'comida', orden: 0, archivado: false, ...p })

const cafes = grupo({ id: 'cafes', nombre: 'Cafés y pintxos', orden: 0 })
const taxis = grupo({ id: 'taxis', nombre: 'Taxis', categoriaId: 'transporte', orden: 1 })
const viejo = grupo({ id: 'viejo', nombre: 'Viejo', orden: 2, archivado: true })
const GRUPOS = [taxis, viejo, cafes]
const OCT = '2026-10-01'

describe('separarPorGrupo', () => {
  it('separa sueltos y entradas de grupos, solo del mes, respetando el orden', () => {
    const a = mov({ grupoId: 'cafes' })
    const b = mov({})
    const c = mov({ grupoId: 'taxis', fecha: '2026-10-02' })
    const fuera = mov({ grupoId: 'cafes', fecha: '2026-11-01' })
    const fueraSuelto = mov({ fecha: '2026-09-30' })
    const r = separarPorGrupo([a, b, fuera, c, fueraSuelto], GRUPOS, OCT)
    expect(r.agrupados).toEqual([a, c])
    expect(r.sueltos).toEqual([b])
  })

  it('un grupo desconocido o algo que no es gasto queda como suelto', () => {
    const desconocido = mov({ grupoId: 'borrado' })
    const ingreso = mov({ tipo: 'ingreso', grupoId: 'cafes' })
    const r = separarPorGrupo([desconocido, ingreso], GRUPOS, OCT)
    expect(r.agrupados).toEqual([])
    expect(r.sueltos).toEqual([desconocido, ingreso])
  })
})

describe('ordenarEntradas', () => {
  it('más reciente primero por fecha y hora; sin hora al final del día; empates en su orden', () => {
    const a = mov({ fecha: '2026-10-14', hora: '09:35' })
    const b = mov({ fecha: '2026-10-14', hora: '18:10' })
    const c = mov({ fecha: '2026-10-14', hora: null })
    const d = mov({ fecha: '2026-10-15', hora: '07:00' })
    const e = mov({ fecha: '2026-10-14', hora: '09:35' })
    expect(ordenarEntradas([a, b, c, d, e])).toEqual([d, b, a, e, c])
  })
})

describe('resumenGrupos', () => {
  const movs = [
    mov({ grupoId: 'cafes', importe: 150, fecha: '2026-10-03', hora: '09:00' }),
    mov({ grupoId: 'cafes', importe: 220, fecha: '2026-10-14', hora: '09:35' }),
    mov({ grupoId: 'viejo', importe: 500, fecha: '2026-10-05' }),
    mov({ grupoId: 'cafes', importe: 9900, fecha: '2026-09-28' }), // septiembre: no cuenta en octubre
    mov({ importe: 3000 }), // suelto
  ]

  it('total, número de entradas y entradas ordenadas, por meses', () => {
    const r = resumenGrupos(movs, GRUPOS, OCT)
    expect(r.map((x) => x.grupo.id)).toEqual(['cafes', 'viejo'])
    expect(r[0].total).toBe(370)
    expect(r[0].numEntradas).toBe(2)
    expect(r[0].entradas.map((m) => m.fecha)).toEqual(['2026-10-14', '2026-10-03'])

    const sep = resumenGrupos(movs, GRUPOS, '2026-09-01')
    expect(sep).toHaveLength(1)
    expect(sep[0].total).toBe(9900)
  })

  it('cada mes empieza de cero: sin entradas, el grupo no sale', () => {
    expect(resumenGrupos(movs, GRUPOS, '2026-11-01')).toEqual([])
  })

  it('un grupo archivado con entradas ese mes sigue apareciendo', () => {
    expect(resumenGrupos(movs, GRUPOS, OCT).find((x) => x.grupo.id === 'viejo')?.total).toBe(500)
  })

  it('con incluirVacios salen los activos sin entradas, pero no los archivados', () => {
    const r = resumenGrupos(movs, GRUPOS, '2026-11-01', { incluirVacios: true })
    expect(r.map((x) => [x.grupo.id, x.total, x.numEntradas])).toEqual([
      ['cafes', 0, 0],
      ['taxis', 0, 0],
    ])
  })
})

describe('utilidades', () => {
  it('ordena por orden y nombre, y calcula el orden siguiente', () => {
    const lista = [grupo({ nombre: 'Zumo', orden: 1 }), grupo({ nombre: 'Agua', orden: 1 }), grupo({ nombre: 'Café', orden: 0 })]
    expect(ordenarGrupos(lista).map((g) => g.nombre)).toEqual(['Café', 'Agua', 'Zumo'])
    expect(siguienteOrdenGrupo(lista)).toBe(2)
    expect(siguienteOrdenGrupo([])).toBe(0)
  })

  it('texto de entradas en singular y plural', () => {
    expect(textoEntradas(1)).toBe('1 entrada')
    expect(textoEntradas(0)).toBe('0 entradas')
    expect(textoEntradas(23)).toBe('23 entradas')
  })

  it('etiqueta de la entrada con día de la semana, día y hora', () => {
    expect(etiquetaEntrada({ fecha: '2026-10-13', hora: '09:35' })).toBe('mar 13 · 09:35')
    expect(etiquetaEntrada({ fecha: '2026-10-18', hora: null })).toBe('dom 18')
  })
})

describe('validarGrupo', () => {
  const categorias = [
    { id: 'comida', tipo: 'gasto' },
    { id: 'nomina', tipo: 'ingreso' },
  ] as Categoria[]

  it('acepta un grupo correcto', () => {
    expect(validarGrupo({ nombre: 'Taxis', categoriaId: 'comida' }, categorias, [cafes])).toBeNull()
  })

  it('exige nombre, no demasiado largo', () => {
    expect(validarGrupo({ nombre: '  ', categoriaId: 'comida' }, categorias, [])).toMatch(/nombre/)
    expect(validarGrupo({ nombre: 'x'.repeat(61), categoriaId: 'comida' }, categorias, [])).toMatch(/largo/)
  })

  it('nombre único sin distinguir mayúsculas ni acentos, salvo consigo mismo', () => {
    expect(validarGrupo({ nombre: 'cafes y PINTXOS ', categoriaId: 'comida' }, categorias, [cafes])).toMatch(/Ya tienes/)
    expect(validarGrupo({ nombre: 'Cafés y pintxos', categoriaId: 'comida' }, categorias, [cafes], 'cafes')).toBeNull()
  })

  it('exige una categoría de gasto existente', () => {
    expect(validarGrupo({ nombre: 'A', categoriaId: null }, categorias, [])).toMatch(/categoría/)
    expect(validarGrupo({ nombre: 'A', categoriaId: 'nada' }, categorias, [])).toMatch(/categoría/)
    expect(validarGrupo({ nombre: 'A', categoriaId: 'nomina' }, categorias, [])).toMatch(/gasto/)
  })
})
