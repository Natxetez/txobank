// Adaptador en memoria con datos de ejemplo. Sirve para probar la interfaz sin base de datos:
// VITE_DATA_BACKEND=memoria. Los datos se pierden al recargar la página.
import { categoriasPorDefecto } from '../../lib/catalogo'
import { saldoHasta } from '../../lib/estadisticas'
import { diasDelMes, fechaEnMes, hoyISO, mesActual, sumarMeses } from '../../lib/meses'
import { ErrorSesion } from '../types'
import type {
  Ajustes,
  Categoria,
  Cuenta,
  DataSource,
  Fijo,
  FijoFecha,
  FijoOmitido,
  Movimiento,
  Presupuesto,
  Sesion,
} from '../types'

let contador = 0
const nuevoId = (prefijo: string) => `${prefijo}-${++contador}`

/** Generador pseudoaleatorio con semilla: los datos de ejemplo salen siempre iguales. */
function aleatorio(semilla: number) {
  let s = semilla
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function crearMemoriaDataSource(): DataSource {
  const hoy = hoyISO()
  const mes = mesActual()
  const azar = aleatorio(7)

  const cuentas: Cuenta[] = [
    { id: 'c-nomina', nombre: 'Cuenta nómina', tipo: 'corriente', saldoInicial: 120000, color: '#12B886', orden: 0, archivada: false },
    { id: 'c-ahorro', nombre: 'Ahorro', tipo: 'ahorro', saldoInicial: 500000, color: '#4C6EF5', orden: 1, archivada: false },
    { id: 'c-efectivo', nombre: 'Efectivo', tipo: 'efectivo', saldoInicial: 6000, color: '#F59F00', orden: 2, archivada: false },
  ]

  const categorias: Categoria[] = categoriasPorDefecto().map((c) => ({ ...c, id: `cat-${c.tipo}-${c.nombre.toLowerCase().replace(/\s+/g, '-')}` }))
  const cat = (nombre: string) => categorias.find((c) => c.nombre === nombre)!.id

  const fijos: Fijo[] = [
    { id: 'f-alquiler', nombre: 'Alquiler', descripcion: 'Transferencia al casero', tipo: 'gasto', importe: 60000, cuentaId: 'c-nomina', cuentaDestinoId: null, categoriaId: cat('Casa'), diaMes: 5, cadaMeses: 1, desde: sumarMeses(mes, -6), hasta: null, activo: true },
    { id: 'f-luz', nombre: 'Luz', descripcion: 'Iberdrola, tarifa fija', tipo: 'gasto', importe: 7000, cuentaId: 'c-nomina', cuentaDestinoId: null, categoriaId: cat('Casa'), diaMes: 15, cadaMeses: 1, desde: sumarMeses(mes, -6), hasta: null, activo: true },
    { id: 'f-netflix', nombre: 'Netflix', descripcion: '', tipo: 'gasto', importe: 1500, cuentaId: 'c-nomina', cuentaDestinoId: null, categoriaId: cat('Suscripciones'), diaMes: 10, cadaMeses: 1, desde: sumarMeses(mes, -6), hasta: null, activo: true },
    { id: 'f-seguro', nombre: 'Seguro del coche', descripcion: '', tipo: 'gasto', importe: 36000, cuentaId: 'c-nomina', cuentaDestinoId: null, categoriaId: cat('Transporte'), diaMes: 20, cadaMeses: 12, desde: sumarMeses(mes, -3), hasta: null, activo: true },
    { id: 'f-nomina', nombre: 'Nómina', descripcion: '', tipo: 'ingreso', importe: 200000, cuentaId: 'c-nomina', cuentaDestinoId: null, categoriaId: cat('Nómina'), diaMes: 27, cadaMeses: 1, desde: sumarMeses(mes, -6), hasta: null, activo: true },
    // Cargo puntual (periodicidad "Una vez"): desde = hasta.
    { id: 'f-itv', nombre: 'ITV', descripcion: 'Estación de Getafe, cita a las 9:30', tipo: 'gasto', importe: 4200, cuentaId: 'c-nomina', cuentaDestinoId: null, categoriaId: cat('Transporte'), diaMes: Math.min(28, Number(hoy.slice(8)) + 4), cadaMeses: 1, desde: mes, hasta: mes, activo: true },
  ]

  const movimientos: Movimiento[] = []
  const anadir = (m: Partial<Movimiento> & Pick<Movimiento, 'tipo' | 'importe' | 'fecha' | 'cuentaId'>) =>
    movimientos.push({
      id: nuevoId('m'),
      cuentaDestinoId: null,
      categoriaId: null,
      nota: '',
      descripcion: '',
      fijoId: null,
      fijoMes: null,
      mesImputado: null,
      ...m,
    })

  const omitidos: FijoOmitido[] = []
  const fechas: FijoFecha[] = []

  // Cuatro meses de historia y lo que va del mes actual.
  for (let i = 4; i >= 0; i--) {
    const m = sumarMeses(mes, -i)
    const ultimoDia = i === 0 ? Number(hoy.slice(8)) : diasDelMes(m)
    const f = (d: number) => fechaEnMes(m, d)

    if (i > 0 || Number(hoy.slice(8)) >= 27) {
      anadir({ tipo: 'ingreso', importe: 200000, fecha: f(27), cuentaId: 'c-nomina', categoriaId: cat('Nómina'), nota: 'Nómina', fijoId: 'f-nomina', fijoMes: m })
    }
    if (ultimoDia >= 5) anadir({ tipo: 'gasto', importe: 60000, fecha: f(5), cuentaId: 'c-nomina', categoriaId: cat('Casa'), nota: 'Alquiler', fijoId: 'f-alquiler', fijoMes: m })
    if (ultimoDia >= 10 && i > 0) anadir({ tipo: 'gasto', importe: 1500, fecha: f(10), cuentaId: 'c-nomina', categoriaId: cat('Suscripciones'), nota: 'Netflix', fijoId: 'f-netflix', fijoMes: m })
    if (ultimoDia >= 15 && i > 0) {
      const luz = 6200 + Math.round(azar() * 1600)
      anadir({ tipo: 'gasto', importe: luz, fecha: f(15), cuentaId: 'c-nomina', categoriaId: cat('Casa'), nota: 'Luz', fijoId: 'f-luz', fijoMes: m })
    }
    if (ultimoDia >= 3) anadir({ tipo: 'traspaso', importe: 20000, fecha: f(3), cuentaId: 'c-nomina', cuentaDestinoId: 'c-ahorro', nota: 'Ahorro del mes' })

    for (let d = 1; d <= ultimoDia; d++) {
      const r = azar()
      if (r < 0.55) anadir({ tipo: 'gasto', importe: 150, fecha: f(d), cuentaId: 'c-efectivo', categoriaId: cat('Comida'), nota: 'Café' })
      if (r > 0.35 && r < 0.6) anadir({ tipo: 'gasto', importe: 2500 + Math.round(azar() * 5000), fecha: f(d), cuentaId: 'c-nomina', categoriaId: cat('Comida'), nota: 'Mercadona' })
      if (r > 0.85) anadir({ tipo: 'gasto', importe: 1500 + Math.round(azar() * 3500), fecha: f(d), cuentaId: 'c-nomina', categoriaId: cat('Ocio'), nota: r > 0.93 ? 'Cine' : 'Cena' })
      if (r > 0.9 && r < 0.95) anadir({ tipo: 'gasto', importe: 800 + Math.round(azar() * 900), fecha: f(d), cuentaId: 'c-nomina', categoriaId: cat('Transporte'), nota: 'Gasolina' })
    }
    if (i === 2) anadir({ tipo: 'gasto', importe: 8900, fecha: f(12), cuentaId: 'c-nomina', categoriaId: cat('Salud'), nota: 'Dentista', descripcion: 'Limpieza y revisión anual' })
    if (i === 1) anadir({ tipo: 'devolucion', importe: 2000, fecha: f(18), cuentaId: 'c-nomina', categoriaId: cat('Compras'), nota: 'Devolución zapatillas' })
  }

  const presupuestos: Presupuesto[] = [
    { id: 'p1', mes: sumarMeses(mes, -4), categoriaId: null, importe: 150000 },
    { id: 'p2', mes: sumarMeses(mes, -4), categoriaId: cat('Comida'), importe: 25000 },
    { id: 'p3', mes: sumarMeses(mes, -4), categoriaId: cat('Ocio'), importe: 8000 },
  ]
  let ajustes: Ajustes = { ahorroTipo: 'importe', ahorroValor: 30000 }

  // Con ?vacio en la dirección se empieza sin datos, para probar el asistente de primera vez.
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('vacio')) {
    for (const lista of [cuentas, categorias, fijos, movimientos, presupuestos, omitidos, fechas] as unknown[][]) lista.length = 0
    ajustes = { ahorroTipo: null, ahorroValor: null }
  }

  let sesion: Sesion | null = null
  const oyentes = new Set<(s: Sesion | null) => void>()
  const emitir = () => oyentes.forEach((cb) => cb(sesion))

  const orden = (a: Movimiento, b: Movimiento) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)
  const parchear = <T extends { id: string }>(lista: T[], id: string, cambios: Partial<T>): T => {
    const i = lista.findIndex((x) => x.id === id)
    if (i === -1) throw new Error('No existe')
    lista[i] = { ...lista[i], ...cambios }
    return lista[i]
  }

  return {
    sesion: {
      async iniciar(email, password) {
        if (!email || !password) throw new ErrorSesion('credenciales', 'Usuario o contraseña incorrectos.')
        sesion = { userId: 'demo', email }
        emitir()
        return sesion
      },
      async cerrar() {
        sesion = null
        emitir()
      },
      async actual() {
        return sesion
      },
      alCambiar(cb) {
        oyentes.add(cb)
        return () => oyentes.delete(cb)
      },
    },
    ajustes: {
      async obtener() {
        return ajustes
      },
      async guardar(a) {
        ajustes = a
      },
    },
    cuentas: {
      async listar() {
        return [...cuentas].sort((a, b) => a.orden - b.orden)
      },
      async crear(c) {
        const nueva = { ...c, id: nuevoId('c') }
        cuentas.push(nueva)
        return nueva
      },
      async actualizar(id, cambios) {
        return parchear<Cuenta>(cuentas, id, cambios)
      },
    },
    categorias: {
      async listar() {
        return [...categorias].sort((a, b) => a.orden - b.orden)
      },
      async crear(c) {
        if (categorias.some((x) => x.tipo === c.tipo && x.nombre === c.nombre)) {
          throw new Error('Ya existe un elemento con ese nombre.')
        }
        const nueva = { ...c, id: nuevoId('cat') }
        categorias.push(nueva)
        return nueva
      },
      async crearVarias(cs) {
        return cs.map((c) => {
          const nueva = { ...c, id: nuevoId('cat') }
          categorias.push(nueva)
          return nueva
        })
      },
      async actualizar(id, cambios) {
        return parchear<Categoria>(categorias, id, cambios)
      },
      async reordenar(ids) {
        ids.forEach((id, i) => parchear<Categoria>(categorias, id, { orden: i }))
      },
    },
    movimientos: {
      async listar(desde, hasta) {
        return movimientos.filter((m) => m.fecha >= desde && m.fecha <= hasta).sort(orden)
      },
      async crear(m) {
        if (m.fijoId && movimientos.some((x) => x.fijoId === m.fijoId && x.fijoMes === m.fijoMes)) {
          throw new Error('Ya existe un elemento con ese nombre.')
        }
        const nuevo = { ...m, id: nuevoId('m') }
        movimientos.push(nuevo)
        return nuevo
      },
      async actualizar(id, cambios) {
        return parchear<Movimiento>(movimientos, id, cambios)
      },
      async borrar(id) {
        const i = movimientos.findIndex((m) => m.id === id)
        if (i !== -1) movimientos.splice(i, 1)
      },
      async listarPagosFijos(desde, hasta) {
        return movimientos.filter((m) => m.fijoId && m.fijoMes && m.fijoMes >= desde && m.fijoMes <= hasta)
      },
    },
    fijos: {
      async listar() {
        return [...fijos]
      },
      async crear(f) {
        const nuevo = { ...f, id: nuevoId('f') }
        fijos.push(nuevo)
        return nuevo
      },
      async actualizar(id, cambios) {
        return parchear<Fijo>(fijos, id, cambios)
      },
      async borrar(id) {
        const i = fijos.findIndex((f) => f.id === id)
        if (i !== -1) fijos.splice(i, 1)
        movimientos.forEach((m, k) => {
          if (m.fijoId === id) movimientos[k] = { ...m, fijoId: null }
        })
        for (let k = omitidos.length - 1; k >= 0; k--) if (omitidos[k].fijoId === id) omitidos.splice(k, 1)
        for (let k = fechas.length - 1; k >= 0; k--) if (fechas[k].fijoId === id) fechas.splice(k, 1)
      },
      async listarOmitidos() {
        return [...omitidos]
      },
      async omitir(fijoId, m) {
        if (!omitidos.some((o) => o.fijoId === fijoId && o.mes === m)) omitidos.push({ fijoId, mes: m })
      },
      async quitarOmision(fijoId, m) {
        const i = omitidos.findIndex((o) => o.fijoId === fijoId && o.mes === m)
        if (i !== -1) omitidos.splice(i, 1)
      },
      async listarFechas() {
        return [...fechas]
      },
      async fijarFecha(fijoId, m, fecha) {
        const i = fechas.findIndex((x) => x.fijoId === fijoId && x.mes === m)
        if (i === -1) fechas.push({ fijoId, mes: m, fecha })
        else fechas[i] = { fijoId, mes: m, fecha }
      },
      async quitarFecha(fijoId, m) {
        const i = fechas.findIndex((x) => x.fijoId === fijoId && x.mes === m)
        if (i !== -1) fechas.splice(i, 1)
      },
    },
    presupuestos: {
      async listar() {
        return [...presupuestos]
      },
      async guardar(m, categoriaId, importe) {
        const i = presupuestos.findIndex((p) => p.mes === m && p.categoriaId === categoriaId)
        if (i === -1) presupuestos.push({ id: nuevoId('p'), mes: m, categoriaId, importe })
        else presupuestos[i] = { ...presupuestos[i], importe }
      },
      async eliminarPosteriores(m, categoriaId) {
        for (let i = presupuestos.length - 1; i >= 0; i--) {
          if (presupuestos[i].categoriaId === categoriaId && presupuestos[i].mes > m) presupuestos.splice(i, 1)
        }
      },
    },
    saldos: {
      async listar() {
        return cuentas.map((c) => ({ cuentaId: c.id, saldo: saldoHasta(cuentas, movimientos, hoy, c.id) }))
      },
    },
  }
}
