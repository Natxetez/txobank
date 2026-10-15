import { createClient } from '@supabase/supabase-js'
import type { Session, AuthError, SupabaseClient } from '@supabase/supabase-js'
import { config } from '../../config'
import { ErrorSesion } from '../types'
import type { DataSource, Sesion } from '../types'
import {
  crearAjustesApi,
  crearCategoriasApi,
  crearCuentasApi,
  crearFijosApi,
  crearGruposApi,
  crearMantenimientoApi,
  crearMovimientosApi,
  crearOtrosSaldosApi,
  crearPresupuestosApi,
  crearSaldosApi,
} from './datos'

/** Sesión del dominio, con si falta el código de la verificación en dos pasos (nivel aal1 cuando se exige aal2). */
async function aSesion(client: SupabaseClient, s: Session | null): Promise<Sesion | null> {
  if (!s?.user) return null
  const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
  const faltaCodigo = data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2'
  return { userId: s.user.id, email: s.user.email ?? '', faltaCodigo }
}

function errorCodigo(e: AuthError): ErrorSesion {
  if (e.status === 429) return new ErrorSesion('demasiados-intentos', 'Demasiados intentos. Espera un momento y vuelve a probar.')
  if (e.name === 'AuthRetryableFetchError' || e.status === 0) {
    return new ErrorSesion('red', 'No hay conexión. Revisa tu red e inténtalo de nuevo.')
  }
  return new ErrorSesion('codigo', 'Código incorrecto. Escribe el que muestra ahora tu app autenticadora.')
}

/** El QR llega como SVG; se convierte en una dirección de imagen si hace falta. */
const aImagen = (qr: string) => (qr.startsWith('data:') ? qr : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`)

function traducirError(e: AuthError): ErrorSesion {
  if (e.status === 429 || e.code === 'over_request_rate_limit') {
    return new ErrorSesion('demasiados-intentos', 'Demasiados intentos. Espera un momento y vuelve a probar.')
  }
  if (e.code === 'invalid_credentials' || e.status === 400) {
    return new ErrorSesion('credenciales', 'Usuario o contraseña incorrectos.')
  }
  if (e.name === 'AuthRetryableFetchError' || e.status === 0 || e.status === undefined) {
    return new ErrorSesion('red', 'No hay conexión. Revisa tu red e inténtalo de nuevo.')
  }
  return new ErrorSesion('desconocido', 'No se ha podido iniciar sesión. Inténtalo de nuevo.')
}

export function crearSupabaseDataSource(): DataSource {
  if (!config.supabaseUrl || !config.supabaseKey) {
    throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY (ver .env.example).')
  }
  const client = createClient(config.supabaseUrl, config.supabaseKey)

  return {
    sesion: {
      async iniciar(email, password) {
        try {
          const { data, error } = await client.auth.signInWithPassword({ email, password })
          if (error) throw traducirError(error)
          const sesion = await aSesion(client, data.session)
          if (!sesion) throw new ErrorSesion('desconocido', 'No se ha podido iniciar sesión.')
          return sesion
        } catch (e) {
          if (e instanceof ErrorSesion) throw e
          throw new ErrorSesion('red', 'No hay conexión. Revisa tu red e inténtalo de nuevo.')
        }
      },
      async cerrar() {
        await client.auth.signOut()
      },
      async actual() {
        const { data } = await client.auth.getSession()
        return aSesion(client, data.session)
      },
      alCambiar(cb) {
        // Dentro de este aviso no se puede llamar a Supabase (se queda bloqueado): se completa justo después.
        const { data } = client.auth.onAuthStateChange((_evento, session) => {
          setTimeout(() => void aSesion(client, session).then(cb), 0)
        })
        return () => data.subscription.unsubscribe()
      },
      async mfaActiva() {
        const { data, error } = await client.auth.mfa.listFactors()
        if (error) throw errorCodigo(error)
        return data.totp.length > 0
      },
      async inscribirMfa() {
        const { data: factores } = await client.auth.mfa.listFactors()
        for (const f of factores?.all ?? []) {
          if (f.status === 'unverified') await client.auth.mfa.unenroll({ factorId: f.id })
        }
        const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'TxoBank' })
        if (error) throw errorCodigo(error)
        return { factorId: data.id, qr: aImagen(data.totp.qr_code), secreto: data.totp.secret, uri: data.totp.uri }
      },
      async confirmarMfa(factorId, codigo) {
        const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: codigo })
        if (error) throw errorCodigo(error)
      },
      async verificarCodigo(codigo) {
        const { data, error: errorLista } = await client.auth.mfa.listFactors()
        if (errorLista) throw errorCodigo(errorLista)
        const factor = data.totp[0]
        if (!factor) throw new ErrorSesion('desconocido', 'La verificación en dos pasos no está activada.')
        const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: codigo })
        if (error) throw errorCodigo(error)
      },
      async desactivarMfa() {
        const { data, error } = await client.auth.mfa.listFactors()
        if (error) throw errorCodigo(error)
        for (const f of data.all) {
          const { error: e } = await client.auth.mfa.unenroll({ factorId: f.id })
          if (e) throw errorCodigo(e)
        }
        // Una sesión nueva deja de llevar el nivel de la verificación ya desactivada.
        await client.auth.refreshSession()
      },
    },
    ajustes: crearAjustesApi(client),
    cuentas: crearCuentasApi(client),
    categorias: crearCategoriasApi(client),
    movimientos: crearMovimientosApi(client),
    fijos: crearFijosApi(client),
    presupuestos: crearPresupuestosApi(client),
    saldos: crearSaldosApi(client),
    grupos: crearGruposApi(client),
    otrosSaldos: crearOtrosSaldosApi(client),
    mantenimiento: crearMantenimientoApi(client),
  }
}
