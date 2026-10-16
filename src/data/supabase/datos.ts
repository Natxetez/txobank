import type { SupabaseClient } from '@supabase/supabase-js'
import { mitadesDeTraspaso, traspasoDeMitades } from '../../lib/economias'
import { ErrorDatos } from '../types'
import type {
  DeEconomia,
  Economia,
  EconomiasApi,
  NuevaEconomia,
  Ajustes,
  AjustesApi,
  CategoriasApi,
  Categoria,
  Cuenta,
  CuentasApi,
  Fijo,
  ActualizacionSaldo,
  FijoFecha,
  Grupo,
  GruposApi,
  MantenimientoApi,
  NuevoGrupo,
  NuevoOtroSaldo,
  OtroSaldo,
  OtrosSaldosApi,
  FijoOmitido,
  FijosApi,
  NuevoFijo,
  Presupuesto,
  Movimiento,
  MovimientosApi,
  NuevaCategoria,
  NuevaCuenta,
  NuevoMovimiento,
  PresupuestosApi,
  SaldosApi,
} from '../types'

interface ErrorPg {
  message: string
  code?: string
}

function comprobar(error: ErrorPg | null): void {
  if (!error) return
  switch (error.code) {
    case '23505':
      throw new ErrorDatos('Ya existe un elemento con ese nombre.', 'duplicado')
    case '42501':
      throw new ErrorDatos(
        'Sin permiso para acceder a los datos. Comprueba que has ejecutado las migraciones de supabase/migrations.',
        'permisos',
      )
    case '42P01':
    case 'PGRST205':
      throw new ErrorDatos(
        'Faltan tablas en la base de datos. Ejecuta las migraciones de supabase/migrations en el SQL Editor.',
        'sin-tablas',
      )
  }
  throw new ErrorDatos('No se ha podido completar la operación. Revisa tu conexión e inténtalo de nuevo.')
}

async function idUsuario(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new ErrorDatos('La sesión ha caducado. Vuelve a entrar.')
  return id
}

/**
 * Economía activa, compartida por todas las APIs: las consultas se filtran por ella y lo nuevo se crea en ella.
 * Las modificaciones y borrados van por id; el RLS ya impide tocar economías ajenas.
 */
export interface Ambito {
  economiaId: string | null
}

function economia(ambito: Ambito): string {
  if (!ambito.economiaId) throw new ErrorDatos('No hay ninguna economía elegida.')
  return ambito.economiaId
}

// --- Ajustes ---------------------------------------------------------------

interface FilaAjustes {
  ahorro_tipo: 'importe' | 'porcentaje' | null
  ahorro_valor: number | null
}

export function crearAjustesApi(client: SupabaseClient, ambito: Ambito): AjustesApi {
  return {
    async obtener(): Promise<Ajustes> {
      const { data, error } = await client
        .from('ajustes')
        .select('ahorro_tipo, ahorro_valor')
        .eq('economia_id', economia(ambito))
        .maybeSingle()
      comprobar(error)
      const fila = data as FilaAjustes | null
      return { ahorroTipo: fila?.ahorro_tipo ?? null, ahorroValor: fila?.ahorro_valor ?? null }
    },
    async guardar(ajustes) {
      const { error } = await client.from('ajustes').upsert({
        economia_id: economia(ambito),
        ahorro_tipo: ajustes.ahorroTipo,
        ahorro_valor: ajustes.ahorroValor,
        actualizado: new Date().toISOString(),
      })
      comprobar(error)
    },
  }
}

// --- Cuentas ---------------------------------------------------------------

interface FilaCuenta {
  id: string
  nombre: string
  tipo: Cuenta['tipo']
  saldo_inicial: number
  color: string
  orden: number
  archivada: boolean
}

const aCuenta = (f: FilaCuenta): Cuenta => ({
  id: f.id,
  nombre: f.nombre,
  tipo: f.tipo,
  saldoInicial: f.saldo_inicial,
  color: f.color,
  orden: f.orden,
  archivada: f.archivada,
})

