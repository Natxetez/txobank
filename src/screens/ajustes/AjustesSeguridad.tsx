import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Cabecera } from '../../components/Cabecera'
import { dataSource } from '../../data'
import { mensajeError } from '../../data/hooks'
import type { InscripcionMfa } from '../../data/types'

/** Ajustes → Seguridad: activar o desactivar la verificación en dos pasos. */
export function AjustesSeguridad() {
  const qc = useQueryClient()
  const activa = useQuery({ queryKey: ['mfa'], queryFn: () => dataSource.sesion.mfaActiva() })
  const [inscripcion, setInscripcion] = useState<InscripcionMfa | null>(null)
  const [codigo, setCodigo] = useState('')
  const [confirmarBaja, setConfirmarBaja] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function ejecutar(accion: () => Promise<void>) {
    setError(null)
    setEnviando(true)
    try {
      await accion()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  const empezar = () => ejecutar(async () => setInscripcion(await dataSource.sesion.inscribirMfa()))

  function confirmar(e: FormEvent) {
    e.preventDefault()
    if (!inscripcion) return
    void ejecutar(async () => {
      await dataSource.sesion.confirmarMfa(inscripcion.factorId, codigo)
      setInscripcion(null)
      setCodigo('')
      await qc.invalidateQueries({ queryKey: ['mfa'] })
    })
  }

  const desactivar = () =>
    ejecutar(async () => {
      await dataSource.sesion.desactivarMfa()
      setConfirmarBaja(false)
      await qc.invalidateQueries({ queryKey: ['mfa'] })
    })

  async function copiar(secreto: string) {
    try {
      await navigator.clipboard.writeText(secreto)
      setCopiado(true)
    } catch {
      /* sin portapapeles: la clave se ve en pantalla */
    }
  }

  return (
    <section className="pantalla ancho">
      <Cabecera titulo="Seguridad" />
      <div className="tarjeta seguridad">
        <h2>Verificación en dos pasos</h2>
        <p className="secundario">
          Además de la contraseña, al iniciar sesión se pide un código de 6 dígitos que genera tu móvil. Aunque alguien
          averigüe tu contraseña, sin ese código no puede ver tus datos: lo exige también el servidor.
        </p>
        {activa.isPending ? (
          <p className="secundario">Comprobando…</p>
        ) : activa.data ? (
          <>
            <p className="ok">Activada</p>
            {confirmarBaja ? (
              <div className="confirmar">
                <span>¿Desactivarla? Volverá a bastar con la contraseña.</span>
                <button type="button" className="secundario-btn" onClick={() => setConfirmarBaja(false)}>
                  Cancelar
                </button>
                <button type="button" className="peligro" disabled={enviando} onClick={() => void desactivar()}>
                  Desactivar
                </button>
              </div>
            ) : (
              <button type="button" className="secundario-btn borrar" onClick={() => setConfirmarBaja(true)}>
                Desactivar
              </button>
            )}
          </>
        ) : inscripcion ? (
          <form className="formulario" onSubmit={confirmar}>
            <ol className="pasos-mfa">
              <li>
                <strong>En este iPhone:</strong> toca el botón y guarda el código en Contraseñas.
                <a className="secundario-btn boton-enlace" href={inscripcion.uri}>
                  Añadir a Contraseñas
                </a>
              </li>
              <li>
                <strong>Desde otro dispositivo:</strong> escanea el QR con tu app autenticadora.
                <img className="qr-mfa" src={inscripcion.qr} alt="Código QR para la app autenticadora" />
              </li>
              <li>
                <strong>A mano:</strong> introduce esta clave en la app autenticadora.
                <span className="secreto-mfa">
                  <code>{inscripcion.secreto.replace(/(.{4})/g, '$1 ').trim()}</code>
                  <button type="button" className="texto" onClick={() => void copiar(inscripcion.secreto)}>
                    {copiado ? 'Copiada' : 'Copiar'}
                  </button>
                </span>
              </li>
            </ol>
            <label className="campo">
              Código que muestra la app
              <input
                className="codigo-mfa"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <button type="submit" className="primario" disabled={enviando || codigo.length !== 6}>
              {enviando ? 'Comprobando…' : 'Activar'}
            </button>
            <button type="button" className="texto" onClick={() => setInscripcion(null)}>
              Cancelar
            </button>
          </form>
        ) : (
          <button type="button" className="primario" disabled={enviando} onClick={() => void empezar()}>
            Activar la verificación en dos pasos
          </button>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <p className="secundario pequeno">
        Si pierdes la app autenticadora, desde el panel de Supabase (Authentication → Users → tu usuario) puedes borrar el
        factor y volver a entrar solo con la contraseña.
      </p>
    </section>
  )
}
