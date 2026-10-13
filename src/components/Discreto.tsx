import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { formatEuros } from '../lib/dinero'
import { Icono } from './Icono'

const CLAVE = 'txobank.discreto'

interface Api {
  oculto: boolean
  alternar: () => void
  /** Formatea un importe, o "•••" si el modo discreto está activo. */
  fmt: (centimos: number) => string
}

const Ctx = createContext<Api>({ oculto: false, alternar: () => {}, fmt: formatEuros })

/** Modo discreto: oculta todos los importes hasta que se vuelve a tocar. Se recuerda en el dispositivo. */
export function DiscretoProvider({ children }: { children: ReactNode }) {
  const [oculto, setOculto] = useState(() => {
    try {
      return localStorage.getItem(CLAVE) === '1'
    } catch {
      return false
    }
  })

  const alternar = useCallback(() => {
    setOculto((o) => {
      try {
        localStorage.setItem(CLAVE, o ? '0' : '1')
      } catch {
        /* sin almacenamiento: el modo dura hasta cerrar la app */
      }
      return !o
    })
  }, [])

  const fmt = useCallback((c: number) => (oculto ? '•••' : formatEuros(c)), [oculto])
  const api = useMemo(() => ({ oculto, alternar, fmt }), [oculto, alternar, fmt])
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export const useDiscreto = () => useContext(Ctx)
export const useFmt = () => useContext(Ctx).fmt

export function BotonDiscreto() {
  const { oculto, alternar } = useDiscreto()
  return (
    <button
      type="button"
      className="ojo"
      aria-pressed={oculto}
      aria-label={oculto ? 'Mostrar importes' : 'Ocultar importes'}
      onClick={alternar}
    >
      <Icono nombre={oculto ? 'ojoTachado' : 'ojo'} />
    </button>
  )
}