function aFilaCuenta(c: Partial<NuevaCuenta>): Record<string, unknown> {
  const f: Record<string, unknown> = {}
  if (c.nombre !== undefined) f.nombre = c.nombre
  if (c.tipo !== undefined) f.tipo = c.tipo
  if (c.saldoInicial !== undefined) f.saldo_inicial = c.saldoInicial
  if (c.color !== undefined) f.color = c.color
  if (c.orden !== undefined) f.orden = c.orden
  if (c.archivada !== undefined) f.archivada = c.archivada
  return f
}

export function crearCuentasApi(client: SupabaseClient, ambito: Ambito): CuentasApi {
  return {
    async listar() {
      const { data, error } = await client
        .from('cuentas')
        .select('*')
        .eq('economia_id', economia(ambito))
        .order('orden')
        .order('creado')
      comprobar(error)
      return (data as FilaCuenta[]).map(aCuenta)
    },
    async crear(cuenta) {
      const { data, error } = await client
        .from('cuentas')
        .insert({ ...aFilaCuenta(cuenta), economia_id: economia(ambito) })
        .select()
        .single()
      comprobar(error)
      return aCuenta(data as FilaCuenta)
    },
    async actualizar(id, cambios) {
      const { data, error } = await client.from('cuentas').update(aFilaCuenta(cambios)).eq('id', id).select().single()
      comprobar(error)
      return aCuenta(data as FilaCuenta)
    },
  }
}

// --- Categorías ------------------------------------------------------------

interface FilaCategoria {
  id: string
  nombre: string
  tipo: Categoria['tipo']
  color: string
  icono: string | null
  orden: number
  archivada: boolean
}

const aCategoria = (f: FilaCategoria): Categoria => ({
  id: f.id,
  nombre: f.nombre,
  tipo: f.tipo,
  color: f.color,
  icono: f.icono,
  orden: f.orden,
  archivada: f.archivada,
})

function aFilaCategoria(c: Partial<NuevaCategoria>): Record<string, unknown> {
  const f: Record<string, unknown> = {}
  if (c.nombre !== undefined) f.nombre = c.nombre
  if (c.tipo !== undefined) f.tipo = c.tipo
  if (c.color !== undefined) f.color = c.color
  if (c.icono !== undefined) f.icono = c.icono
  if (c.orden !== undefined) f.orden = c.orden
  if (c.archivada !== undefined) f.archivada = c.archivada
  return f
}

export function crearCategoriasApi(client: SupabaseClient, ambito: Ambito): CategoriasApi {
  return {
    async listar() {
      const { data, error } = await client
        .from('categorias')
        .select('*')
        .eq('economia_id', economia(ambito))
        .order('orden')
        .order('creado')
      comprobar(error)
      return (data as FilaCategoria[]).map(aCategoria)
    },
    async crear(categoria) {
      const { data, error } = await client
        .from('categorias')
        .insert({ ...aFilaCategoria(categoria), economia_id: economia(ambito) })
        .select()
        .single()
      comprobar(error)
      return aCategoria(data as FilaCategoria)
    },
    async crearVarias(categorias) {
      const economia_id = economia(ambito)
      const { data, error } = await client
        .from('categorias')
        .insert(categorias.map((c) => ({ ...aFilaCategoria(c), economia_id })))
        .select()
      comprobar(error)
      return (data as FilaCategoria[]).map(aCategoria)
    },
    async actualizar(id, cambios) {
      const { data, error } = await client
        .from('categorias')
        .update(aFilaCategoria(cambios))
        .eq('id', id)
        .select()
        .single()
      comprobar(error)
      return aCategoria(data as FilaCategoria)
    },
    async reordenar(ids) {
      const resultados = await Promise.all(
        ids.map((id, orden) => client.from('categorias').update({ orden }).eq('id', id)),
      )
      for (const r of resultados) comprobar(r.error)
    },
  }
}

// --- Movimientos -----------------------------------------------------------

