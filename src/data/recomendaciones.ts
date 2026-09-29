import { useCallback, useMemo, useState } from 'react'
import { useFmt } from '../components/Discreto'
import { CONFIG_RECOMENDACIONES } from '../lib/recomendaciones/config'
import { generarRecomendaciones } from '../lib/recomendaciones'
import type { Recomendacion } from '../lib/recomendaciones'
import { hoyISO } from '../lib/meses'
import { useFijos, useOmitidos, usePresupuestos, useTodosMovimientos } from './consultas'
import { useAjustes, useCategorias } from './hooks'

const CLAVE_DESCARTADAS = 'txobank.recomendaciones.descartadas'

function leerDescartadas(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_DESCARTADAS) ?? '[]') as string[]
  } catch {
    return []
  }
}

export interface EstadoRecomendaciones {
  cargando: boolean
  /** Sin las descartadas y recortadas al máximo visible. */
  visibles: Recomendacion[]
  /** Cuántas hay en total sin descartar (por si hay más que las visibles). */
  total: number
  faltanDatos: boolean
  descartar: (id: string) => void
}

/** Recomendaciones de hoy. Se descartan hasta el mes siguiente: el id lleva el mes y se guarda en el dispositivo. */
export function useRecomendaciones(): EstadoRecomendaciones {
  const fmt = useFmt()
  const todos = useTodosMovimientos()
  const categorias = useCategorias()
  const presupuestos = usePresupuestos()
  const ajustes = useAjustes()
  const fijos = useFijos()
  const omitidos = useOmitidos()
  const [descartadas, setDescartadas] = useState(leerDescartadas)

  const resultado = useMemo(() => {
    if (!todos.data || !categorias.data || !presupuestos.data || !ajustes.data || !fijos.data || !omitidos.data) return null
    return generarRecomendaciones(
      {
        hoy: hoyISO(),
        movimientos: todos.data,
        categorias: categorias.data,
        presupuestos: presupuestos.data,
        ajustes: ajustes.data,
        fijos: fijos.data,
        omitidos: omitidos.data,
      },
      fmt,
    )
  }, [todos.data, categorias.data, presupuestos.data, ajustes.data, fijos.data, omitidos.data, fmt])

  const descartar = useCallback((id: string) => {
    setDescartadas((actuales) => {
      // Solo se guardan las del mes en curso: las anteriores ya no vuelven a salir.
      const mes = hoyISO().slice(0, 7)
      const nuevas = [...actuales.filter((d) => d.endsWith(mes)), id]
      try {
        localStorage.setItem(CLAVE_DESCARTADAS, JSON.stringify(nuevas))
      } catch {
        /* sin almacenamiento: se descarta hasta cerrar la app */
      }
      return nuevas
    })
  }, [])

  const pendientes = resultado?.recomendaciones.filter((r) => !descartadas.includes(r.id)) ?? []
  return {
    cargando: !resultado,
    visibles: pendientes.slice(0, CONFIG_RECOMENDACIONES.maxVisibles),
    total: pendientes.length,
    faltanDatos: resultado?.faltanDatos ?? false,
    descartar,
  }
}

const claveRevision = (mes: string) => `txobank.revision.${mes.slice(0, 7)}`

export function revisionVista(mes: string): boolean {
  try {
    return localStorage.getItem(claveRevision(mes)) === '1'
  } catch {
    return false
  }
}

export function marcarRevisionVista(mes: string): void {
  try {
    localStorage.setItem(claveRevision(mes), '1')
  } catch {
    /* no pasa nada: la tarjeta seguirá saliendo */
  }
}
