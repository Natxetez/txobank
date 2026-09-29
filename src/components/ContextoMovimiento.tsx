import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Movimiento } from '../data/types'
import { HojaMovimiento } from './HojaMovimiento'
import type { PeticionHoja, Plantilla } from './HojaMovimiento'

interface Api {
  abrirNuevo: (plantilla?: Plantilla) => void
  abrirEditar: (movimiento: Movimiento) => void
}

const Ctx = createContext<Api>({ abrirNuevo: () => {}, abrirEditar: () => {} })

/** Guarda qué hoja de movimiento está abierta y la muestra por encima de cualquier pantalla. */
export function MovimientoProvider({ children }: { children: ReactNode }) {
  // `clave` cambia en cada apertura para que la hoja empiece con el estado limpio (p. ej. al duplicar).
  const [abierta, setAbierta] = useState<{ peticion: PeticionHoja; clave: number } | null>(null)

  const abrirNuevo = useCallback((plantilla?: Plantilla) => {
    setAbierta((a) => ({ peticion: { tipo: 'nuevo', plantilla }, clave: (a?.clave ?? 0) + 1 }))
  }, [])
  const abrirEditar = useCallback((movimiento: Movimiento) => {
    setAbierta((a) => ({ peticion: { tipo: 'editar', movimiento }, clave: (a?.clave ?? 0) + 1 }))
  }, [])
  const api = useMemo(() => ({ abrirNuevo, abrirEditar }), [abrirNuevo, abrirEditar])

  return (
    <Ctx.Provider value={api}>
      {children}
      {abierta && (
        <HojaMovimiento
          key={abierta.clave}
          peticion={abierta.peticion}
          onCerrar={() => setAbierta(null)}
          onDuplicar={abrirNuevo}
        />
      )}
    </Ctx.Provider>
  )
}

export const useHojaMovimiento = () => useContext(Ctx)
