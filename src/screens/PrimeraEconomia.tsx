import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { dataSource } from '../data'
import { mensajeError } from '../data/hooks'
import { colorPorPosicion } from '../lib/catalogo'
import { validarEconomia } from '../lib/economias'

/** Antes de nada, la primera economía. Después viene el asistente de primera vez dentro de ella. */
export function PrimeraEconomia({ onCreada }: { onCreada: (id: string) => void }) {
  const qc = useQueryClient()
  const [nombre, setNombre] = useState('Personal')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function crear(e: FormEvent) {
    e.preventDefault()
    const fallo = validarEconomia(nombre, [])
    if (fallo) return setError(fallo)
    setError(null)
    setEnviando(true)
    try {
      const creada = await dataSource.economias.crear({ nombre: nombre.trim(), color: colorPorPosicion(0), orden: 0 })
      await qc.invalidateQueries({ queryKey: ['economias'] })
      onCreada(creada.id)
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  return (
    <main className="asistente">
      <h1>Bienvenido a TxoBank</h1>
      <p className="secundario">
        Todo lo que apuntes va dentro de una <strong>economía</strong>: sus cuentas, gastos, fijos y presupuestos. Puedes
        tener varias, por ejemplo tu economía personal y la de casa, y cambiar de una a otra cuando quieras.
      </p>
      <form onSubmit={crear} className="formulario">
        <label className="campo">
          Nombre de tu primera economía
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} placeholder="Personal" />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primario" disabled={enviando}>
          {enviando ? 'Creando…' : 'Empezar'}
        </button>
      </form>
    </main>
  )
}
