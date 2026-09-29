import { useState } from 'react'
import type { FormEvent } from 'react'
import { dataSource } from '../data'
import { ErrorSesion } from '../data/types'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await dataSource.sesion.iniciar(email.trim(), password)
    } catch (err) {
      setError(err instanceof ErrorSesion ? err.message : 'Ha ocurrido un error inesperado.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="login">
      <div className="logo" aria-hidden="true">T</div>
      <h1>TxoBank</h1>
      <form onSubmit={enviar} className="login-form">
        <label>
          Usuario
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="primario" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
