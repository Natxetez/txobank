import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useEconomia } from '../data/EconomiaContext'
import {
  mensajeError,
  useAccionesMovimiento,
  useCategorias,
  useCrearCategoria,
  useCuentas,
  useMovimientos,
} from '../data/hooks'
import type {
  Grupo,
  Movimiento,
  NuevoMovimiento,
  TipoCategoria,
  TipoMovimiento,
  TraspasoEconomias,
} from '../data/types'
import { colorPorPosicion } from '../lib/catalogo'
import { aTextoEditable, parseImporte } from '../lib/dinero'
import { validarTraspasoEconomias } from '../lib/economias'
import { fijoDesdeMovimiento } from '../lib/fijos'
import { ordenarGrupos, siguienteOrdenGrupo, validarGrupo } from '../lib/grupos'
import { horaActual, hoyISO, mesDeFecha, nombreMes, sumarDias, sumarMeses } from '../lib/meses'
import {
  detectarFrecuentes,
  ordenarPorUso,
  sugerirCategoria,
  sugerirConceptos,
  ultimaCuentaUsada,
  validarMovimiento,
} from '../lib/movimientos'
import type { Frecuente } from '../lib/movimientos'
import {
  opcTraspasoEconomias,
  useAccionesFijos,
  useAccionesGrupos,
  useCategoriasDeTodas,
  useGrupos,
} from '../data/consultas'
import { useAviso } from './Avisos'
import { useFmt } from './Discreto'
import { Hoja } from './Hoja'
import { OpcionesCuentas, useCuentasConEconomia } from './OpcionesCuentas'
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

/**
 * Hoja de nuevo movimiento o de edición. Si el movimiento es una mitad de un traspaso entre economías,
 * primero carga el traspaso completo para editar las dos mitades a la vez.
 */
export function HojaMovimiento(props: Props) {
  const traspasoId = props.peticion.tipo === 'editar' ? props.peticion.movimiento.traspasoId : null
  const traspaso = useQuery({ ...opcTraspasoEconomias(traspasoId ?? ''), enabled: traspasoId !== null })
  if (traspasoId && traspaso.isPending) {
    return (
      <Hoja titulo="Editar movimiento" onCerrar={props.onCerrar}>
        <p className="secundario">Cargando…</p>
      </Hoja>
    )
  }
  return <FormularioMovimiento {...props} traspaso={traspasoId ? (traspaso.data ?? null) : null} />
}

