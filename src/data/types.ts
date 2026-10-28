// Tipos del dominio e interfaz DataSource. TypeScript puro: nada aquí depende de Supabase.
// Los importes siempre van en céntimos (enteros).

export type TipoCuenta = 'corriente' | 'ahorro' | 'efectivo' | 'tarjeta'
export type TipoCategoria = 'gasto' | 'ingreso'
export type TipoMovimiento = 'gasto' | 'ingreso' | 'traspaso' | 'devolucion'

/** Mes como fecha ISO `YYYY-MM-01`. */
export type Mes = string
/** Fecha ISO `YYYY-MM-DD`. */
export type Fecha = string
/** Hora local `HH:MM`. */
export type Hora = string
/** Fecha y hora ISO 8601 con zona (`2026-10-15T09:30:00.000Z`). */
export type FechaHora = string

/**
 * Economía ("Personal", "Casa"): agrupa todo lo demás. Cada una tiene sus propias cuentas, categorías,
 * movimientos, fijos, presupuestos, grupos, otros saldos y ajustes.
 */
export interface Economia {
  id: string
  nombre: string
  color: string
  orden: number
  /** El usuario de la sesión es su propietario (y no solo miembro). */
  propia: boolean
}

export type NuevaEconomia = Pick<Economia, 'nombre' | 'color' | 'orden'>

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
  /** Concepto corto ("Mercadona"): se autocompleta y sirve para detectar frecuentes. */
  nota: string
  /** Texto libre opcional, aparte del concepto. */
  descripcion: string
  fijoId: string | null
  fijoMes: Mes | null
  mesImputado: Mes | null
  /** Grupo de gastos al que pertenece (solo gastos). */
  grupoId: string | null
  /** Hora del movimiento, si se conoce. */
  hora: Hora | null
  /**
   * Mitad de un traspaso entre economías: el gasto en la de origen o el ingreso en la de destino.
   * Las dos mitades comparten este id y se crean, editan y borran juntas.
   */
  traspasoId: string | null
}

/** Una mitad de un traspaso entre economías. */
export interface LadoTraspaso {
  economiaId: string
  cuentaId: string
  /** De gasto en el origen, de ingreso en el destino. */
  categoriaId: string
}

/** Traspaso entre economías: cuenta como gasto en la de origen y como ingreso en la de destino. */
export interface TraspasoEconomias {
  importe: number
  fecha: Fecha
  hora: Hora | null
  nota: string
  descripcion: string
  origen: LadoTraspaso
  destino: LadoTraspaso
  /** Pago de un fijo (traspaso a otra economía): va en la mitad de origen. */
  fijoId: string | null
  fijoMes: Mes | null
}

/** Cuenta, categoría, saldo… junto con la economía a la que pertenece (para ver varias a la vez). */
export type DeEconomia<T> = T & { economiaId: string }

/**
 * Grupo de gastos ("Cafés y pintxos"): reúne gastos repetidos con una categoría fija.
 * Es permanente; su total se cuenta por meses, así que cada mes empieza de cero.
 */
export interface Grupo {
  id: string
  nombre: string
  /** Categoría de gasto de todas sus entradas. */
  categoriaId: string
  orden: number
  archivado: boolean
}

/** Saldo fuera de las cuentas (banco virtual, inversiones…). No admite movimientos: solo se actualiza su saldo. */
export interface OtroSaldo {
  id: string
  nombre: string
  color: string
  icono: string | null
  orden: number
  archivado: boolean
}

/** Una actualización del saldo de un "otro saldo". El saldo actual es el de la más reciente. */
export interface ActualizacionSaldo {
  id: string
  otroSaldoId: string
  /** Céntimos; puede ser negativo (una deuda). */
  saldo: number
  fechaHora: FechaHora
}

