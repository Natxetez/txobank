import { useState } from 'react'
import type { FormEvent } from 'react'
import { dataSource } from '../data'
import { ErrorSesion } from '../data/types'
import { etiquetaVersion } from '../version'

/** Segundo paso del inicio de sesión: el código de 6 dígitos de la app autenticadora. */
export function VerificarCodigo({ email }: { email: string }) {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function verificar(valor: string) {
    setError(null)
    setEnviando(true)
    try {
      await dataSource.sesion.verificarCodigo(valor)
      // Al verificarse, la sesión cambia y la app entra sola.
    } catch (err) {
      setError(err instanceof ErrorSesion ? err.message : 'Ha ocurrido un error inesperado.')
      setCodigo('')
      setEnviando(false)
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (codigo.length === 6) void verificar(codigo)
  }

  function cambiar(texto: string) {
    const limpio = texto.replace(/\D/g, '').slice(0, 6)
    setCodigo(limpio)
    // Con el sexto dígito se envía solo (también cuando iOS lo rellena desde Contraseñas).
    if (limpio.length === 6 && !enviando) void verificar(limpio)
  }

  return (
    <main className="login">
      <div className="logo" aria-hidden="true">T</div>
      <h1>Verificación</h1>
      <p className="lema">Escribe el código de 6 dígitos de tu app autenticadora para {email}.</p>
      <form onSubmit={enviar} className="login-form">
        <label>
          Código
          <input
            className="codigo-mfa"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            value={codigo}
            onChange={(e) => cambiar(e.target.value)}
            aria-describedby={error ? 'error-codigo' : undefined}
          />
        </label>
        {error && (
          <p className="error" role="alert" id="error-codigo">
            {error}
          </p>
        )}
        <button type="submit" className="primario" disabled={enviando || codigo.length !== 6}>
          {enviando ? 'Comprobando…' : 'Verificar'}
        </button>
        <button type="button" className="texto" onClick={() => void dataSource.sesion.cerrar()}>
          Usar otra cuenta
        </button>
      </form>
      <p className="version-app">{etiquetaVersion()}</p>
    </main>
  )
}