interface FilaMovimiento {
  id: string
  tipo: Movimiento['tipo']
  importe: number
  fecha: string
  cuenta_id: string
  cuenta_destino_id: string | null
  categoria_id: string | null
  nota: string
  descripcion: string
  fijo_id: string | null
  fijo_mes: string | null
  mes_imputado: string | null
  grupo_id: string | null
  hora: string | null
  traspaso_id: string | null
  economia_id: string
}

const aMovimiento = (f: FilaMovimiento): Movimiento => ({
  id: f.id,
  tipo: f.tipo,
  importe: f.importe,
  fecha: f.fecha,
  cuentaId: f.cuenta_id,
  cuentaDestinoId: f.cuenta_destino_id,
  categoriaId: f.categoria_id,
  nota: f.nota,
  descripcion: f.descripcion ?? '',
  fijoId: f.fijo_id,
  fijoMes: f.fijo_mes,
  mesImputado: f.mes_imputado,
  grupoId: f.grupo_id ?? null,
  // Postgres devuelve la hora como "HH:MM:SS".
  hora: f.hora ? f.hora.slice(0, 5) : null,
  traspasoId: f.traspaso_id ?? null,
})

function aFilaMovimiento(m: Partial<NuevoMovimiento>): Record<string, unknown> {
  const f: Record<string, unknown> = {}
  if (m.tipo !== undefined) f.tipo = m.tipo
  if (m.importe !== undefined) f.importe = m.importe
  if (m.fecha !== undefined) f.fecha = m.fecha
  if (m.cuentaId !== undefined) f.cuenta_id = m.cuentaId
  if (m.cuentaDestinoId !== undefined) f.cuenta_destino_id = m.cuentaDestinoId
  if (m.categoriaId !== undefined) f.categoria_id = m.categoriaId
  if (m.nota !== undefined) f.nota = m.nota
  if (m.descripcion !== undefined) f.descripcion = m.descripcion
  if (m.fijoId !== undefined) f.fijo_id = m.fijoId
  if (m.fijoMes !== undefined) f.fijo_mes = m.fijoMes
  if (m.mesImputado !== undefined) f.mes_imputado = m.mesImputado
  if (m.grupoId !== undefined) f.grupo_id = m.grupoId
  if (m.hora !== undefined) f.hora = m.hora
  if (m.traspasoId !== undefined) f.traspaso_id = m.traspasoId
  return f
}

/** Supabase devuelve como máximo 1000 filas por consulta, así que se pide por páginas. */
const TAMANO_PAGINA = 1000

/**
 * Pide todas las filas de una consulta, página a página. `consulta` recibe el rango (ambos incluidos)
 * y debe llevar un orden estable (con `id` al final) para que las páginas no se solapen.
 */
async function paginar<T>(
  consulta: (inicio: number, fin: number) => PromiseLike<{ data: unknown; error: ErrorPg | null }>,
): Promise<T[]> {
  const todas: T[] = []
  for (let inicio = 0; ; inicio += TAMANO_PAGINA) {
    const { data, error } = await consulta(inicio, inicio + TAMANO_PAGINA - 1)
    comprobar(error)
    const pagina = (data ?? []) as T[]
    todas.push(...pagina)
    if (pagina.length < TAMANO_PAGINA) return todas
  }
}

