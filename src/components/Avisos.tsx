import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

interface Accion {
  etiqueta: string
  alHacer: () => void | Promise<unknown>
}

interface Aviso {
  id: number
  texto: string
  accion?: Accion
  destacado: boolean
}

interface Api {
  mostrar: (texto: string, accion?: Accion, destacado?: boolean) => void
}

const Ctx = createContext<Api>({ mostrar: () => {} })

const DURACION_MS = 6000

/** Aviso breve sobre la barra inferior, con acción opcional (por ejemplo Deshacer). */
export function AvisosProvider({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mostrar = useCallback((texto: string, accion?: Accion, destacado = false) => {
    setError(null)
    setAviso({ id: Date.now(), texto, accion, destacado })
  }, [])
  const api = useMemo(() => ({ mostrar }), [mostrar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), DURACION_MS)
    return () => clearTimeout(t)
  }, [aviso])

  async function hacer(accion: Accion) {
    setAviso(null)
    try {
      await accion.alHacer()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido completar la acción.')
    }
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      {(aviso || error) && (
        <div className={aviso?.destacado && !error ? 'aviso destacado' : 'aviso'} role="status" aria-live="polite">
          <span>{error ?? aviso?.texto}</span>
          {aviso?.accion && !error && (
            <button type="button" onClick={() => void hacer(aviso.accion!)}>
              {aviso.accion.etiqueta}
            </button>
          )}
          {error && (
            <button type="button" onClick={() => setError(null)}>
              Cerrar
            </button>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useAviso = () => useContext(Ctx)
