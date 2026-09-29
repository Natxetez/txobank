import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Cuenta, NuevaCuenta, TipoCuenta } from '../data/types'
import { mensajeError } from '../data/hooks'
import { ETIQUETA_TIPO_CUENTA } from '../lib/catalogo'
import { aTextoEditable, parseImporte } from '../lib/dinero'
import { ColorChips } from './ColorChips'

interface Props {
  /** Si se pasa, se edita esa cuenta (y aparece la opción de archivar). */
  inicial?: Cuenta
  colorPorDefecto: string
  orden: number
  etiquetaGuardar: string
  onGuardar: (datos: NuevaCuenta) => Promise<void>
}

export function FormCuenta({ inicial, colorPorDefecto, orden, etiquetaGuardar, onGuardar }: Props) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoCuenta>(inicial?.tipo ?? 'corriente')
  const [saldo, setSaldo] = useState(inicial ? aTextoEditable(Math.abs(inicial.saldoInicial)) : '')
  const [deuda, setDeuda] = useState((inicial?.saldoInicial ?? 0) < 0)
  const [color, setColor] = useState(inicial?.color ?? colorPorDefecto)
  const [archivada, setArchivada] = useState(inicial?.archivada ?? false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nombre.trim()) return setError('Escribe un nombre para la cuenta.')
    const abs = saldo.trim() === '' ? 0 : parseImporte(saldo)
    if (abs === null) return setError('El saldo inicial no es un importe válido.')
    setEnviando(true)
    try {
      await onGuardar({
        nombre: nombre.trim(),
        tipo,
        saldoInicial: deuda ? -abs : abs,
        color,
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
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Cuenta nómina" autoFocus />
      </label>
      <label className="campo">
        Tipo
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCuenta)}>
          {(Object.keys(ETIQUETA_TIPO_CUENTA) as TipoCuenta[]).map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO_CUENTA[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        Saldo inicial (€)
        <input inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0" />
      </label>
      <label className="casilla">
        <input type="checkbox" checked={deuda} onChange={(e) => setDeuda(e.target.checked)} />
        Es deuda (saldo negativo, por ejemplo en una tarjeta)
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
        {enviando ? 'Guardando…' : etiquetaGuardar}
      </button>
    </form>
  )
}