export function crearMovimientosApi(client: SupabaseClient, ambito: Ambito): MovimientosApi {
  const obtenerMitades = async (traspasoId: string) => {
    const { data, error } = await client.from('movimientos').select('*').eq('traspaso_id', traspasoId)
    comprobar(error)
    return (data as FilaMovimiento[]).map((f): DeEconomia<Movimiento> => ({ ...aMovimiento(f), economiaId: f.economia_id }))
  }

  return {
    async listar(desde, hasta) {
      const economia_id = economia(ambito)
      const filas = await paginar<FilaMovimiento>((inicio, fin) =>
        client
          .from('movimientos')
          .select('*')
          .eq('economia_id', economia_id)
          .gte('fecha', desde)
          .lte('fecha', hasta)
          .order('fecha', { ascending: false })
          .order('creado', { ascending: false })
          .order('id')
          .range(inicio, fin),
      )
      return filas.map(aMovimiento)
    },
    async crear(movimiento) {
      const { data, error } = await client
        .from('movimientos')
        .insert({ ...aFilaMovimiento(movimiento), economia_id: economia(ambito) })
        .select()
        .single()
      comprobar(error)
      return aMovimiento(data as FilaMovimiento)
    },
    async actualizar(id, cambios) {
      const { data, error } = await client
        .from('movimientos')
        .update(aFilaMovimiento(cambios))
        .eq('id', id)
        .select()
        .single()
      comprobar(error)
      return aMovimiento(data as FilaMovimiento)
    },
    async borrar(id) {
      const { error } = await client.from('movimientos').delete().eq('id', id)
      comprobar(error)
    },
    async actualizarEntradasGrupo(grupoId, cambios) {
      const fila: Record<string, unknown> = {}
      if (cambios.categoriaId !== undefined) fila.categoria_id = cambios.categoriaId
      if (cambios.nota !== undefined) fila.nota = cambios.nota
      if (Object.keys(fila).length === 0) return
      const { error } = await client.from('movimientos').update(fila).eq('grupo_id', grupoId)
      comprobar(error)
    },
    async listarPagosFijos(desde, hasta) {
      const economia_id = economia(ambito)
      const filas = await paginar<FilaMovimiento>((inicio, fin) =>
        client
          .from('movimientos')
          .select('*')
          .eq('economia_id', economia_id)
          .not('fijo_id', 'is', null)
          .gte('fijo_mes', desde)
          .lte('fijo_mes', hasta)
          .order('fecha', { ascending: false })
          .order('id')
          .range(inicio, fin),
      )
      return filas.map(aMovimiento)
    },
    async crearTraspasoEconomias(t) {
      const { origen, destino } = mitadesDeTraspaso(t, crypto.randomUUID())
      // Un solo insert con las dos filas: o se crean las dos o ninguna.
      const { data, error } = await client
        .from('movimientos')
        .insert([
          { ...aFilaMovimiento(origen), economia_id: t.origen.economiaId },
          { ...aFilaMovimiento(destino), economia_id: t.destino.economiaId },
        ])
        .select()
      comprobar(error)
      const filas = data as FilaMovimiento[]
      return aMovimiento(filas.find((f) => f.economia_id === ambito.economiaId) ?? filas[0])
    },
    async obtenerTraspasoEconomias(traspasoId) {
      const mitades = await obtenerMitades(traspasoId)
      return mitades.length === 2 ? traspasoDeMitades(mitades[0], mitades[1]) : null
    },
    async actualizarTraspasoEconomias(traspasoId, t) {
      const mitades = await obtenerMitades(traspasoId)
      const { origen, destino } = mitadesDeTraspaso(t, traspasoId)
      for (const m of mitades) {
        const cambios = m.tipo === 'gasto' ? origen : destino
        const { error } = await client.from('movimientos').update(aFilaMovimiento(cambios)).eq('id', m.id)
        comprobar(error)
      }
    },
    async borrarTraspasoEconomias(traspasoId) {
      const { error } = await client.from('movimientos').delete().eq('traspaso_id', traspasoId)
      comprobar(error)
    },
  }
}

// --- Fijos -----------------------------------------------------------------

interface FilaFijo {
  id: string
  nombre: string
  descripcion: string
  tipo: Fijo['tipo']
  importe: number
  cuenta_id: string
  cuenta_destino_id: string | null
  categoria_id: string | null
  categoria_destino_id: string | null
  dia_mes: number
  cada_meses: number
  desde: string
  hasta: string | null
  activo: boolean
}

const aFijo = (f: FilaFijo): Fijo => ({
  id: f.id,
  nombre: f.nombre,
  descripcion: f.descripcion ?? '',
  tipo: f.tipo,
  importe: f.importe,
  cuentaId: f.cuenta_id,
  cuentaDestinoId: f.cuenta_destino_id,
  categoriaId: f.categoria_id,
  categoriaDestinoId: f.categoria_destino_id ?? null,
  diaMes: f.dia_mes,
  cadaMeses: f.cada_meses,
  desde: f.desde,
  hasta: f.hasta,
  activo: f.activo,
})