export interface Fijo {
  id: string
  nombre: string
  /** Texto libre opcional; pasa al movimiento al marcarlo como pagado. */
  descripcion: string
  tipo: 'gasto' | 'ingreso' | 'traspaso'
  importe: number
  cuentaId: string
  /**
   * Traspaso: cuenta de destino. Gasto con cuenta de destino: traspaso a otra economía (aquí es un gasto y
   * allí entra como ingreso en esa cuenta, con `categoriaDestinoId`).
   */
  cuentaDestinoId: string | null
  categoriaId: string | null
  /** Solo en traspasos a otra economía: categoría de ingreso en la de destino. */
  categoriaDestinoId: string | null
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
  /** Tiene activada la verificación en dos pasos y esta sesión aún no ha introducido el código. */
  faltaCodigo: boolean
}

/** Datos para añadir TxoBank a una app autenticadora al activar la verificación en dos pasos. */
export interface InscripcionMfa {
  factorId: string
  /** Imagen del código QR, lista para usar como `src`. */
  qr: string
  /** Clave para introducirla a mano en la app autenticadora. */
  secreto: string
  /** Enlace `otpauth://` que abre directamente la app Contraseñas del iPhone. */
  uri: string
}

export type CodigoErrorSesion = 'credenciales' | 'codigo' | 'red' | 'demasiados-intentos' | 'desconocido'

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
  /** Cambia la categoría y/o el concepto de todas las entradas de un grupo (al editar el grupo). */
  actualizarEntradasGrupo(grupoId: string, cambios: { categoriaId?: string; nota?: string }): Promise<void>
  /** Crea las dos mitades de un traspaso entre economías; devuelve la de la economía activa. */
  crearTraspasoEconomias(traspaso: TraspasoEconomias): Promise<Movimiento>
  /** Las dos mitades de un traspaso entre economías, o null si falta alguna. */
  obtenerTraspasoEconomias(traspasoId: string): Promise<TraspasoEconomias | null>
  /** Cambia las dos mitades. Las economías de origen y destino no cambian. */
  actualizarTraspasoEconomias(traspasoId: string, traspaso: TraspasoEconomias): Promise<void>
  /** Borra las dos mitades. */
  borrarTraspasoEconomias(traspasoId: string): Promise<void>
}

export type NuevoFijo = Omit<Fijo, 'id'>
export type NuevoGrupo = Omit<Grupo, 'id'>
export type NuevoOtroSaldo = Omit<OtroSaldo, 'id'>

export interface FijoOmitido {
  fijoId: string
  mes: Mes
}