function FormularioMovimiento({
  peticion,
  onCerrar,
  onDuplicar,
  traspaso,
}: Props & { traspaso: TraspasoEconomias | null }) {
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
  const grupos = useGrupos().data ?? []
  const accionesGrupos = useAccionesGrupos()
  const { activa } = useEconomia()
  const { todas, economiaDe, nombreEconomia, agrupar } = useCuentasConEconomia()
  const categoriasDeTodas = useCategoriasDeTodas().data ?? []

  const editando = peticion.tipo === 'editar' ? peticion.movimiento : null
  // Un traspaso entre economías se edita como traspaso, con las cuentas de sus dos mitades.
  const base: Plantilla = traspaso
    ? {
        tipo: 'traspaso',
        importe: traspaso.importe,
        fecha: traspaso.fecha,
        cuentaId: traspaso.origen.cuentaId,
        cuentaDestinoId: traspaso.destino.cuentaId,
        nota: traspaso.nota,
        descripcion: traspaso.descripcion,
      }
    : peticion.tipo === 'editar'
      ? peticion.movimiento
      : (peticion.plantilla ?? {})
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
  const [descripcion, setDescripcion] = useState(base.descripcion ?? '')
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
  // Grupo de gastos: solo en gastos. La hora se edita en las entradas de grupos.
  const [grupoId, setGrupoId] = useState<string | null>(
    base.tipo === undefined || base.tipo === 'gasto' ? (base.grupoId ?? null) : null,
  )
  const [hora, setHora] = useState(editando ? (editando.hora ?? '') : horaActual())
  const [nuevoGrupo, setNuevoGrupo] = useState<{ nombre: string; categoriaId: string | null } | null>(null)
  // Traspaso entre economías: categoría de gasto en el origen y de ingreso en el destino.
  const [catOrigen, setCatOrigen] = useState(traspaso?.origen.categoriaId ?? '')
  const [catDestino, setCatDestino] = useState(traspaso?.destino.categoriaId ?? '')

  const tipoMov: TipoMovimiento = tipoUi === 'ingreso' && devolucion ? 'devolucion' : tipoUi
  const tipoCat: TipoCategoria = tipoUi === 'ingreso' && !devolucion ? 'ingreso' : 'gasto'
  const esIngresoPuro = tipoMov === 'ingreso'
  const enGrupo = tipoMov === 'gasto' && grupoId !== null
  const grupo = enGrupo ? grupos.find((g) => g.id === grupoId) : undefined
  const catGrupo = grupo ? categorias.find((c) => c.id === grupo.categoriaId) : undefined
  const gruposVisibles = ordenarGrupos(grupos.filter((g) => !g.archivado || g.id === grupoId))

  // Categorías del tipo, sin archivadas (salvo la ya elegida), las más usadas primero.
  const delTipo = categorias.filter((c) => c.tipo === tipoCat)
  const visibles = ordenarPorUso(
    delTipo.filter((c) => !c.archivada || c.id === categoriaId),
    recientes,
    hoy,
  )

  const frecuentes: Frecuente[] =
    !editando && !esPlantilla && tipoUi === 'gasto' && !enGrupo
      ? detectarFrecuentes(recientes, hoy).filter((f) => visibles.some((c) => c.id === f.categoriaId))
      : []
  const sugerencias = enfocado && tipoUi !== 'traspaso' && !enGrupo ? sugerirConceptos(nota, recientes, tipoCat) : []

  // En los traspasos se puede elegir una cuenta de otra economía (si hay más de una).
  const ecoOrigen = economiaDe(cuentaId)
  const ecoDestino = economiaDe(destinoId)
  const entreEconomias = tipoUi === 'traspaso' && destinoId !== '' && ecoOrigen !== ecoDestino
  const categoriasEn = (economiaId: string, tipo: TipoCategoria, elegida: string) =>
    categoriasDeTodas.filter((c) => c.economiaId === economiaId && c.tipo === tipo && (!c.archivada || c.id === elegida))
  const opcionesCatOrigen = entreEconomias ? categoriasEn(ecoOrigen, 'gasto', catOrigen) : []
  const opcionesCatDestino = entreEconomias ? categoriasEn(ecoDestino, 'ingreso', catDestino) : []
  const catOrigenValida = opcionesCatOrigen.some((c) => c.id === catOrigen) ? catOrigen : ''
  const catDestinoValida = opcionesCatDestino.some((c) => c.id === catDestino) ? catDestino : ''

  const cuentaPropia = todas.find((c) => c.id === cuentaId)
  const opcionesCuenta = cuentas.filter((c) => !c.archivada || c.id === cuentaId)
  const opcionesDestino = cuentas.filter((c) => !c.archivada || c.id === destinoId)
  const mesPropio = mesDeFecha(fecha)

  function cambiarTipo(t: TipoUi) {
    if (t === tipoUi) return
    setTipoUi(t)
    // Fuera de los traspasos solo valen cuentas de esta economía.
    if (!cuentas.some((c) => c.id === cuentaId)) setCuentaId(cuentaPorDefecto())
    setDevolucion(false)
    setCategoriaId(null)
    setNueva(null)
    setNuevoGrupo(null)
    soltarGrupo()
  }

  /** Mete el gasto en un grupo: la categoría y el concepto pasan a ser los del grupo. */
  function seleccionarGrupo(g: Grupo) {
    setGrupoId(g.id)
    setCategoriaId(g.categoriaId)
    setNota(g.nombre)
    setEsFijo(false)
    setNueva(null)
    if (!hora) setHora(horaActual())
  }

  /** Vuelve a gasto suelto; el concepto del grupo se quita para escribir uno propio. */
  function soltarGrupo() {
    const actual = grupos.find((g) => g.id === grupoId)
    setGrupoId(null)
    if (actual && nota === actual.nombre) setNota('')
  }

  function elegirGrupo(g: Grupo) {
    setNuevoGrupo(null)
    setError(null)
    if (grupoId === g.id) soltarGrupo()
    else seleccionarGrupo(g)
  }

  async function guardarGrupoNuevo() {
    if (!nuevoGrupo) return
    const fallo = validarGrupo(nuevoGrupo, categorias, grupos)
    if (fallo) return setError(fallo)
    setError(null)
    try {
      const creado = await accionesGrupos.crear({
        nombre: nuevoGrupo.nombre.trim(),
        categoriaId: nuevoGrupo.categoriaId!,
        orden: siguienteOrdenGrupo(grupos),
        archivado: false,
      })
      setNuevoGrupo(null)
      seleccionarGrupo(creado)
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  function alternarDevolucion(valor: boolean) {
    setDevolucion(valor)
    // Devolución y gasto comparten categorías; ingreso normal usa las suyas.
    if (!valor) setCategoriaId(null)
  }

  function aplicarFrecuente(f: Frecuente) {
    setGrupoId(null)
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
    if (entreEconomias) return guardarEntreEconomias(centimos)
    if (ecoOrigen !== activa.id) return setError(`Elige una cuenta de ${activa.nombre}.`)
    const mesImputado = !esIngresoPuro || imputar === 'propio' ? null : sumarMeses(mesPropio, imputar === 'antes' ? -1 : 1)
    const datos = {
      tipo: tipoMov,
      importe: centimos,
      fecha,
      cuentaId,
      cuentaDestinoId: esTraspaso ? destinoId || null : null,
      // En un grupo, la categoría y el concepto son siempre los del grupo.
      categoriaId: esTraspaso ? null : (grupo?.categoriaId ?? categoriaId),
      nota: grupo ? grupo.nombre : nota.trim(),
      descripcion: descripcion.trim(),
      mesImputado,
      grupoId: enGrupo ? grupoId : null,
      // Entradas de grupo: la hora elegida. Al editar un suelto se conserva la suya; uno nuevo lleva la actual.
      hora: enGrupo || editando ? hora || null : horaActual(),
    }
    const fallo = validarMovimiento(datos)
    if (fallo) return setError(fallo)
    const crearFijo = esFijo && !editando && !enGrupo && tipoMov !== 'devolucion'
    if (crearFijo && !nota.trim()) {
      return setError('Escribe un concepto: será el nombre del fijo.')
    }

    setEnviando(true)
    try {
      if (editando?.traspasoId) {
        // Deja de ser un traspaso entre economías: se apunta el nuevo y se borran las dos mitades.
        await acciones.crear({ ...datos, fijoId: null, fijoMes: null, traspasoId: null })
        await acciones.eliminar(editando)
        aviso.mostrar('Cambios guardados')
      } else if (editando) {
        await acciones.actualizar(editando.id, datos)
        aviso.mostrar('Cambios guardados')
      } else if (crearFijo) {
        // "Es fijo": se crea el fijo con estos datos y este mes queda como pagado.
        const plan = fijoDesdeMovimiento(datos, nota)!
        const fijo = await accionesFijos.crear(plan.fijo)
        let creado
        try {
          creado = await acciones.crear({
            ...datos,
            fijoId: fijo.id,
            fijoMes: plan.mes,
            grupoId: null,
            hora: horaActual(),
            traspasoId: null,
          })
        } catch (err) {
          await accionesFijos.borrar(fijo.id).catch(() => undefined)
          throw err
        }
        void avisar(creado, async () => {
          await acciones.borrar(creado.id)
          await accionesFijos.borrar(fijo.id)
        })
      } else {
        const nuevoMov: NuevoMovimiento = { ...datos, fijoId: null, fijoMes: null, traspasoId: null }
        void avisar(await acciones.crear(nuevoMov))
      }
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  /** Traspaso a una cuenta de otra economía: un gasto en la de origen y un ingreso en la de destino. */
  async function guardarEntreEconomias(centimos: number) {
    if (ecoOrigen !== activa.id && ecoDestino !== activa.id) {
      return setError(`Una de las dos cuentas tiene que ser de ${activa.nombre}.`)
    }
    const t: TraspasoEconomias = {
      importe: centimos,
      fecha,
      hora: traspaso ? traspaso.hora : (editando?.hora ?? horaActual()),
      nota: nota.trim(),
      descripcion: descripcion.trim(),
      origen: { economiaId: ecoOrigen, cuentaId, categoriaId: catOrigenValida },
      destino: { economiaId: ecoDestino, cuentaId: destinoId, categoriaId: catDestinoValida },
      fijoId: traspaso?.fijoId ?? null,
      fijoMes: traspaso?.fijoMes ?? null,
    }
    const fallo = validarTraspasoEconomias(t)
    if (fallo) return setError(fallo)
    const crearFijo = esFijo && !editando
    if (crearFijo && !t.nota) return setError('Escribe un concepto: será el nombre del fijo.')
    if (crearFijo && ecoOrigen !== activa.id) {
      return setError(`Para que sea fijo, la cuenta de origen tiene que ser de ${activa.nombre}.`)
    }

    setEnviando(true)
    try {
      if (editando?.traspasoId && traspaso) {
        await acciones.actualizarTraspaso(editando.traspasoId, t)
        aviso.mostrar('Cambios guardados')
      } else if (editando) {
        // Pasa a ser un traspaso entre economías: se apunta el nuevo y se borra el anterior.
        await acciones.crearTraspaso(t)
        await acciones.eliminar(editando)
        aviso.mostrar('Cambios guardados')
      } else if (crearFijo) {
        const mes = mesDeFecha(fecha)
        const fijo = await accionesFijos.crear({
          nombre: t.nota,
          descripcion: t.descripcion,
          tipo: 'gasto',
          importe: centimos,
          cuentaId,
          cuentaDestinoId: destinoId,
          categoriaId: t.origen.categoriaId,
          categoriaDestinoId: t.destino.categoriaId,
          diaMes: Number(fecha.slice(8)),
          cadaMeses: 1,
          desde: mes,
          hasta: null,
          activo: true,
        })
        let creado
        try {
          creado = await acciones.crearTraspaso({ ...t, fijoId: fijo.id, fijoMes: mes })
        } catch (err) {
          await accionesFijos.borrar(fijo.id).catch(() => undefined)
          throw err
        }
        void avisar(creado, async () => {
          await acciones.eliminar(creado)
          await accionesFijos.borrar(fijo.id)
        })
      } else {
        void avisar(await acciones.crearTraspaso(t))
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
      const deshacer = await acciones.eliminar(editando)
      aviso.mostrar('Movimiento eliminado', { etiqueta: 'Deshacer', alHacer: deshacer })
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  function duplicar() {
    if (!editando) return
    const { id: _id, ...copia } = editando
    // Conserva el grupo; la copia es de hoy y de ahora.
    onDuplicar({ ...copia, fecha: hoy, hora: horaActual(), fijoId: null, fijoMes: null, mesImputado: null, traspasoId: null })
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

        {tipoUi === 'gasto' && (
          <div className="frecuentes grupos-chips" aria-label="Grupos de gastos">
            {gruposVisibles.map((g) => {
              const cat = categorias.find((c) => c.id === g.categoriaId)
              const activo = grupoId === g.id
              return (
                <button
                  key={g.id}
                  type="button"
                  className={activo ? 'chip grupo activo' : 'chip grupo'}
                  aria-pressed={activo}
                  onClick={() => elegirGrupo(g)}
                >
                  {cat?.icono ? `${cat.icono} ` : ''}
                  {g.nombre}
                </button>
              )
            })}
            <button
              type="button"
              className="chip nueva"
              aria-expanded={nuevoGrupo !== null}
              onClick={() =>
                setNuevoGrupo(
                  nuevoGrupo
                    ? null
                    : { nombre: '', categoriaId: categoriaId ?? visibles.find((c) => !c.archivada)?.id ?? null },
                )
              }
            >
              + Grupo
            </button>
          </div>
        )}

        {tipoUi === 'gasto' && nuevoGrupo && (
          <div className="grupo-nuevo">
            <input
              autoFocus
              placeholder="Nombre del grupo (Cafés y pintxos…)"
              aria-label="Nombre del nuevo grupo"
              maxLength={60}
              value={nuevoGrupo.nombre}
              onChange={(e) => setNuevoGrupo({ ...nuevoGrupo, nombre: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void guardarGrupoNuevo()
                }
              }}
            />
            <div className="grupo-nuevo-fila">
              <select
                aria-label="Categoría del nuevo grupo"
                value={nuevoGrupo.categoriaId ?? ''}
                onChange={(e) => setNuevoGrupo({ ...nuevoGrupo, categoriaId: e.target.value || null })}
              >
                <option value="" disabled>
                  Categoría…
                </option>
                {visibles
                  .filter((c) => !c.archivada)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icono ? `${c.icono} ` : ''}
                      {c.nombre}
                    </option>
                  ))}
              </select>
              <button type="button" className="secundario-btn" onClick={() => void guardarGrupoNuevo()}>
                Crear
              </button>
            </div>
          </div>
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

        {enGrupo ? (
          <p className="grupo-categoria">
            {catGrupo?.icono ? `${catGrupo.icono} ` : ''}
            {catGrupo?.nombre ?? 'Sin categoría'} · del grupo
          </p>
        ) : tipoUi !== 'traspaso' ? (
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
                <OpcionesCuentas cuentas={opcionesCuenta} porEconomia={agrupar(cuentaId)} />
              </select>
            </label>
            <label className="campo">
              Hacia
              <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
                <option value="">Elige…</option>
                <OpcionesCuentas cuentas={opcionesDestino} porEconomia={agrupar(destinoId)} />
              </select>
            </label>
          </div>
        )}

        {entreEconomias && (
          <div className="entre-economias">
            <p className="ayuda">
              Traspaso entre economías: cuenta como gasto en {nombreEconomia(ecoOrigen)} y como ingreso en{' '}
              {nombreEconomia(ecoDestino)}.
            </p>
            <label className="campo">
              Gasto en {nombreEconomia(ecoOrigen)}
              <select value={catOrigenValida} onChange={(e) => setCatOrigen(e.target.value)}>
                <option value="">Elige categoría…</option>
                {opcionesCatOrigen.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icono ? `${c.icono} ` : ''}
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              Ingreso en {nombreEconomia(ecoDestino)}
              <select value={catDestinoValida} onChange={(e) => setCatDestino(e.target.value)}>
                <option value="">Elige categoría…</option>
                {opcionesCatDestino.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icono ? `${c.icono} ` : ''}
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
          {enGrupo && (
            <label className="campo">
              Hora
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </label>
          )}
          {tipoUi !== 'traspaso' && !enGrupo && (
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

        {enGrupo && (
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

        {!enGrupo && (
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
        )}

        <label className="campo">
          Descripción (opcional)
          <textarea
            rows={2}
            value={descripcion}
            placeholder="Detalles que quieras recordar"
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </label>

        {!editando && !enGrupo && tipoMov !== 'devolucion' && (
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
          {enviando
            ? 'Guardando…'
            : editando
              ? 'Guardar cambios'
              : grupo
                ? `Guardar en ${grupo.nombre}`
                : ETIQUETA_GUARDAR[tipoMov]}
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
            <div className={traspaso ? '' : 'dos-columnas'}>
              {!traspaso && (
                <button type="button" className="secundario-btn" onClick={duplicar}>
                  Duplicar
                </button>
              )}
              <button type="button" className="secundario-btn borrar" onClick={() => setConfirmarBorrado(true)}>
                Eliminar
              </button>
            </div>
          ))}
      </form>
    </Hoja>
  )
}
