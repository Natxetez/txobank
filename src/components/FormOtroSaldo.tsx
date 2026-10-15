import { useState } from 'react'
import type { FormEvent } from 'react'
import { mensajeError } from '../data/hooks'
import type { NuevoOtroSaldo, OtroSaldo } from '../data/types'
import { parseImporte } from '../lib/dinero'
import { ColorChips } from './ColorChips'

interface Props {
  /** Si se pasa, se edita ese otro saldo ; si no, se pide el saldo inicial. */
  inicial?: OtroSaldo
  colorPorDefecto: string
  orden: number
  /** `saldoInicial` solo al crear (céntimos, puede ser negativo). */
  onGuardar: (datos: NuevoOtroSaldo, saldoInicial: number | null) => Promise<void>
}

/**
 * Lee el saldo escrito: admite "-" delante, pero como el teclado decimal del iPhone no lo tiene,
 * también la casilla "negativo". Devuelve céntimos o null si no es válido.
 */
export function leerSaldo(texto: string, negativo: boolean): number | null {
  const v = parseImporte(texto, { permitirNegativo: true })
  if (v === null) return null
  return negativo ? -Math.abs(v) : v
}

/** Campo de saldo (€) con la casilla de saldo negativo. */
export function CampoSaldo({
  etiqueta,
  valor,
  negativo,
  onValor,
  onNegativo,
  ayuda,
  autoFocus,
}: {
  etiqueta: string
  valor: string
  negativo: boolean
  onValor: (v: string) => void
  onNegativo: (v: boolean) => void
  ayuda?: string
  autoFocus?: boolean
}) {
  return (
    <>
      <label className="campo">
        {etiqueta}
        <input inputMode="decimal" value={valor} onChange={(e) => onValor(e.target.value)} placeholder="0" autoFocus={autoFocus} />
        {ayuda && <span className="secundario pequeno">{ayuda}</span>}
      </label>
      <label className="casilla">
        <input type="checkbox" checked={negativo} onChange={(e) => onNegativo(e.target.checked)} />
        Saldo negativo (una deuda)
      </label>
    </>
  )
}

/** Se queda con el primer carácter visible (un emoji puede ocupar varios códigos). */
function primerEmoji(texto: string): string {
  const [primero] = new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(texto.trim())
  return primero?.segment ?? ''
}

export function FormOtroSaldo({ inicial, colorPorDefecto, orden, onGuardar }: Props) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [icono, setIcono] = useState(inicial?.icono ?? '')
  const [color, setColor] = useState(inicial?.color ?? colorPorDefecto)
  const [saldo, setSaldo] = useState('')
  const [negativo, setNegativo] = useState(false)
  const archivado = inicial?.archivado ?? false
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nombre.trim()) return setError('Escribe un nombre.')
    let saldoInicial: number | null = null
    if (!inicial) {
      saldoInicial = saldo.trim() === '' ? 0 : leerSaldo(saldo, negativo)
      if (saldoInicial === null) return setError('El saldo no es un importe válido.')
    }
    setEnviando(true)
    try {
      await onGuardar(
        { nombre: nombre.trim(), icono: icono || null, color, orden: inicial?.orden ?? orden, archivado },
        saldoInicial,
      )
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="formulario">
      <label className="campo">
        Nombre
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Revolut" autoFocus={!inicial} />
      </label>
      <label className="campo">
        Emoji (opcional)
        <input value={icono} onChange={(e) => setIcono(primerEmoji(e.target.value))} placeholder="💳" />
      </label>
      <div className="campo">
        Color
        <ColorChips valor={color} onChange={setColor} />
      </div>
      {!inicial && (
        <CampoSaldo
          etiqueta="Saldo actual (€)"
          valor={saldo}
          negativo={negativo}
          onValor={setSaldo}
          onNegativo={setNegativo}
          ayuda="Queda como primera actualización de su historial."
        />
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primario" disabled={enviando}>
        {enviando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear'}
      </button>
    </form>
  )
}
