import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Categoria, NuevaCategoria, TipoCategoria } from '../data/types'
import { mensajeError } from '../data/hooks'
import { ColorChips } from './ColorChips'

interface Props {
  tipo: TipoCategoria
  /** Si se pasa, se edita esa categoría (y aparece la opción de archivar). */
  inicial?: Categoria
  colorPorDefecto: string
  orden: number
  onGuardar: (datos: NuevaCategoria) => Promise<void>
}

/** Se queda con el primer carácter visible (un emoji puede ocupar varios códigos). */
function primerEmoji(texto: string): string {
  const [primero] = new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(texto.trim())
  return primero?.segment ?? ''
}

export function FormCategoria({ tipo, inicial, colorPorDefecto, orden, onGuardar }: Props) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [icono, setIcono] = useState(inicial?.icono ?? '')
  const [color, setColor] = useState(inicial?.color ?? colorPorDefecto)
  const [archivada, setArchivada] = useState(inicial?.archivada ?? false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nombre.trim()) return setError('Escribe un nombre para la categoría.')
    setEnviando(true)
    try {
      await onGuardar({
        nombre: nombre.trim(),
        tipo: inicial?.tipo ?? tipo,
        color,
        icono: icono || null,
        orden: inicial?.orden ?? orden,
        archivada,
      })
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="formulario">
      <label className="campo">
        Nombre
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Comida" autoFocus />
      </label>
      <label className="campo">
        Emoji (opcional)
        <input value={icono} onChange={(e) => setIcono(primerEmoji(e.target.value))} placeholder="🛒" />
      </label>
      <div className="campo">
        Color
        <ColorChips valor={color} onChange={setColor} />
      </div>
      {inicial && (
        <label className="casilla">
          <input type="checkbox" checked={archivada} onChange={(e) => setArchivada(e.target.checked)} />
          Archivada (se oculta en los formularios; sus movimientos siguen contando)
        </label>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primario" disabled={enviando}>
        {enviando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear categoría'}
      </button>
    </form>
  )
}
