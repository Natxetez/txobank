import { useState } from 'react'
import type { FormEvent } from 'react'
import { useEconomia } from '../data/EconomiaContext'
import { useAccionesEconomias } from '../data/consultas'
import { mensajeError } from '../data/hooks'
import type { Economia } from '../data/types'
import { colorPorPosicion } from '../lib/catalogo'
import { siguienteOrdenEconomia, validarEconomia } from '../lib/economias'
import { ColorChips } from './ColorChips'
import { Hoja } from './Hoja'

interface Props {
  /** Si se pasa, se edita esa economía; si no, se crea una nueva y se entra en ella. */
  economia?: Economia
  onCerrar: () => void
}

/** Hoja para crear, renombrar o borrar una economía. */
export function HojaEconomia({ economia, onCerrar }: Props) {
  const { economias, activa, cambiar } = useEconomia()
  const acciones = useAccionesEconomias()
  const [nombre, setNombre] = useState(economia?.nombre ?? '')
  const [color, setColor] = useState(economia?.color ?? colorPorPosicion(economias.length))
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')

  const otra = economias.find((e) => e.id !== economia?.id)
  const puedeBorrar = economia !== undefined && economia.propia && otra !== undefined

  async function ejecutar(accion: () => Promise<unknown>) {
    setError(null)
    setEnviando(true)
    try {
      await accion()
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  function guardar(e: FormEvent) {
    e.preventDefault()
    const fallo = validarEconomia(nombre, economias, economia?.id)
    if (fallo) return setError(fallo)
    const datos = { nombre: nombre.trim(), color }
    void ejecutar(async () => {
      if (economia) {
        await acciones.actualizar(economia.id, datos)
        onCerrar()
      } else {
        // Se entra en la nueva economía, que empieza con el asistente de primera vez.
        const creada = await acciones.crear({ ...datos, orden: siguienteOrdenEconomia(economias) })
        onCerrar()
        cambiar(creada.id)
      }
    })
  }

  function borrar() {
    if (!economia || !otra) return
    void ejecutar(async () => {
      // Si es la activa, primero se sale de ella.
      if (economia.id === activa.id) cambiar(otra.id)
      await acciones.borrar(economia.id)
      onCerrar()
    })
  }

  return (
    <Hoja titulo={economia ? 'Editar economía' : 'Nueva economía'} onCerrar={onCerrar}>
      <form className="formulario" onSubmit={guardar}>
        <label className="campo">
          Nombre
          <input
            autoFocus={!economia}
            value={nombre}
            maxLength={40}
            placeholder="Casa, Personal, Negocio…"
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <div className="campo">
          Color
          <ColorChips valor={color} onChange={setColor} />
        </div>
        {!economia && (
          <p className="ayuda">
            Tendrá sus propias cuentas, categorías, fijos y presupuestos. Al crearla entrarás en ella para configurarla.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primario" disabled={enviando}>
          {enviando ? 'Guardando…' : economia ? 'Guardar cambios' : 'Crear economía'}
        </button>
      </form>

      {economia && (
        <div className="zona-borrar">
          {!puedeBorrar ? (
            <p className="secundario pequeno">
              {economia.propia ? 'Es tu única economía: no se puede borrar.' : 'Solo su propietario puede borrarla.'}
            </p>
          ) : borrando ? (
            <form
              className="formulario"
              onSubmit={(e) => {
                e.preventDefault()
                if (confirmacion.trim() === economia.nombre.trim()) borrar()
              }}
            >
              <p className="aviso-suma">
                Se borrarán sus cuentas, movimientos, fijos, presupuestos, grupos, otros saldos y categorías. Los traspasos
                con otras economías se quedan en la otra parte como gastos o ingresos normales. No se puede deshacer.
              </p>
              <label className="campo">
                Escribe «{economia.nombre}» para confirmar
                <input
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
              <button
                type="submit"
                className="peligro"
                disabled={enviando || confirmacion.trim() !== economia.nombre.trim()}
              >
                Borrar {economia.nombre}
              </button>
            </form>
          ) : (
            <button type="button" className="secundario-btn borrar" onClick={() => setBorrando(true)}>
              Borrar economía
            </button>
          )}
        </div>
      )}
    </Hoja>
  )
}
