import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  mensajeError,
  useAccionesMovimiento,
  useCategorias,
  useCrearCategoria,
  useCuentas,
  useMovimientos,
} from '../data/hooks'
import type { Movimiento, NuevoMovimiento, TipoCategoria, TipoMovimiento } from '../data/types'
import { colorPorPosicion } from '../lib/catalogo'
import { aTextoEditable, parseImporte } from '../lib/dinero'
import { fijoDesdeMovimiento } from '../lib/fijos'
import { hoyISO, mesDeFecha, nombreMes, sumarDias, sumarMeses } from '../lib/meses'
import {
  detectarFrecuentes,
  ordenarPorUso,
  sugerirCategoria,
  sugerirConceptos,
  ultimaCuentaUsada,
  validarMovimiento,
} from '../lib/movimientos'
import type { Frecuente } from '../lib/movimientos'
import { useAccionesFijos } from '../data/consultas'
import { useAviso } from './Avisos'
import { useFmt } from './Discreto'
import { Hoja } from './Hoja'
import { useAvisoGuardado } from './useAvisoGuardado'

/** Datos con los que rellenar una hoja nueva (por ejemplo al duplicar). */
export type Plantilla = Partial<Omit<Movimiento, 'id'>>

export type PeticionHoja = { tipo: 'nuevo'; plantilla?: Plantilla } | { tipo: 'editar'; movimiento: Movimiento }

interface Props {
  peticion: PeticionHoja
  onCerrar: () => void
  onDuplicar: (plantilla: Plantilla) => void
}

type TipoUi = 'gasto' | 'ingreso' | 'traspaso'
type Imputar = 'antes' | 'propio' | 'despues'

const ETIQUETA_GUARDAR: Record<TipoMovimiento, string> = {
  gasto: 'Guardar gasto',
  ingreso: 'Guardar ingreso',
  devolucion: 'Guardar devolución',
  traspaso: 'Guardar traspaso',
}

