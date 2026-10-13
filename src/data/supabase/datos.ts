import type { SupabaseClient } from '@supabase/supabase-js'
import { ErrorDatos } from '../types'
import type {
  Ajustes,
  AjustesApi,
  CategoriasApi,
  Categoria,
  Cuenta,
  CuentasApi,
  Fijo,
  FijoFecha,
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

// --- Ajustes ---------------------------------------------------------------

interface FilaAjustes {
  ahorro_tipo: 'importe' | 'porcentaje' | null
  ahorro_valor: number | null
}

export function crearAjustesApi(client: SupabaseClient): AjustesApi {
  return {
    async obtener(): Promise<Ajustes> {
      const { data, error } = await client.from('ajustes').select('ahorro_tipo, ahorro_valor').maybeSingle()
      comprobar(error)
      const fila = data as FilaAjustes | null
      return { ahorroTipo: fila?.ahorro_tipo ?? null, ahorroValor: fila?.ahorro_valor ?? null }
    },
    async guardar(ajustes) {
      const user_id = await idUsuario(client)
      const { error } = await client.from('ajustes').upsert({
        user_id,
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

export function crearCuentasApi(client: SupabaseClient): CuentasApi {
  return {
    async listar() {
      const { data, error } = await client.from('cuentas').select('*').order('orden').order('creado')
      comprobar(error)
      return (data as FilaCuenta[]).map(aCuenta)
    },
    async crear(cuenta) {
      const { data, error } = await client.from('cuentas').insert(aFilaCuenta(cuenta)).select().single()
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

export function crearCategoriasApi(client: SupabaseClient): CategoriasApi {
  return {
    async listar() {
      const { data, error } = await client.from('categorias').select('*').order('orden').order('creado')
      comprobar(error)
      return (data as FilaCategoria[]).map(aCategoria)
    },
    async crear(categoria) {
      const { data, error } = await client.from('categorias').insert(aFilaCategoria(categoria)).select().single()
      comprobar(error)
      return aCategoria(data as FilaCategoria)
    },
    async crearVarias(categorias) {
      const { data, error } = await client.from('categorias').insert(categorias.map(aFilaCategoria)).select()
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

export function crearMovimientosApi(client: SupabaseClient): MovimientosApi {
  return {
    async listar(desde, hasta) {
      const filas = await paginar<FilaMovimiento>((inicio, fin) =>
        client
          .from('movimientos')
          .select('*')
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
      const { data, error } = await client.from('movimientos').insert(aFilaMovimiento(movimiento)).select().single()
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
    async listarPagosFijos(desde, hasta) {
      const filas = await paginar<FilaMovimiento>((inicio, fin) =>
        client
          .from('movimientos')
          .select('*')
          .not('fijo_id', 'is', null)
          .gte('fijo_mes', desde)
          .lte('fijo_mes', hasta)
          .order('fecha', { ascending: false })
          .order('id')
          .range(inicio, fin),
      )
      return filas.map(aMovimiento)
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
  if (f.diaMes !== undefined) r.dia_mes = f.diaMes
  if (f.cadaMeses !== undefined) r.cada_meses = f.cadaMeses
  if (f.desde !== undefined) r.desde = f.desde
  if (f.hasta !== undefined) r.hasta = f.hasta
  if (f.activo !== undefined) r.activo = f.activo
  return r
}

export function crearFijosApi(client: SupabaseClient): FijosApi {
  return {
    async listar() {
      const { data, error } = await client.from('fijos').select('*').order('creado')
      comprobar(error)
      return (data as FilaFijo[]).map(aFijo)
    },
    async crear(fijo) {
      const { data, error } = await client.from('fijos').insert(aFilaFijo(fijo)).select().single()
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
      const { data, error } = await client.from('fijos_omitidos').select('fijo_id, mes')
      comprobar(error)
      return (data as { fijo_id: string; mes: string }[]).map((f): FijoOmitido => ({ fijoId: f.fijo_id, mes: f.mes }))
    },
    async omitir(fijoId, mes) {
      const user_id = await idUsuario(client)
      const { error } = await client.from('fijos_omitidos').upsert({ user_id, fijo_id: fijoId, mes })
      comprobar(error)
    },
    async quitarOmision(fijoId, mes) {
      const { error } = await client.from('fijos_omitidos').delete().eq('fijo_id', fijoId).eq('mes', mes)
      comprobar(error)
    },
    async listarFechas() {
      const { data, error } = await client.from('fijos_fechas').select('fijo_id, mes, fecha')
      comprobar(error)
      return (data as { fijo_id: string; mes: string; fecha: string }[]).map(
        (f): FijoFecha => ({ fijoId: f.fijo_id, mes: f.mes, fecha: f.fecha }),
      )
    },
    async fijarFecha(fijoId, mes, fecha) {
      const user_id = await idUsuario(client)
      const { error } = await client.from('fijos_fechas').upsert({ user_id, fijo_id: fijoId, mes, fecha })
      comprobar(error)
    },
    async quitarFecha(fijoId, mes) {
      const { error } = await client.from('fijos_fechas').delete().eq('fijo_id', fijoId).eq('mes', mes)
      comprobar(error)
    },
  }
}

// --- Presupuestos y saldos -------------------------------------------------

export function crearPresupuestosApi(client: SupabaseClient): PresupuestosApi {
  return {
    async listar() {
      const { data, error } = await client.from('presupuestos').select('id, mes, categoria_id, importe').order('mes')
      comprobar(error)
      return (data as { id: string; mes: string; categoria_id: string | null; importe: number | null }[]).map(
        (f): Presupuesto => ({ id: f.id, mes: f.mes, categoriaId: f.categoria_id, importe: f.importe }),
      )
    },
    async eliminarPosteriores(mes, categoriaId) {
      let consulta = client.from('presupuestos').delete().gt('mes', mes)
      consulta = categoriaId === null ? consulta.is('categoria_id', null) : consulta.eq('categoria_id', categoriaId)
      const { error } = await consulta
      comprobar(error)
    },
    async guardar(mes, categoriaId, importe) {
      const user_id = await idUsuario(client)
      const { error } = await client
        .from('presupuestos')
        .upsert({ user_id, mes, categoria_id: categoriaId, importe }, { onConflict: 'user_id,mes,categoria_id' })
      comprobar(error)
    },
  }
}

export function crearSaldosApi(client: SupabaseClient): SaldosApi {
  return {
    async listar() {
      const { data, error } = await client.from('saldos_cuentas').select('cuenta_id, saldo')
      comprobar(error)
      return (data as { cuenta_id: string; saldo: number | string }[]).map((f) => ({
        cuentaId: f.cuenta_id,
        saldo: Number(f.saldo),
      }))
    },
  }
}