function aFilaFijo(f: Partial<NuevoFijo>): Record<string, unknown> {
  const r: Record<string, unknown> = {}
  if (f.nombre !== undefined) r.nombre = f.nombre
  if (f.descripcion !== undefined) r.descripcion = f.descripcion
  if (f.tipo !== undefined) r.tipo = f.tipo
  if (f.importe !== undefined) r.importe = f.importe
  if (f.cuentaId !== undefined) r.cuenta_id = f.cuentaId
  if (f.cuentaDestinoId !== undefined) r.cuenta_destino_id = f.cuentaDestinoId
  if (f.categoriaId !== undefined) r.categoria_id = f.categoriaId
  if (f.categoriaDestinoId !== undefined) r.categoria_destino_id = f.categoriaDestinoId
  if (f.diaMes !== undefined) r.dia_mes = f.diaMes
  if (f.cadaMeses !== undefined) r.cada_meses = f.cadaMeses
  if (f.desde !== undefined) r.desde = f.desde
  if (f.hasta !== undefined) r.hasta = f.hasta
  if (f.activo !== undefined) r.activo = f.activo
  return r
}

export function crearFijosApi(client: SupabaseClient, ambito: Ambito): FijosApi {
  return {
    async listar() {
      const { data, error } = await client.from('fijos').select('*').eq('economia_id', economia(ambito)).order('creado')
      comprobar(error)
      return (data as FilaFijo[]).map(aFijo)
    },
    async crear(fijo) {
      const { data, error } = await client
        .from('fijos')
        .insert({ ...aFilaFijo(fijo), economia_id: economia(ambito) })
        .select()
        .single()
      comprobar(error)
      return aFijo(data as FilaFijo)
    },
    async actualizar(id, cambios) {
      const { data, error } = await client.from('fijos').update(aFilaFijo(cambios)).eq('id', id).select().single()
      comprobar(error)
      return aFijo(data as FilaFijo)
    },
    async borrar(id) {
      const { error } = await client.from('fijos').delete().eq('id', id)
      comprobar(error)
    },
    async listarOmitidos() {
      const { data, error } = await client.from('fijos_omitidos').select('fijo_id, mes').eq('economia_id', economia(ambito))
      comprobar(error)
      return (data as { fijo_id: string; mes: string }[]).map((f): FijoOmitido => ({ fijoId: f.fijo_id, mes: f.mes }))
    },
    async omitir(fijoId, mes) {
      const { error } = await client
        .from('fijos_omitidos')
        .upsert({ economia_id: economia(ambito), fijo_id: fijoId, mes })
      comprobar(error)
    },
    async quitarOmision(fijoId, mes) {
      const { error } = await client.from('fijos_omitidos').delete().eq('fijo_id', fijoId).eq('mes', mes)
      comprobar(error)
    },
    async listarFechas() {
      const { data, error } = await client
        .from('fijos_fechas')
        .select('fijo_id, mes, fecha')
        .eq('economia_id', economia(ambito))
      comprobar(error)
      return (data as { fijo_id: string; mes: string; fecha: string }[]).map(
        (f): FijoFecha => ({ fijoId: f.fijo_id, mes: f.mes, fecha: f.fecha }),
      )
    },
    async fijarFecha(fijoId, mes, fecha) {
      const { error } = await client
        .from('fijos_fechas')
        .upsert({ economia_id: economia(ambito), fijo_id: fijoId, mes, fecha })
      comprobar(error)
    },
    async quitarFecha(fijoId, mes) {
      const { error } = await client.from('fijos_fechas').delete().eq('fijo_id', fijoId).eq('mes', mes)
      comprobar(error)
    },
  }
}

// --- Presupuestos y saldos -------------------------------------------------

