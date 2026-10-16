import { createContext, Fragment, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { economiaInicial } from '../lib/economias'
import { PrimeraEconomia } from '../screens/PrimeraEconomia'
import { dataSource } from './index'
import { useSesion } from './SesionContext'
import type { Economia } from './types'

interface Estado {
  economias: Economia[]
  activa: Economia
  /** Pasa a otra economía: se descarta la caché de la anterior y se vuelve a Inicio. */
  cambiar: (id: string) => void
}

const Ctx = createContext<Estado | null>(null)

/** La última economía usada se recuerda en este dispositivo (solo es una comodidad). */
const clave = (userId: string) => `txobank.economia.${userId}`
function leerGuardada(userId: string): string | null {
  try {
    return localStorage.getItem(clave(userId))
  } catch {
    return null
  }
}
function guardar(userId: string, id: string) {
  try {
    localStorage.setItem(clave(userId), id)
  } catch {
    /* sin almacenamiento: se entrará en la primera */
  }
}

export const opcEconomias = () => ({ queryKey: ['economias'] as const, queryFn: () => dataSource.economias.listar() })

/**
 * Elige la economía activa y la fija en el DataSource antes de pintar nada de dentro, que siempre trabaja
 * sobre ella. Al cambiar de economía, todo lo de dentro se vuelve a montar desde cero.
 */
export function EconomiaProvider({ children }: { children: ReactNode }) {
  const userId = useSesion()?.userId ?? ''
  const qc = useQueryClient()
  const navigate = useNavigate()
  const lista = useQuery(opcEconomias())
  const [elegida, setElegida] = useState<string | null>(() => leerGuardada(userId))

  const cambiar = useCallback(
    (id: string) => {
      guardar(userId, id)
      // Los datos en caché son de la economía anterior: fuera todos menos la lista de economías.
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'economias' })
      dataSource.economias.activar(id)
      setElegida(id)
      navigate('/')
    },
    [userId, qc, navigate],
  )

  const economias = lista.data
  const id = economias ? economiaInicial(economias, elegida) : null
  // Antes de pintar los hijos, para que sus consultas ya vayan a esta economía.
  if (id && dataSource.economias.activa() !== id) dataSource.economias.activar(id)

  const valor = useMemo(() => {
    const activa = economias?.find((e) => e.id === id)
    return economias && activa ? { economias, activa, cambiar } : null
  }, [economias, id, cambiar])

  if (lista.error && !economias) {
    return (
      <main className="asistente">
        <h1>No se pueden cargar los datos</h1>
        <p className="error" role="alert">
          {lista.error.message}
        </p>
        <button className="primario" onClick={() => void lista.refetch()}>
          Reintentar
        </button>
      </main>
    )
  }
  if (!economias) return <div className="cargando">Cargando…</div>
  if (!valor) return <PrimeraEconomia onCreada={cambiar} />

  return (
    <Ctx.Provider value={valor}>
      <Fragment key={valor.activa.id}>{children}</Fragment>
    </Ctx.Provider>
  )
}

export function useEconomia(): Estado {
  const estado = useContext(Ctx)
  if (!estado) throw new Error('useEconomia fuera de EconomiaProvider')
  return estado
}