/** Fecha de cargo de un fijo en un mes concreto, cuando no es la del día habitual. */
export interface FijoFecha {
  fijoId: string
  mes: Mes
  fecha: Fecha
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
  listarFechas(): Promise<FijoFecha[]>
  /** Fija (upsert) la fecha de cargo de un fijo en un mes; la fecha cae dentro de ese mes. */
  fijarFecha(fijoId: string, mes: Mes, fecha: Fecha): Promise<void>
  quitarFecha(fijoId: string, mes: Mes): Promise<void>
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

export interface GruposApi {
  /** Todos, también los archivados, por orden. */
  listar(): Promise<Grupo[]>
  crear(grupo: NuevoGrupo): Promise<Grupo>
  actualizar(id: string, cambios: Partial<NuevoGrupo>): Promise<Grupo>
  /** Sus entradas no se borran: se quedan como gastos sueltos. */
  borrar(id: string): Promise<void>
}

export interface OtrosSaldosApi {
  /** Todos, también los archivados, por orden. */
  listar(): Promise<OtroSaldo[]>
  crear(otro: NuevoOtroSaldo): Promise<OtroSaldo>
  actualizar(id: string, cambios: Partial<NuevoOtroSaldo>): Promise<OtroSaldo>
  /** Borra también su historial. */
  borrar(id: string): Promise<void>
  /** Todas las actualizaciones de todos, de la más antigua a la más reciente. */
  listarHistorial(): Promise<ActualizacionSaldo[]>
  /** Registra un saldo nuevo con la fecha y hora indicadas (por defecto, ahora). */
  registrarSaldo(otroSaldoId: string, saldo: number, fechaHora?: FechaHora): Promise<ActualizacionSaldo>
  borrarActualizacion(id: string): Promise<void>
}

/**
 * Economías. Todas las demás APIs trabajan sobre la economía activa (`activar`); las consultas
 * "de todas" sirven para los traspasos entre economías y el patrimonio total.
 */
export interface EconomiasApi {
  /** Las economías a las que tiene acceso el usuario, por orden. */
  listar(): Promise<Economia[]>
  crear(economia: NuevaEconomia): Promise<Economia>
  actualizar(id: string, cambios: Partial<NuevaEconomia>): Promise<Economia>
  /** Borra la economía con todos sus datos. */
  borrar(id: string): Promise<void>
  /** Cambia la economía sobre la que trabajan el resto de APIs. */
  activar(id: string | null): void
  activa(): string | null
  cuentasDeTodas(): Promise<DeEconomia<Cuenta>[]>
  categoriasDeTodas(): Promise<DeEconomia<Categoria>[]>
  saldosDeTodas(): Promise<DeEconomia<Saldo>[]>
  otrosSaldosDeTodas(): Promise<DeEconomia<OtroSaldo>[]>
  historialDeTodas(): Promise<ActualizacionSaldo[]>
  /** Movimientos de todas las economías hasta una fecha (incluida), para el patrimonio total. */
  movimientosDeTodas(hasta: Fecha): Promise<Movimiento[]>
}

/** Todos los datos de una economía, tal cual, para la copia de seguridad. */
export interface EconomiaEnCopia {
  economia: { id: string; nombre: string; color: string; orden: number }
  ajustes: Ajustes
  cuentas: Cuenta[]
  categorias: Categoria[]
  presupuestos: Presupuesto[]
  fijos: Fijo[]
  omitidos: FijoOmitido[]
  fechas: FijoFecha[]
  movimientos: Movimiento[]
  grupos: Grupo[]
  otrosSaldos: OtroSaldo[]
  historial: ActualizacionSaldo[]
}

/** Copia de seguridad completa (archivo JSON que descarga el usuario). */
export interface CopiaSeguridad {
  formato: 'txobank-copia'
  version: 1
  creada: FechaHora
  /** Versión de la app que la hizo. */
  versionApp: string
  economias: EconomiaEnCopia[]
}

export interface CopiaApi {
  /** Todos los datos de todas las economías a las que tiene acceso el usuario. */
  exportar(): Promise<EconomiaEnCopia[]>
  /**
   * Crea las economías de la copia, con sus ids tal cual (ya renombrados y con ids nuevos: ver
   * `src/lib/copia.ts`). No toca las economías que ya existen. Si algo falla, borra lo que llegó a crear.
   */
  restaurar(economias: EconomiaEnCopia[]): Promise<void>
}

export interface SesionApi {
  iniciar(email: string, password: string): Promise<Sesion>
  cerrar(): Promise<void>
  actual(): Promise<Sesion | null>
  /** Avisa de cada cambio de sesión. Devuelve la función para dejar de escuchar. */
  alCambiar(cb: (sesion: Sesion | null) => void): () => void
  /** ¿Tiene activada la verificación en dos pasos? */
  mfaActiva(): Promise<boolean>
  /** Empieza a activar la verificación en dos pasos (descarta intentos anteriores sin terminar). */
  inscribirMfa(): Promise<InscripcionMfa>
  /** Termina de activarla con el primer código de la app autenticadora. */
  confirmarMfa(factorId: string, codigo: string): Promise<void>
  /** Introduce el código al iniciar sesión (cuando `faltaCodigo`). */
  verificarCodigo(codigo: string): Promise<void>
  desactivarMfa(): Promise<void>
}

/**
 * Único punto de acceso a datos para las pantallas.
 * Cubre sesión, economías y, dentro de la economía activa, ajustes, cuentas, categorías, movimientos, fijos,
 * presupuestos, saldos, grupos y otros saldos.
 */
export interface DataSource {
  sesion: SesionApi
  economias: EconomiasApi
  ajustes: AjustesApi
  cuentas: CuentasApi
  categorias: CategoriasApi
  movimientos: MovimientosApi
  fijos: FijosApi
  presupuestos: PresupuestosApi
  saldos: SaldosApi
  grupos: GruposApi
  otrosSaldos: OtrosSaldosApi
  copia: CopiaApi
}
