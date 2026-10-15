import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAccionesGrupos, useGrupos } from '../data/consultas'
import { mensajeError, useCategorias } from '../data/hooks'
import type { Grupo } from '../data/types'
import { siguienteOrdenGrupo, validarGrupo } from '../lib/grupos'
import { Hoja } from './Hoja'

interface Props {
  /** Si se pasa, se edita ese grupo; si no, se crea uno nuevo. */
  grupo?: Grupo
  onCerrar: () => void
}

/** Hoja para crear, editar, archivar o eliminar un grupo de gastos. */
export function HojaGrupo({ grupo, onCerrar }: Props) {
  const acciones = useAccionesGrupos()
  const grupos = useGrupos().data ?? []
  const categorias = useCategorias().data ?? []

  const [nombre, setNombre] = useState(grupo?.nombre ?? '')
  const [categoriaId, setCategoriaId] = useState<string | null>(grupo?.categoriaId ?? null)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)

  const deGasto = categorias.filter((c) => c.tipo === 'gasto' && (!c.archivada || c.id === categoriaId))
  const cambiaCategoria = grupo !== undefined && categoriaId !== grupo.categoriaId

  async function ejecutar(accion: () => Promise<unknown>) {
    setError(null)
    setEnviando(true)
    try {
      await accion()
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  function guardar(e: FormEvent) {
    e.preventDefault()
    const fallo = validarGrupo({ nombre, categoriaId }, categorias, grupos, grupo?.id)
    if (fallo) return setError(fallo)
    const datos = { nombre: nombre.trim(), categoriaId: categoriaId! }
    void ejecutar(() =>
      grupo
        ? acciones.actualizar(grupo.id, datos)
        : acciones.crear({ ...datos, orden: siguienteOrdenGrupo(grupos), archivado: false }),
    )
  }

  return (
    <Hoja titulo={grupo ? 'Editar grupo' : 'Nuevo grupo'} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={guardar}>
        <label className="campo">
          Nombre
          <input
            autoFocus={!grupo}
            value={nombre}
            placeholder="Cafés y pintxos, Taxis…"
            maxLength={60}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <div className="campo">
          Categoría de todas sus entradas
          <div className="chips">
            {deGasto.map((c) => (
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
            ))}
          </div>
        </div>
        {cambiaCategoria && (
          <p className="ayuda">Las entradas ya apuntadas en este grupo pasarán también a la nueva categoría.</p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primario" disabled={enviando}>
          {enviando ? 'Guardando…' : grupo ? 'Guardar cambios' : 'Crear grupo'}
        </button>
      </form>

      {grupo && (
        <div className="zona-borrar">
          <button
            type="button"
            className="secundario-btn"
            disabled={enviando}
            onClick={() => void ejecutar(() => acciones.actualizar(grupo.id, { archivado: !grupo.archivado }))}
          >
            {grupo.archivado ? 'Recuperar grupo' : 'Archivar grupo'}
          </button>
          <p className="secundario pequeno">
            {grupo.archivado
              ? 'Al recuperarlo vuelve a salir al apuntar un gasto.'
              : 'Archivado deja de salir al apuntar un gasto; sus entradas siguen contando.'}{' '}
            Al eliminarlo, sus entradas se quedan como gastos sueltos.
          </p>
          {confirmarBorrado ? (
            <div className="confirmar">
              <span>¿Eliminar «{grupo.nombre}»?</span>
              <button type="button" className="secundario-btn" onClick={() => setConfirmarBorrado(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="peligro"
                disabled={enviando}
                onClick={() => void ejecutar(() => acciones.borrar(grupo.id))}
              >
                Eliminar
              </button>
            </div>
          ) : (
            <button type="button" className="secundario-btn borrar" onClick={() => setConfirmarBorrado(true)}>
              Eliminar grupo
            </button>
          )}
        </div>
      )}
    </Hoja>
  )
}
