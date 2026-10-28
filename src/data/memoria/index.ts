// Adaptador en memoria con datos de ejemplo. Sirve para probar la interfaz sin base de datos:
// VITE_DATA_BACKEND=memoria. Los datos se pierden al recargar la página.
import { categoriasPorDefecto } from '../../lib/catalogo'
import { mitadesDeTraspaso, traspasoDeMitades } from '../../lib/economias'
import { saldoHasta } from '../../lib/estadisticas'
import { diasDelMes, fechaEnMes, hoyISO, mesActual, sumarMeses } from '../../lib/meses'
import { ErrorDatos, ErrorSesion } from '../types'
import type {
  ActualizacionSaldo,
  Ajustes,
  Categoria,
  Cuenta,
  DataSource,
  DeEconomia,
  Economia,
  Fijo,
  FijoFecha,
  FijoOmitido,
  Grupo,
  Movimiento,
  NuevoMovimiento,
  OtroSaldo,
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

/** Todos los datos de una economía. */
interface Libro {
  cuentas: Cuenta[]
  categorias: Categoria[]
  fijos: Fijo[]
  grupos: Grupo[]
  movimientos: Movimiento[]
  omitidos: FijoOmitido[]
  fechas: FijoFecha[]
  presupuestos: Presupuesto[]
  ajustes: Ajustes
  otrosSaldos: OtroSaldo[]
  historial: ActualizacionSaldo[]
}

const libroVacio = (): Libro => ({
  cuentas: [],
  categorias: [],
  fijos: [],
  grupos: [],
  movimientos: [],
  omitidos: [],
  fechas: [],
  presupuestos: [],
  ajustes: { ahorroTipo: null, ahorroValor: null },
  otrosSaldos: [],
  historial: [],
})

const movimiento = (m: Partial<Movimiento> & Pick<Movimiento, 'tipo' | 'importe' | 'fecha' | 'cuentaId'>): Movimiento => ({
  id: nuevoId('m'),
  cuentaDestinoId: null,
  categoriaId: null,
  nota: '',
  descripcion: '',
  fijoId: null,
  fijoMes: null,
  mesImputado: null,
  grupoId: null,
  hora: null,
  traspasoId: null,
  ...m,
})

const categoriasDe = (prefijo: string, extra: Omit<Categoria, 'id'>[] = []): Categoria[] =>
  [...categoriasPorDefecto(), ...extra].map((c) => ({
    ...c,
    id: `${prefijo}-${c.tipo}-${c.nombre.toLowerCase().replace(/\s+/g, '-')}`,
  }))

export function crearMemoriaDataSource(): DataSource {
  const hoy = hoyISO()
  const mes = mesActual()
  const diaHoy = Number(hoy.slice(8))
  const azar = aleatorio(7)

  // --- Economía "Personal" -------------------------------------------------
  const personal = libroVacio()
  personal.cuentas.push(
    { id: 'c-nomina', nombre: 'Cuenta nómina', tipo: 'corriente', saldoInicial: 120000, color: '#12B886', orden: 0, archivada: false },
    { id: 'c-ahorro', nombre: 'Ahorro', tipo: 'ahorro', saldoInicial: 500000, color: '#4C6EF5', orden: 1, archivada: false },
    { id: 'c-efectivo', nombre: 'Efectivo', tipo: 'efectivo', saldoInicial: 6000, color: '#F59F00', orden: 2, archivada: false },
  )
  personal.categorias.push(...categoriasDe('cat'))
  const cat = (nombre: string) => personal.categorias.find((c) => c.nombre === nombre)!.id

  // --- Economía "Casa" (la cuenta común) -----------------------------------
  const casa = libroVacio()
  casa.cuentas.push(
    { id: 'c-comun', nombre: 'Cuenta común', tipo: 'corriente', saldoInicial: 80000, color: '#E64980', orden: 0, archivada: false },
  )
  casa.categorias.push(
    ...categoriasDe('casa', [{ nombre: 'Aportaciones', tipo: 'ingreso', color: '#7950F2', icono: '🤝', orden: 2, archivada: false }]),
  )
  const catCasa = (nombre: string) => casa.categorias.find((c) => c.nombre === nombre)!.id

  personal.fijos.push(
    // Traspaso a otra economía: un gasto en Personal que entra como ingreso en Casa.
    { id: 'f-aporta', nombre: 'Aportación a Casa', descripcion: 'Mi parte de los gastos comunes', tipo: 'gasto', importe: 60000, cuentaId: 'c-nomina', cuentaDestinoId: 'c-comun', categoriaId: cat('Casa'), categoriaDestinoId: catCasa('Aportaciones'), diaMes: 1, cadaMeses: 1, desde: sumarMeses(mes, -6), hasta: null, activo: true },
    { id: 'f-netflix', nombre: 'Netflix', descripcion: '', tipo: 'gasto', importe: 1500, cuentaId: 'c-nomina', cuentaDestinoId: null, categoriaId: cat('Suscripciones'), categoriaDestinoId: null, diaMes: 10, cadaMeses: 1, desde: sumarMeses(mes, -6), hasta: null, activo: true },
    { id: 'f-seguro', nombre: 'Seguro del coche', descripcion: '', tipo: 'gasto', importe: 36000, cuentaId: 'c-nomina', cuentaDestinoId: null, categoriaId: cat('Transporte'), categoriaDestinoId: null, diaMes: 20, cadaMeses: 12, desde: sumarMeses(mes, -3), hasta: null, activo: true },
    { id: 'f-nomina', nombre: 'Nómina', descripcion: '', tipo: 'ingreso', importe: 200000, cuentaId: 'c-nomina', cuentaDestinoId: null, categoriaId: cat('Nómina'), categoriaDestinoId: null, diaMes: 27, cadaMeses: 1, desde: sumarMeses(mes, -6), hasta: null, activo: true },
    // Cargo puntual (periodicidad "Una vez"): desde = hasta.
    { id: 'f-itv', nombre: 'ITV', descripcion: 'Estación de Getafe, cita a las 9:30', tipo: 'gasto', importe: 4200, cuentaId: 'c-nomina', cuentaDestinoId: null, categoriaId: cat('Transporte'), categoriaDestinoId: null, diaMes: Math.min(28, diaHoy + 4), cadaMeses: 1, desde: mes, hasta: mes, activo: true },
  )
  casa.fijos.push(
    { id: 'f-hipoteca', nombre: 'Hipoteca', descripcion: 'Recibo del banco', tipo: 'gasto', importe: 70000, cuentaId: 'c-comun', cuentaDestinoId: null, categoriaId: catCasa('Casa'), categoriaDestinoId: null, diaMes: 2, cadaMeses: 1, desde: sumarMeses(mes, -6), hasta: null, activo: true },
    { id: 'f-luz', nombre: 'Luz', descripcion: 'Iberdrola, tarifa fija', tipo: 'gasto', importe: 7000, cuentaId: 'c-comun', cuentaDestinoId: null, categoriaId: catCasa('Casa'), categoriaDestinoId: null, diaMes: 15, cadaMeses: 1, desde: sumarMeses(mes, -6), hasta: null, activo: true },
  )

  // Grupo de gastos de ejemplo: los cafés se apuntan en él.
  personal.grupos.push({ id: 'g-cafes', nombre: 'Cafés y pintxos', categoriaId: cat('Comida'), orden: 0, archivado: false })

  const anadir = (libro: Libro, m: Parameters<typeof movimiento>[0]) => libro.movimientos.push(movimiento(m))

  // Cuatro meses de historia y lo que va del mes actual.
  for (let i = 4; i >= 0; i--) {
    const m = sumarMeses(mes, -i)
    const ultimoDia = i === 0 ? diaHoy : diasDelMes(m)
    const f = (d: number) => fechaEnMes(m, d)

    if (i > 0 || diaHoy >= 27) {
      anadir(personal, { tipo: 'ingreso', importe: 200000, fecha: f(27), cuentaId: 'c-nomina', categoriaId: cat('Nómina'), nota: 'Nómina', fijoId: 'f-nomina', fijoMes: m })
    }
    // La aportación: gasto en Personal e ingreso en Casa, enlazados.
    const { origen, destino } = mitadesDeTraspaso(
      {
        importe: 60000,
        fecha: f(1),
        hora: null,
        nota: 'Aportación a Casa',
        descripcion: '',
        origen: { economiaId: 'e-personal', cuentaId: 'c-nomina', categoriaId: cat('Casa') },
        destino: { economiaId: 'e-casa', cuentaId: 'c-comun', categoriaId: catCasa('Aportaciones') },
        fijoId: 'f-aporta',
        fijoMes: m,
      },
      nuevoId('t'),
    )
    personal.movimientos.push({ ...origen, id: nuevoId('m') })
    casa.movimientos.push({ ...destino, id: nuevoId('m') })

    // La otra parte de la casa aporta desde fuera de TxoBank: un ingreso normal.
    anadir(casa, { tipo: 'ingreso', importe: 80000, fecha: f(1), cuentaId: 'c-comun', categoriaId: catCasa('Aportaciones'), nota: 'Aportación de mi pareja' })
    if (ultimoDia >= 2) anadir(casa, { tipo: 'gasto', importe: 70000, fecha: f(2), cuentaId: 'c-comun', categoriaId: catCasa('Casa'), nota: 'Hipoteca', fijoId: 'f-hipoteca', fijoMes: m })
    if (ultimoDia >= 10 && i > 0) anadir(personal, { tipo: 'gasto', importe: 1500, fecha: f(10), cuentaId: 'c-nomina', categoriaId: cat('Suscripciones'), nota: 'Netflix', fijoId: 'f-netflix', fijoMes: m })
    if (ultimoDia >= 15 && i > 0) {
      const luz = 6200 + Math.round(azar() * 1600)
      anadir(casa, { tipo: 'gasto', importe: luz, fecha: f(15), cuentaId: 'c-comun', categoriaId: catCasa('Casa'), nota: 'Luz', fijoId: 'f-luz', fijoMes: m })
    }
    if (ultimoDia >= 3) anadir(personal, { tipo: 'traspaso', importe: 20000, fecha: f(3), cuentaId: 'c-nomina', cuentaDestinoId: 'c-ahorro', nota: 'Ahorro del mes' })

    for (let d = 1; d <= ultimoDia; d++) {
      const r = azar()
      if (r < 0.55) anadir(personal, { tipo: 'gasto', importe: 150, fecha: f(d), cuentaId: 'c-efectivo', categoriaId: cat('Comida'), nota: 'Cafés y pintxos', grupoId: 'g-cafes', hora: `0${8 + Math.floor(azar() * 2)}:${String(Math.floor(azar() * 60)).padStart(2, '0')}`, descripcion: r < 0.2 ? 'Con pintxo de tortilla' : '' })
      if (r > 0.35 && r < 0.6) anadir(casa, { tipo: 'gasto', importe: 2500 + Math.round(azar() * 5000), fecha: f(d), cuentaId: 'c-comun', categoriaId: catCasa('Comida'), nota: 'Mercadona' })
      if (r > 0.85) anadir(personal, { tipo: 'gasto', importe: 1500 + Math.round(azar() * 3500), fecha: f(d), cuentaId: 'c-nomina', categoriaId: cat('Ocio'), nota: r > 0.93 ? 'Cine' : 'Cena' })
      if (r > 0.9 && r < 0.95) anadir(personal, { tipo: 'gasto', importe: 800 + Math.round(azar() * 900), fecha: f(d), cuentaId: 'c-nomina', categoriaId: cat('Transporte'), nota: 'Gasolina' })
    }
    if (i === 2) anadir(personal, { tipo: 'gasto', importe: 8900, fecha: f(12), cuentaId: 'c-nomina', categoriaId: cat('Salud'), nota: 'Dentista', descripcion: 'Limpieza y revisión anual' })
    if (i === 1) anadir(personal, { tipo: 'devolucion', importe: 2000, fecha: f(18), cuentaId: 'c-nomina', categoriaId: cat('Compras'), nota: 'Devolución zapatillas' })
  }

  personal.presupuestos.push(
    { id: 'p1', mes: sumarMeses(mes, -4), categoriaId: null, importe: 150000 },
    { id: 'p2', mes: sumarMeses(mes, -4), categoriaId: cat('Comida'), importe: 8000 },
    { id: 'p3', mes: sumarMeses(mes, -4), categoriaId: cat('Ocio'), importe: 8000 },
  )
  personal.ajustes = { ahorroTipo: 'importe', ahorroValor: 30000 }
  casa.presupuestos.push(
    { id: 'p4', mes: sumarMeses(mes, -4), categoriaId: null, importe: 110000 },
    { id: 'p5', mes: sumarMeses(mes, -4), categoriaId: catCasa('Comida'), importe: 40000 },
  )

  // Otros saldos de ejemplo, con su historial de actualizaciones.
  personal.otrosSaldos.push(
    { id: 'o-revolut', nombre: 'Revolut', color: '#4C6EF5', icono: '💳', orden: 0, archivado: false },
    { id: 'o-fondo', nombre: 'Fondo indexado', color: '#7950F2', icono: '📈', orden: 1, archivado: false },
  )
  for (let i = 4; i >= 0; i--) {
    const dia = fechaEnMes(sumarMeses(mes, -i), 20)
    if (dia > hoy) continue
    personal.historial.push({ id: nuevoId('h'), otroSaldoId: 'o-fondo', saldo: 300000 + (4 - i) * 21000, fechaHora: `${dia}T18:30:00.000Z` })
  }
  personal.historial.push({ id: nuevoId('h'), otroSaldoId: 'o-revolut', saldo: 10000, fechaHora: `${fechaEnMes(mes, 1)}T10:15:00.000Z` })

  let economias: Economia[] = [
    { id: 'e-personal', nombre: 'Personal', color: '#12B886', orden: 0, propia: true },
    { id: 'e-casa', nombre: 'Casa', color: '#E64980', orden: 1, propia: true },
  ]
  const libros = new Map<string, Libro>([
    ['e-personal', personal],
    ['e-casa', casa],
  ])

  // Con ?vacio en la dirección se empieza sin datos, para probar la primera economía y el asistente.
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('vacio')) {
    economias = []
    libros.clear()
  }

  let activa: string | null = null
  /** Datos de la economía activa. */
  const L = (): Libro => {
    const libro = activa ? libros.get(activa) : undefined
    if (!libro) throw new ErrorDatos('No hay ninguna economía elegida.')
    return libro
  }
  const deTodas = <T>(lista: (l: Libro) => T[]): DeEconomia<T>[] =>
    [...libros.entries()].flatMap(([economiaId, l]) => lista(l).map((x) => ({ ...x, economiaId })))
  const mitades = (traspasoId: string) =>
    deTodas((l) => l.movimientos).filter((m) => m.traspasoId === traspasoId)

  let sesion: Sesion | null = null
  // Verificación en dos pasos simulada: el código válido es siempre 123456.
  const CODIGO_DEMO = '123456'
  let mfa: 'no' | 'pendiente' | 'activa' = 'no'
  const comprobarCodigo = (codigo: string) => {
    if (codigo !== CODIGO_DEMO) throw new ErrorSesion('codigo', 'Código incorrecto. En el modo de ejemplo es 123456.')
  }
  const oyentes = new Set<(s: Sesion | null) => void>()
  const emitir = () => oyentes.forEach((cb) => cb(sesion))

  const orden = (a: Movimiento, b: Movimiento) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)
  const parchear = <T extends { id: string }>(lista: T[], id: string, cambios: Partial<T>): T => {
    const i = lista.findIndex((x) => x.id === id)
    if (i === -1) throw new Error('No existe')
    lista[i] = { ...lista[i], ...cambios }
    return lista[i]
  }
  const quitar = <T>(lista: T[], cumple: (x: T) => boolean) => {
    for (let k = lista.length - 1; k >= 0; k--) if (cumple(lista[k])) lista.splice(k, 1)
  }
  const borrarEconomia = (id: string) => {
    const libro = libros.get(id)
    if (libro) {
      // Los fijos de otras economías que traspasan dinero a esta se quedan como gastos normales.
      const cuentas = new Set(libro.cuentas.map((c) => c.id))
      for (const otro of libros.values()) {
        otro.fijos.forEach((f, k) => {
          if (f.tipo === 'gasto' && f.cuentaDestinoId && cuentas.has(f.cuentaDestinoId)) {
            otro.fijos[k] = { ...f, cuentaDestinoId: null, categoriaDestinoId: null }
          }
        })
      }
    }
    libros.delete(id)
    economias = economias.filter((e) => e.id !== id)
    if (activa === id) activa = null
  }

  return {
    sesion: {
      async iniciar(email, password) {
        if (!email || !password) throw new ErrorSesion('credenciales', 'Usuario o contraseña incorrectos.')
        sesion = { userId: 'demo', email, faltaCodigo: mfa === 'activa' }
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
      async mfaActiva() {
        return mfa === 'activa'
      },
      async inscribirMfa() {
        mfa = 'pendiente'
        const secreto = 'JBSWY3DPEHPK3PXP'
        const uri = `otpauth://totp/TxoBank:demo?secret=${secreto}&issuer=TxoBank`
        const qr =
          'data:image/svg+xml;utf-8,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/><path d="M1 1h3v3H1zM6 1h3v3H6zM1 6h3v3H1zM6 6h1v1H6zM8 7h1v2H8zM6 8h1v1H6z" fill="#000"/></svg>',
          )
        return { factorId: 'factor-demo', qr, secreto, uri }
      },
      async confirmarMfa(_factorId, codigo) {
        comprobarCodigo(codigo)
        mfa = 'activa'
      },
      async verificarCodigo(codigo) {
        comprobarCodigo(codigo)
        if (sesion) sesion = { ...sesion, faltaCodigo: false }
        emitir()
      },
      async desactivarMfa() {
        mfa = 'no'
      },
    },
    economias: {
      async listar() {
        return [...economias].sort((a, b) => a.orden - b.orden)
      },
      async crear(e) {
        if (economias.some((x) => x.nombre === e.nombre)) throw new ErrorDatos('Ya existe un elemento con ese nombre.', 'duplicado')
        const nueva = { ...e, id: nuevoId('e'), propia: true }
        economias.push(nueva)
        libros.set(nueva.id, libroVacio())
        return nueva
      },
      async actualizar(id, cambios) {
        return parchear<Economia>(economias, id, cambios)
      },
      async borrar(id) {
        borrarEconomia(id)
      },
      activar(id) {
        activa = id
      },
      activa() {
        return activa
      },
      async cuentasDeTodas() {
        return deTodas((l) => l.cuentas).sort((a, b) => a.orden - b.orden)
      },
      async categoriasDeTodas() {
        return deTodas((l) => l.categorias).sort((a, b) => a.orden - b.orden)
      },
      async saldosDeTodas() {
        return deTodas((l) => l.cuentas.map((c) => ({ cuentaId: c.id, saldo: saldoHasta(l.cuentas, l.movimientos, hoy, c.id) })))
      },
      async otrosSaldosDeTodas() {
        return deTodas((l) => l.otrosSaldos)
      },
      async historialDeTodas() {
        return [...libros.values()].flatMap((l) => l.historial)
      },
      async movimientosDeTodas(hasta) {
        return [...libros.values()].flatMap((l) => l.movimientos.filter((m) => m.fecha <= hasta))
      },
    },
    ajustes: {
      async obtener() {
        return L().ajustes
      },
      async guardar(a) {
        L().ajustes = a
      },
    },
    cuentas: {
      async listar() {
        return [...L().cuentas].sort((a, b) => a.orden - b.orden)
      },
      async crear(c) {
        const nueva = { ...c, id: nuevoId('c') }
        L().cuentas.push(nueva)
        return nueva
      },
      async actualizar(id, cambios) {
        return parchear<Cuenta>(L().cuentas, id, cambios)
      },
    },
    categorias: {
      async listar() {
        return [...L().categorias].sort((a, b) => a.orden - b.orden)
      },
      async crear(c) {
        if (L().categorias.some((x) => x.tipo === c.tipo && x.nombre === c.nombre)) {
          throw new Error('Ya existe un elemento con ese nombre.')
        }
        const nueva = { ...c, id: nuevoId('cat') }
        L().categorias.push(nueva)
        return nueva
      },
      async crearVarias(cs) {
        return cs.map((c) => {
          const nueva = { ...c, id: nuevoId('cat') }
          L().categorias.push(nueva)
          return nueva
        })
      },
      async actualizar(id, cambios) {
        return parchear<Categoria>(L().categorias, id, cambios)
      },
      async reordenar(ids) {
        ids.forEach((id, i) => parchear<Categoria>(L().categorias, id, { orden: i }))
      },
    },
    movimientos: {
      async listar(desde, hasta) {
        return L().movimientos.filter((m) => m.fecha >= desde && m.fecha <= hasta).sort(orden)
      },
      async crear(m) {
        if (m.fijoId && L().movimientos.some((x) => x.fijoId === m.fijoId && x.fijoMes === m.fijoMes)) {
          throw new Error('Ya existe un elemento con ese nombre.')
        }
        const nuevo = { ...m, id: nuevoId('m') }
        L().movimientos.push(nuevo)
        return nuevo
      },
      async actualizar(id, cambios) {
        return parchear<Movimiento>(L().movimientos, id, cambios)
      },
      async borrar(id) {
        quitar(L().movimientos, (m) => m.id === id)
      },
      async actualizarEntradasGrupo(grupoId, cambios) {
        const movs = L().movimientos
        movs.forEach((m, k) => {
          if (m.grupoId === grupoId) movs[k] = { ...m, ...cambios }
        })
      },
      async listarPagosFijos(desde, hasta) {
        return L().movimientos.filter((m) => m.fijoId && m.fijoMes && m.fijoMes >= desde && m.fijoMes <= hasta)
      },
      async crearTraspasoEconomias(t) {
        const origen = libros.get(t.origen.economiaId)
        const destino = libros.get(t.destino.economiaId)
        if (!origen || !destino) throw new ErrorDatos('No existe alguna de las dos economías.')
        const { origen: salida, destino: entrada } = mitadesDeTraspaso(t, nuevoId('t'))
        const creados: [Libro, Movimiento][] = [
          [origen, { ...salida, id: nuevoId('m') }],
          [destino, { ...entrada, id: nuevoId('m') }],
        ]
        for (const [libro, m] of creados) libro.movimientos.push(m)
        return (creados.find(([libro]) => libro === libros.get(activa ?? '')) ?? creados[0])[1]
      },
      async obtenerTraspasoEconomias(traspasoId) {
        const [a, b] = mitades(traspasoId)
        return a && b ? traspasoDeMitades(a, b) : null
      },
      async actualizarTraspasoEconomias(traspasoId, t) {
        const { origen, destino } = mitadesDeTraspaso(t, traspasoId)
        for (const l of libros.values()) {
          l.movimientos.forEach((m, k) => {
            if (m.traspasoId !== traspasoId) return
            const cambios: NuevoMovimiento = m.tipo === 'gasto' ? origen : destino
            l.movimientos[k] = { ...cambios, id: m.id }
          })
        }
      },
      async borrarTraspasoEconomias(traspasoId) {
        for (const l of libros.values()) quitar(l.movimientos, (m) => m.traspasoId === traspasoId)
      },
    },
    fijos: {
      async listar() {
        return [...L().fijos]
      },
      async crear(f) {
        const nuevo = { ...f, id: nuevoId('f') }
        L().fijos.push(nuevo)
        return nuevo
      },
      async actualizar(id, cambios) {
        return parchear<Fijo>(L().fijos, id, cambios)
      },
      async borrar(id) {
        const l = L()
        quitar(l.fijos, (f) => f.id === id)
        l.movimientos.forEach((m, k) => {
          if (m.fijoId === id) l.movimientos[k] = { ...m, fijoId: null }
        })
        quitar(l.omitidos, (o) => o.fijoId === id)
        quitar(l.fechas, (x) => x.fijoId === id)
      },
      async listarOmitidos() {
        return [...L().omitidos]
      },
      async omitir(fijoId, m) {
        if (!L().omitidos.some((o) => o.fijoId === fijoId && o.mes === m)) L().omitidos.push({ fijoId, mes: m })
      },
      async quitarOmision(fijoId, m) {
        quitar(L().omitidos, (o) => o.fijoId === fijoId && o.mes === m)
      },
      async listarFechas() {
        return [...L().fechas]
      },
      async fijarFecha(fijoId, m, fecha) {
        const fechas = L().fechas
        const i = fechas.findIndex((x) => x.fijoId === fijoId && x.mes === m)
        if (i === -1) fechas.push({ fijoId, mes: m, fecha })
        else fechas[i] = { fijoId, mes: m, fecha }
      },
      async quitarFecha(fijoId, m) {
        quitar(L().fechas, (x) => x.fijoId === fijoId && x.mes === m)
      },
    },
    presupuestos: {
      async listar() {
        return [...L().presupuestos]
      },
      async guardar(m, categoriaId, importe) {
        const presupuestos = L().presupuestos
        const i = presupuestos.findIndex((p) => p.mes === m && p.categoriaId === categoriaId)
        if (i === -1) presupuestos.push({ id: nuevoId('p'), mes: m, categoriaId, importe })
        else presupuestos[i] = { ...presupuestos[i], importe }
      },
      async eliminarPosteriores(m, categoriaId) {
        quitar(L().presupuestos, (p) => p.categoriaId === categoriaId && p.mes > m)
      },
    },
    saldos: {
      async listar() {
        const { cuentas, movimientos } = L()
        return cuentas.map((c) => ({ cuentaId: c.id, saldo: saldoHasta(cuentas, movimientos, hoy, c.id) }))
      },
    },
    grupos: {
      async listar() {
        return [...L().grupos].sort((a, b) => a.orden - b.orden)
      },
      async crear(g) {
        if (L().grupos.some((x) => x.nombre === g.nombre)) throw new Error('Ya existe un elemento con ese nombre.')
        const nuevo = { ...g, id: nuevoId('g') }
        L().grupos.push(nuevo)
        return nuevo
      },
      async actualizar(id, cambios) {
        return parchear<Grupo>(L().grupos, id, cambios)
      },
      async borrar(id) {
        const l = L()
        quitar(l.grupos, (g) => g.id === id)
        l.movimientos.forEach((m, k) => {
          if (m.grupoId === id) l.movimientos[k] = { ...m, grupoId: null }
        })
      },
    },
    otrosSaldos: {
      async listar() {
        return [...L().otrosSaldos].sort((a, b) => a.orden - b.orden)
      },
      async crear(o) {
        const nuevo = { ...o, id: nuevoId('o') }
        L().otrosSaldos.push(nuevo)
        return nuevo
      },
      async actualizar(id, cambios) {
        return parchear<OtroSaldo>(L().otrosSaldos, id, cambios)
      },
      async borrar(id) {
        quitar(L().otrosSaldos, (o) => o.id === id)
        quitar(L().historial, (h) => h.otroSaldoId === id)
      },
      async listarHistorial() {
        return [...L().historial].sort((a, b) => (a.fechaHora < b.fechaHora ? -1 : a.fechaHora > b.fechaHora ? 1 : 0))
      },
      async registrarSaldo(otroSaldoId, saldo, fechaHora) {
        const nueva = { id: nuevoId('h'), otroSaldoId, saldo, fechaHora: fechaHora ?? new Date().toISOString() }
        L().historial.push(nueva)
        return nueva
      },
      async borrarActualizacion(id) {
        quitar(L().historial, (h) => h.id === id)
      },
    },
    copia: {
      async exportar() {
        return [...economias]
          .sort((a, b) => a.orden - b.orden)
          .map((e) => {
            const l = libros.get(e.id) ?? libroVacio()
            return {
              economia: { id: e.id, nombre: e.nombre, color: e.color, orden: e.orden },
              ajustes: { ...l.ajustes },
              cuentas: [...l.cuentas],
              categorias: [...l.categorias],
              presupuestos: [...l.presupuestos],
              fijos: [...l.fijos],
              omitidos: [...l.omitidos],
              fechas: [...l.fechas],
              movimientos: [...l.movimientos],
              grupos: [...l.grupos],
              otrosSaldos: [...l.otrosSaldos],
              historial: [...l.historial],
            }
          })
      },
      async restaurar(nuevas) {
        for (const { economia: e, ...datos } of nuevas) {
          economias.push({ ...e, propia: true })
          libros.set(e.id, { ...datos, ajustes: { ...datos.ajustes } })
        }
      },
    },
  }
}