export function HojaMovimiento({ peticion, onCerrar, onDuplicar }: Props) {
  const hoy = hoyISO()
  const aviso = useAviso()
  const acciones = useAccionesMovimiento()
  const accionesFijos = useAccionesFijos()
  const avisar = useAvisoGuardado()
  const fmt = useFmt()
  const crearCategoria = useCrearCategoria()
  const cuentas = useCuentas().data ?? []
  const categorias = useCategorias().data ?? []
  const recientes = useMovimientos(sumarDias(hoy, -90), hoy).data ?? []

  const editando = peticion.tipo === 'editar' ? peticion.movimiento : null
  const base: Plantilla = peticion.tipo === 'editar' ? peticion.movimiento : (peticion.plantilla ?? {})
  const esPlantilla = peticion.tipo === 'nuevo' && peticion.plantilla !== undefined

  const cuentasActivas = cuentas.filter((c) => !c.archivada)
  const cuentaPorDefecto = () => {
    const ultima = ultimaCuentaUsada(recientes)
    return cuentasActivas.find((c) => c.id === ultima)?.id ?? cuentasActivas[0]?.id ?? ''
  }

  const [tipoUi, setTipoUi] = useState<TipoUi>(
    base.tipo === 'ingreso' || base.tipo === 'devolucion' ? 'ingreso' : base.tipo === 'traspaso' ? 'traspaso' : 'gasto',
  )
  const [devolucion, setDevolucion] = useState(base.tipo === 'devolucion')
  const [importe, setImporte] = useState(base.importe ? aTextoEditable(base.importe) : '')
  const [categoriaId, setCategoriaId] = useState<string | null>(base.categoriaId ?? null)
  const [fecha, setFecha] = useState(base.fecha ?? hoy)
  const [cuentaId, setCuentaId] = useState(base.cuentaId ?? cuentaPorDefecto())
  const [destinoId, setDestinoId] = useState(
    base.cuentaDestinoId ?? cuentasActivas.find((c) => c.id !== (base.cuentaId ?? cuentaPorDefecto()))?.id ?? '',
  )
  const [nota, setNota] = useState(base.nota ?? '')
  const [imputar, setImputar] = useState<Imputar>(() => {
    if (!base.mesImputado || !base.fecha) return 'propio'
    const propio = mesDeFecha(base.fecha)
    if (base.mesImputado === sumarMeses(propio, -1)) return 'antes'
    if (base.mesImputado === sumarMeses(propio, 1)) return 'despues'
    return 'propio'
  })
  const [enfocado, setEnfocado] = useState(false)
  const [nueva, setNueva] = useState<{ nombre: string; icono: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [esFijo, setEsFijo] = useState(false)

  const tipoMov: TipoMovimiento = tipoUi === 'ingreso' && devolucion ? 'devolucion' : tipoUi
  const tipoCat: TipoCategoria = tipoUi === 'ingreso' && !devolucion ? 'ingreso' : 'gasto'
  const esIngresoPuro = tipoMov === 'ingreso'

  // Categorías del tipo, sin archivadas (salvo la ya elegida), las más usadas primero.
  const delTipo = categorias.filter((c) => c.tipo === tipoCat)
  const visibles = ordenarPorUso(
    delTipo.filter((c) => !c.archivada || c.id === categoriaId),
    recientes,
    hoy,
  )

  const frecuentes: Frecuente[] =
    !editando && !esPlantilla && tipoUi === 'gasto'
      ? detectarFrecuentes(recientes, hoy).filter((f) => visibles.some((c) => c.id === f.categoriaId))
      : []
  const sugerencias = enfocado && tipoUi !== 'traspaso' ? sugerirConceptos(nota, recientes, tipoCat) : []

  const cuentaPropia = cuentas.find((c) => c.id === cuentaId)
  const opcionesCuenta = cuentas.filter((c) => !c.archivada || c.id === cuentaId)
  const opcionesDestino = cuentas.filter((c) => !c.archivada || c.id === destinoId)
  const mesPropio = mesDeFecha(fecha)

  function cambiarTipo(t: TipoUi) {
    if (t === tipoUi) return
    setTipoUi(t)
    setDevolucion(false)
    setCategoriaId(null)
    setNueva(null)
  }

  function alternarDevolucion(valor: boolean) {
    setDevolucion(valor)
    // Devolución y gasto comparten categorías; ingreso normal usa las suyas.
    if (!valor) setCategoriaId(null)
  }

  function aplicarFrecuente(f: Frecuente) {
    setImporte(aTextoEditable(f.importe))
    setCategoriaId(f.categoriaId)
    setNota(f.nota)
    if (cuentasActivas.some((c) => c.id === f.cuentaId)) setCuentaId(f.cuentaId)
    setError(null)
  }

  function elegirConcepto(concepto: string) {
    setNota(concepto)
    setEnfocado(false)
    const sugerida = sugerirCategoria(concepto, recientes, tipoCat)
    if (sugerida && visibles.some((c) => c.id === sugerida)) setCategoriaId(sugerida)
  }

  async function guardarCategoriaNueva() {
    if (!nueva) return
    const nombre = nueva.nombre.trim()
    if (!nombre) return setError('Escribe un nombre para la categoría.')
    setError(null)
    const [primero] = new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(nueva.icono.trim())
    try {
      const creada = await crearCategoria.mutateAsync({
        nombre,
        tipo: tipoCat,
        color: colorPorPosicion(delTipo.length),
        icono: primero?.segment ?? null,
        orden: delTipo.reduce((max, c) => Math.max(max, c.orden + 1), 0),
        archivada: false,
      })
      setCategoriaId(creada.id)
      setNueva(null)
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const centimos = parseImporte(importe)
    if (centimos === null) return setError('Escribe un importe válido.')

    const esTraspaso = tipoMov === 'traspaso'
    const mesImputado = !esIngresoPuro || imputar === 'propio' ? null : sumarMeses(mesPropio, imputar === 'antes' ? -1 : 1)
    const datos = {
      tipo: tipoMov,
      importe: centimos,
      fecha,
      cuentaId,
      cuentaDestinoId: esTraspaso ? destinoId || null : null,
      categoriaId: esTraspaso ? null : categoriaId,
      nota: nota.trim(),
      mesImputado,
    }
    const fallo = validarMovimiento(datos)
    if (fallo) return setError(fallo)
    if (esFijo && !editando && tipoMov !== 'devolucion' && !nota.trim()) {
      return setError('Escribe un concepto: será el nombre del fijo.')
    }

    setEnviando(true)
    try {
      if (editando) {
        await acciones.actualizar(editando.id, datos)
        aviso.mostrar('Cambios guardados')
      } else if (esFijo && tipoMov !== 'devolucion') {
        // "Es fijo": se crea el fijo con estos datos y este mes queda como pagado.
        const plan = fijoDesdeMovimiento(datos, nota)!
        const fijo = await accionesFijos.crear(plan.fijo)
        let creado
        try {
          creado = await acciones.crear({ ...datos, fijoId: fijo.id, fijoMes: plan.mes })
        } catch (err) {
          await accionesFijos.borrar(fijo.id).catch(() => undefined)
          throw err
        }
        void avisar(creado, async () => {
          await acciones.borrar(creado.id)
          await accionesFijos.borrar(fijo.id)
        })
      } else {
        const nuevoMov: NuevoMovimiento = { ...datos, fijoId: null, fijoMes: null }
        void avisar(await acciones.crear(nuevoMov))
      }
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  async function eliminar() {
    if (!editando) return
    setEnviando(true)
    try {
      await acciones.borrar(editando.id)
      const { id: _id, ...copia } = editando
      aviso.mostrar('Movimiento eliminado', { etiqueta: 'Deshacer', alHacer: () => acciones.crear(copia) })
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  function duplicar() {
    if (!editando) return
    const { id: _id, ...copia } = editando
    onDuplicar({ ...copia, fecha: hoy, fijoId: null, fijoMes: null, mesImputado: null })
  }

  const chipCategoria = (c: { id: string; nombre: string; icono: string | null }) => (
    <button
      key={c.id}
      type="button"
      className={categoriaId === c.id ? 'chip activo' : 'chip'}
      aria-pressed={categoriaId === c.id}
      onClick={() => setCategoriaId(c.id)}
    >
      {c.icono ? `${c.icono} ` : ''}
      {c.nombre}
    </button>
  )

  return (
    <Hoja titulo={editando ? 'Editar movimiento' : 'Nuevo movimiento'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="formulario">
        <div className="segmentado" role="tablist" aria-label="Tipo de movimiento">
          {(['gasto', 'ingreso', 'traspaso'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tipoUi === t}
              className={tipoUi === t ? 'activa' : ''}
              onClick={() => cambiarTipo(t)}
            >
              {t === 'gasto' ? 'Gasto' : t === 'ingreso' ? 'Ingreso' : 'Traspaso'}
            </button>
          ))}
        </div>

        {tipoUi === 'ingreso' && (
          <label className="casilla">
            <input type="checkbox" checked={devolucion} onChange={(e) => alternarDevolucion(e.target.checked)} />
            Es una devolución (un Bizum de amigos, la devolución de una compra…)
          </label>
        )}

        {frecuentes.length > 0 && (
          <div className="frecuentes" aria-label="Gastos frecuentes">
            {frecuentes.map((f) => {
              const cat = categorias.find((c) => c.id === f.categoriaId)
              return (
                <button key={`${f.nota}|${f.categoriaId}`} type="button" className="chip" onClick={() => aplicarFrecuente(f)}>
                  {cat?.icono ? `${cat.icono} ` : ''}
                  {f.nota} {fmt(f.importe)}
                </button>
              )
            })}
          </div>
        )}

        <input
          className="importe-grande"
          inputMode="decimal"
          placeholder="0,00"
          aria-label="Importe en euros"
          autoFocus={!editando}
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
        />

        {tipoUi !== 'traspaso' ? (
          <div className="campo">
            Categoría
            <div className="chips">
              {visibles.map(chipCategoria)}
              <button type="button" className="chip nueva" onClick={() => setNueva({ nombre: '', icono: '' })}>
                + Nueva
              </button>
            </div>
            {nueva && (
              <div className="mini-form">
                <input
                  autoFocus
                  placeholder="Nombre"
                  aria-label="Nombre de la nueva categoría"
                  value={nueva.nombre}
                  onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void guardarCategoriaNueva()
                    }
                  }}
                />
                <input
                  className="emoji"
                  placeholder="🙂"
                  aria-label="Emoji (opcional)"
                  value={nueva.icono}
                  onChange={(e) => setNueva({ ...nueva, icono: e.target.value })}
                />
                <button type="button" className="secundario-btn" onClick={() => void guardarCategoriaNueva()}>
                  Crear
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="dos-columnas">
            <label className="campo">
              Desde
              <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
                {opcionesCuenta.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              Hacia
              <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
                <option value="">Elige…</option>
                {opcionesDestino.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="linea">
          <label className="campo">
            Fecha{fecha === hoy ? ' (hoy)' : ''}
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          {tipoUi !== 'traspaso' && (
            <label className="campo">
              Cuenta
              <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
                {opcionesCuenta.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {esIngresoPuro && (
          <label className="campo">
            Cuenta para
            <select value={imputar} onChange={(e) => setImputar(e.target.value as Imputar)}>
              <option value="antes">{nombreMes(sumarMeses(mesPropio, -1))} (mes anterior)</option>
              <option value="propio">{nombreMes(mesPropio)}</option>
              <option value="despues">{nombreMes(sumarMeses(mesPropio, 1))} (mes siguiente)</option>
            </select>
          </label>
        )}

        <div className="campo concepto">
          Concepto (opcional)
          <input
            value={nota}
            placeholder={tipoUi === 'traspaso' ? 'Ahorro del mes' : 'Café, Mercadona…'}
            autoComplete="off"
            onChange={(e) => setNota(e.target.value)}
            onFocus={() => setEnfocado(true)}
            onBlur={() => setTimeout(() => setEnfocado(false), 150)}
          />
          {sugerencias.length > 0 && (
            <ul className="sugerencias">
              {sugerencias.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => elegirConcepto(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!editando && tipoMov !== 'devolucion' && (
          <label className="casilla">
            <input type="checkbox" checked={esFijo} onChange={(e) => setEsFijo(e.target.checked)} />
            <span>
              Es fijo
              {esFijo && (
                <span className="secundario pequeno bloque">
                  Crea un fijo mensual con estos datos (día {Number(fecha.slice(8))}) y deja este mes como pagado. El
                  concepto será su nombre.
                </span>
              )}
            </span>
          </label>
        )}

        {cuentaPropia?.archivada && <p className="secundario pequeno">Esta cuenta está archivada.</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primario" disabled={enviando}>
          {enviando ? 'Guardando…' : editando ? 'Guardar cambios' : ETIQUETA_GUARDAR[tipoMov]}
        </button>

        {editando &&
          (confirmarBorrado ? (
            <div className="confirmar">
              <span>¿Eliminar este movimiento?</span>
              <button type="button" className="secundario-btn" onClick={() => setConfirmarBorrado(false)}>
                Cancelar
              </button>
              <button type="button" className="peligro" disabled={enviando} onClick={() => void eliminar()}>
                Eliminar
              </button>
            </div>
          ) : (
            <div className="dos-columnas">
              <button type="button" className="secundario-btn" onClick={duplicar}>
                Duplicar
              </button>
              <button type="button" className="secundario-btn borrar" onClick={() => setConfirmarBorrado(true)}>
                Eliminar
              </button>
            </div>
          ))}
      </form>
    </Hoja>
  )
}