export function crearPresupuestosApi(client: SupabaseClient, ambito: Ambito): PresupuestosApi {
  return {
    async listar() {
      const { data, error } = await client
        .from('presupuestos')
        .select('id, mes, categoria_id, importe')
        .eq('economia_id', economia(ambito))
        .order('mes')
      comprobar(error)
      return (data as { id: string; mes: string; categoria_id: string | null; importe: number | null }[]).map(
        (f): Presupuesto => ({ id: f.id, mes: f.mes, categoriaId: f.categoria_id, importe: f.importe }),
      )
    },
    async eliminarPosteriores(mes, categoriaId) {
      let consulta = client.from('presupuestos').delete().eq('economia_id', economia(ambito)).gt('mes', mes)
      consulta = categoriaId === null ? consulta.is('categoria_id', null) : consulta.eq('categoria_id', categoriaId)
      const { error } = await consulta
      comprobar(error)
    },
    async guardar(mes, categoriaId, importe) {
      const { error } = await client
        .from('presupuestos')
        .upsert(
          { economia_id: economia(ambito), mes, categoria_id: categoriaId, importe },
          { onConflict: 'economia_id,mes,categoria_id' },
        )
      comprobar(error)
    },
  }
}

export function crearSaldosApi(client: SupabaseClient, ambito: Ambito): SaldosApi {
  return {
    async listar() {
      const { data, error } = await client
        .from('saldos_cuentas')
        .select('cuenta_id, saldo')
        .eq('economia_id', economia(ambito))
      comprobar(error)
      return (data as { cuenta_id: string; saldo: number | string }[]).map((f) => ({
        cuentaId: f.cuenta_id,
        saldo: Number(f.saldo),
      }))
    },
  }
}

// --- Grupos de gastos ------------------------------------------------------

interface FilaGrupo {
  id: string
  nombre: string
  categoria_id: string
  orden: number
  archivado: boolean
}

const aGrupo = (f: FilaGrupo): Grupo => ({
  id: f.id,
  nombre: f.nombre,
  categoriaId: f.categoria_id,
  orden: f.orden,
  archivado: f.archivado,
})

function aFilaGrupo(g: Partial<NuevoGrupo>): Record<string, unknown> {
  const r: Record<string, unknown> = {}
  if (g.nombre !== undefined) r.nombre = g.nombre
  if (g.categoriaId !== undefined) r.categoria_id = g.categoriaId
  if (g.orden !== undefined) r.orden = g.orden
  if (g.archivado !== undefined) r.archivado = g.archivado
  return r
}

export function crearGruposApi(client: SupabaseClient, ambito: Ambito): GruposApi {
  return {
    async listar() {
      const { data, error } = await client
        .from('grupos')
        .select('*')
        .eq('economia_id', economia(ambito))
        .order('orden')
        .order('creado')
      comprobar(error)
      return (data as FilaGrupo[]).map(aGrupo)
    },
    async crear(grupo) {
      const { data, error } = await client
        .from('grupos')
        .insert({ ...aFilaGrupo(grupo), economia_id: economia(ambito) })
        .select()
        .single()
      comprobar(error)
      return aGrupo(data as FilaGrupo)
    },
    async actualizar(id, cambios) {
      const { data, error } = await client.from('grupos').update(aFilaGrupo(cambios)).eq('id', id).select().single()
      comprobar(error)
      return aGrupo(data as FilaGrupo)
    },
    async borrar(id) {
      const { error } = await client.from('grupos').delete().eq('id', id)
      comprobar(error)
    },
  }
}

// --- Otros saldos ----------------------------------------------------------

interface FilaOtroSaldo {
  id: string
  nombre: string
  color: string
  icono: string | null
  orden: number
  archivado: boolean
}

const aOtroSaldo = (f: FilaOtroSaldo): OtroSaldo => ({
  id: f.id,
  nombre: f.nombre,
  color: f.color,
  icono: f.icono,
  orden: f.orden,
  archivado: f.archivado,
})

