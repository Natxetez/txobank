import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { dataSource } from './index'
import type { Sesion } from './types'

interface Estado {
  /** undefined = aún comprobando si hay sesión guardada. */
  sesion: Sesion | null | undefined
}

const Ctx = createContext<Estado>({ sesion: undefined })

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null | undefined>(undefined)
  const queryClient = useQueryClient()

  useEffect(() => {
    let vivo = true
    dataSource.sesion.actual().then((s) => vivo && setSesion(s))
    const dejar = dataSource.sesion.alCambiar((s) => {
      if (!vivo) return
      // Al cerrar sesión no debe quedar nada de la cuenta anterior en la caché.
      if (!s) queryClient.clear()
      setSesion(s)
    })
    return () => {
      vivo = false
      dejar()
    }
  }, [queryClient])

  return <Ctx.Provider value={{ sesion }}>{children}</Ctx.Provider>
}

export const useSesion = () => useContext(Ctx).sesion
