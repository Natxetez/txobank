// Tipos del dominio e interfaz DataSource. TypeScript puro: nada aquí depende de Supabase.
// Los importes siempre van en céntimos (enteros).

export type TipoCuenta = 'corriente' | 'ahorro' | 'efectivo' | 'tarjeta'
export type TipoCategoria = 'gasto' | 'ingreso'
export type TipoMovimiento = 'gasto' | 'ingreso' | 'traspaso' | 'devolucion'

/** Mes como fecha ISO `YYYY-MM-01`. */
export type Mes = string
/** Fecha ISO `YYYY-MM-DD`. */
export type Fecha = string

export interface Ajustes {
  ahorroTipo: 'importe' | 'porcentaje' | null
  ahorroValor: number | null
}

export interface Cuenta {
  id: string
  nombre: string
  tipo: TipoCuenta
  saldoInicial: number
  color: string
  orden: number
  archivada: boolean
}

export interface Categoria {
  id: string
  nombre: string
  tipo: TipoCategoria
  color: string
  icono: string | null
  orden: number
  archivada: boolean
}

export interface Presupuesto {
  id: string
  mes: Mes
  categoriaId: string | null
  importe: number | null
}

export interface Movimiento {
  id: string
  tipo: TipoMovimiento
  importe: number
  fecha: Fecha
  cuentaId: string
  cuentaDestinoId: string | null
  categoriaId: string | null
  nota: string
  fijoId: string | null
  fijoMes: Mes | null
  mesImputado: Mes | null
}

export interface Fijo {
  id: string
  nombre: string
  tipo: 'gasto' | 'ingreso' | 'traspaso'
  importe: number
  cuentaId: string
  cuentaDestinoId: string | null
  categoriaId: string | null
  diaMes: number
  cadaMeses: number
  desde: Mes
  hasta: Mes | null
  activo: boolean
}

export interface Saldo {
  cuentaId: string
  saldo: number
}

export interface Sesion {
  userId: string
  email: string
}

export type CodigoErrorSesion = 'credenciales' | 'red' | 'demasiados-intentos' | 'desconocido'

export class ErrorSesion extends Error {
  readonly codigo: CodigoErrorSesion
  constructor(codigo: CodigoErrorSesion, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorSesion'
    this.codigo = codigo
  }
}

export type CodigoErrorDatos = 'duplicado' | 'permisos' | 'sin-tablas' | 'desconocido'

/** Error de acceso a datos con mensaje ya en español, listo para mostrar. */
export class ErrorDatos extends Error {
  readonly codigo: CodigoErrorDatos
  constructor(mensaje: string, codigo: CodigoErrorDatos = 'desconocido') {
    super(mensaje)
    this.name = 'ErrorDatos'
    this.codigo = codigo
  }
}

export type NuevaCuenta = Omit<Cuenta, 'id'>
export type NuevaCategoria = Omit<Categoria, 'id'>

export interface AjustesApi {
  /** Si aún no hay fila, devuelve los ajustes vacíos. */
  obtener(): Promise<Ajustes>
  guardar(ajustes: Ajustes): Promise<void>
}

export interface CuentasApi {
  /** Todas, también las archivadas, por orden. */
  listar(): Promise<Cuenta[]>
  crear(cuenta: NuevaCuenta): Promise<Cuenta>
  actualizar(id: string, cambios: Partial<NuevaCuenta>): Promise<Cuenta>
}

export interface CategoriasApi {
  /** Todas, también las archivadas, por orden. */
  listar(): Promise<Categoria[]>
  crear(categoria: NuevaCategoria): Promise<Categoria>
  crearVarias(categorias: NuevaCategoria[]): Promise<Categoria[]>
  actualizar(id: string, cambios: Partial<NuevaCategoria>): Promise<Categoria>
  /** Asigna `orden` según la posición en la lista de ids. */
  reordenar(ids: string[]): Promise<void>
}

export type NuevoMovimiento = Omit<Movimiento, 'id'>

export interface MovimientosApi {
  /** Movimientos con fecha entre `desde` y `hasta` (ambas incluidas), del más reciente al más antiguo. Pagina por dentro. */
  listar(desde: Fecha, hasta: Fecha): Promise<Movimiento[]>
  crear(movimiento: NuevoMovimiento): Promise<Movimiento>
  /** Solo se tocan los campos presentes; `null` borra el valor. */
  actualizar(id: string, cambios: Partial<NuevoMovimiento>): Promise<Movimiento>
  borrar(id: string): Promise<void>
  /** Pagos de fijos: movimientos cuyo `fijoMes` está entre los dos meses (ambos incluidos), sea cual sea su fecha. */
  listarPagosFijos(desde: Mes, hasta: Mes): Promise<Movimiento[]>
}

export type NuevoFijo = Omit<Fijo, 'id'>

export interface FijoOmitido {
  fijoId: string
  mes: Mes
}

export interface FijosApi {
  listar(): Promise<Fijo[]>
  crear(fijo: NuevoFijo): Promise<Fijo>
  actualizar(id: string, cambios: Partial<NuevoFijo>): Promise<Fijo>
  /** Los movimientos ya pagados no se borran: se quedan sin fijo. */
  borrar(id: string): Promise<void>
  listarOmitidos(): Promise<FijoOmitido[]>
  omitir(fijoId: string, mes: Mes): Promise<void>
  quitarOmision(fijoId: string, mes: Mes): Promise<void>
}

export interface PresupuestosApi {
  listar(): Promise<Presupuesto[]>
  /** Guarda (upsert) el presupuesto de un mes; categoriaId null = total; importe null = sin presupuesto desde ese mes. */
  guardar(mes: Mes, categoriaId: string | null, importe: number | null): Promise<void>
  /** Borra los presupuestos de esa categoría definidos en meses posteriores a `mes`. */
  eliminarPosteriores(mes: Mes, categoriaId: string | null): Promise<void>
}

export interface SaldosApi {
  listar(): Promise<Saldo[]>
}

export interface SesionApi {
  iniciar(email: string, password: string): Promise<Sesion>
  cerrar(): Promise<void>
  actual(): Promise<Sesion | null>
  /** Avisa de cada cambio de sesión. Devuelve la función para dejar de escuchar. */
  alCambiar(cb: (sesion: Sesion | null) => void): () => void
}

/**
 * Único punto de acceso a datos para las pantallas.
 * Cubre sesión, ajustes, cuentas, categorías, movimientos, fijos, presupuestos y saldos.
 */
export interface DataSource {
  sesion: SesionApi
  ajustes: AjustesApi
  cuentas: CuentasApi
  categorias: CategoriasApi
  movimientos: MovimientosApi
  fijos: FijosApi
  presupuestos: PresupuestosApi
  saldos: SaldosApi
}