function aFilaOtroSaldo(o: Partial<NuevoOtroSaldo>): Record<string, unknown> {
  const r: Record<string, unknown> = {}
  if (o.nombre !== undefined) r.nombre = o.nombre
  if (o.color !== undefined) r.color = o.color
  if (o.icono !== undefined) r.icono = o.icono
  if (o.orden !== undefined) r.orden = o.orden
  if (o.archivado !== undefined) r.archivado = o.archivado
  return r
}

interface FilaActualizacion {
  id: string
  otro_saldo_id: string
  saldo: number
  fecha_hora: string
}

const aActualizacion = (f: FilaActualizacion): ActualizacionSaldo => ({
  id: f.id,
  otroSaldoId: f.otro_saldo_id,
  saldo: f.saldo,
  fechaHora: f.fecha_hora,
})

export function crearOtrosSaldosApi(client: SupabaseClient, ambito: Ambito): OtrosSaldosApi {
  return {
    async listar() {
      const { data, error } = await client
        .from('otros_saldos')
        .select('*')
        .eq('economia_id', economia(ambito))
        .order('orden')
        .order('creado')
      comprobar(error)
      return (data as FilaOtroSaldo[]).map(aOtroSaldo)
    },
    async crear(otro) {
      const { data, error } = await client
        .from('otros_saldos')
        .insert({ ...aFilaOtroSaldo(otro), economia_id: economia(ambito) })
        .select()
        .single()
      comprobar(error)
      return aOtroSaldo(data as FilaOtroSaldo)
    },
    async actualizar(id, cambios) {
      const { data, error } = await client
        .from('otros_saldos')
        .update(aFilaOtroSaldo(cambios))
        .eq('id', id)
        .select()
        .single()
      comprobar(error)
      return aOtroSaldo(data as FilaOtroSaldo)
    },
    async borrar(id) {
      const { error } = await client.from('otros_saldos').delete().eq('id', id)
      comprobar(error)
    },
    async listarHistorial() {
      const economia_id = economia(ambito)
      const filas = await paginar<FilaActualizacion>((inicio, fin) =>
        client
          .from('otros_saldos_historial')
          .select('id, otro_saldo_id, saldo, fecha_hora')
          .eq('economia_id', economia_id)
          .order('fecha_hora')
          .order('id')
          .range(inicio, fin),
      )
      return filas.map(aActualizacion)
    },
    async registrarSaldo(otroSaldoId, saldo, fechaHora) {
      const fila: Record<string, unknown> = { otro_saldo_id: otroSaldoId, saldo, economia_id: economia(ambito) }
      if (fechaHora) fila.fecha_hora = fechaHora
      const { data, error } = await client.from('otros_saldos_historial').insert(fila).select().single()
      comprobar(error)
      return aActualizacion(data as FilaActualizacion)
    },
    async borrarActualizacion(id) {
      const { error } = await client.from('otros_saldos_historial').delete().eq('id', id)
      comprobar(error)
    },
  }
}

// --- Economías --------------------------------------------------------------

/** Tablas de una economía en un orden que respeta las claves foráneas (primero lo que apunta a otras). */
const TABLAS_DE_LA_ECONOMIA = [
  'movimientos',
  'fijos_fechas',
  'fijos_omitidos',
  'fijos',
  'presupuestos',
  'grupos',
  'otros_saldos_historial',
  'otros_saldos',
  'categorias',
  'cuentas',
  'ajustes',
]

/** Borra una economía con todos sus datos, tabla a tabla (las claves entre tablas no se borran en cascada). */
async function borrarEconomia(client: SupabaseClient, id: string): Promise<void> {
  // Los fijos de otras economías que traspasan dinero a esta se quedan como gastos normales.
  const { data: cuentas, error: errorCuentas } = await client.from('cuentas').select('id').eq('economia_id', id)
  comprobar(errorCuentas)
  const ids = (cuentas as { id: string }[]).map((c) => c.id)
  if (ids.length > 0) {
    const { error } = await client
      .from('fijos')
      .update({ cuenta_destino_id: null, categoria_destino_id: null })
      .eq('tipo', 'gasto')
      .in('cuenta_destino_id', ids)
    comprobar(error)
  }
  for (const tabla of TABLAS_DE_LA_ECONOMIA) {
    const { error } = await client.from(tabla).delete().eq('economia_id', id)
    comprobar(error)
  }
  const { error } = await client.from('economias').delete().eq('id', id)
  comprobar(error)
}

