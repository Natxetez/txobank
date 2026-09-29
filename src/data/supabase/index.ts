import { createClient } from '@supabase/supabase-js'
import type { Session, AuthError } from '@supabase/supabase-js'
import { config } from '../../config'
import { ErrorSesion } from '../types'
import type { DataSource, Sesion } from '../types'
import {
  crearAjustesApi,
  crearCategoriasApi,
  crearCuentasApi,
  crearFijosApi,
  crearMovimientosApi,
  crearPresupuestosApi,
  crearSaldosApi,
} from './datos'

function aSesion(s: Session | null): Sesion | null {
  return s?.user ? { userId: s.user.id, email: s.user.email ?? '' } : null
}

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
          const sesion = aSesion(data.session)
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
        return aSesion(data.session)
      },
      alCambiar(cb) {
        const { data } = client.auth.onAuthStateChange((_evento, session) => cb(aSesion(session)))
        return () => data.subscription.unsubscribe()
      },
    },
    ajustes: crearAjustesApi(client),
    cuentas: crearCuentasApi(client),
    categorias: crearCategoriasApi(client),
    movimientos: crearMovimientosApi(client),
    fijos: crearFijosApi(client),
    presupuestos: crearPresupuestosApi(client),
    saldos: crearSaldosApi(client),
  }
}