interface FilaEconomia {
  id: string
  propietario_id: string
  nombre: string
  color: string
  orden: number
}

const aEconomia = (f: FilaEconomia, userId: string): Economia => ({
  id: f.id,
  nombre: f.nombre,
  color: f.color,
  orden: f.orden,
  propia: f.propietario_id === userId,
})

function aFilaEconomia(e: Partial<NuevaEconomia>): Record<string, unknown> {
  const r: Record<string, unknown> = {}
  if (e.nombre !== undefined) r.nombre = e.nombre
  if (e.color !== undefined) r.color = e.color
  if (e.orden !== undefined) r.orden = e.orden
  return r
}

export function crearEconomiasApi(client: SupabaseClient, ambito: Ambito): EconomiasApi {
  return {
    async listar() {
      const userId = await idUsuario(client)
      const { data, error } = await client.from('economias').select('*').order('orden').order('creado')
      comprobar(error)
      return (data as FilaEconomia[]).map((f) => aEconomia(f, userId))
    },
    async crear(e) {
      const userId = await idUsuario(client)
      const { data, error } = await client.from('economias').insert(aFilaEconomia(e)).select().single()
      comprobar(error)
      return aEconomia(data as FilaEconomia, userId)
    },
    async actualizar(id, cambios) {
      const userId = await idUsuario(client)
      const { data, error } = await client.from('economias').update(aFilaEconomia(cambios)).eq('id', id).select().single()
      comprobar(error)
      return aEconomia(data as FilaEconomia, userId)
    },
    async borrar(id) {
      await borrarEconomia(client, id)
    },
    activar(id) {
      ambito.economiaId = id
    },
    activa() {
      return ambito.economiaId
    },
    async cuentasDeTodas() {
      const { data, error } = await client.from('cuentas').select('*').order('orden').order('creado')
      comprobar(error)
      return (data as (FilaCuenta & { economia_id: string })[]).map((f) => ({ ...aCuenta(f), economiaId: f.economia_id }))
    },
    async categoriasDeTodas() {
      const { data, error } = await client.from('categorias').select('*').order('orden').order('creado')
      comprobar(error)
      return (data as (FilaCategoria & { economia_id: string })[]).map((f) => ({
        ...aCategoria(f),
        economiaId: f.economia_id,
      }))
    },
    async saldosDeTodas() {
      const { data, error } = await client.from('saldos_cuentas').select('cuenta_id, saldo, economia_id')
      comprobar(error)
      return (data as { cuenta_id: string; saldo: number | string; economia_id: string }[]).map((f) => ({
        cuentaId: f.cuenta_id,
        saldo: Number(f.saldo),
        economiaId: f.economia_id,
      }))
    },
    async otrosSaldosDeTodas() {
      const { data, error } = await client.from('otros_saldos').select('*').order('orden').order('creado')
      comprobar(error)
      return (data as (FilaOtroSaldo & { economia_id: string })[]).map((f) => ({
        ...aOtroSaldo(f),
        economiaId: f.economia_id,
      }))
    },
    async historialDeTodas() {
      const filas = await paginar<FilaActualizacion>((inicio, fin) =>
        client
          .from('otros_saldos_historial')
          .select('id, otro_saldo_id, saldo, fecha_hora')
          .order('fecha_hora')
          .order('id')
          .range(inicio, fin),
      )
      return filas.map(aActualizacion)
    },
  }
}

// --- Mantenimiento ---------------------------------------------------------

export function crearMantenimientoApi(client: SupabaseClient): MantenimientoApi {
  return {
    async borrarTodo() {
      const userId = await idUsuario(client)
      const { data, error } = await client.from('economias').select('id').eq('propietario_id', userId)
      comprobar(error)
      for (const { id } of data as { id: string }[]) await borrarEconomia(client, id)
    },
  }
}
