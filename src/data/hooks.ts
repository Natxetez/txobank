import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { dataSource } from './index'
import type { Ajustes, Fecha, NuevaCategoria, NuevaCuenta, NuevoMovimiento } from './types'

export const useCuentas = () => useQuery({ queryKey: ['cuentas'], queryFn: () => dataSource.cuentas.listar() })
export const useCategorias = () => useQuery({ queryKey: ['categorias'], queryFn: () => dataSource.categorias.listar() })
export const useAjustes = () => useQuery({ queryKey: ['ajustes'], queryFn: () => dataSource.ajustes.obtener() })
export const useSaldos = () => useQuery({ queryKey: ['saldos'], queryFn: () => dataSource.saldos.listar() })

export const useMovimientos = (desde: Fecha, hasta: Fecha) =>
  useQuery({ queryKey: ['movimientos', desde, hasta], queryFn: () => dataSource.movimientos.listar(desde, hasta) })

const invalidar = (qc: QueryClient, ...claves: string[]) =>
  Promise.all(claves.map((k) => qc.invalidateQueries({ queryKey: [k] })))

export function useCrearCuenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (c: NuevaCuenta) => dataSource.cuentas.crear(c),
    onSuccess: () => invalidar(qc, 'cuentas', 'saldos'),
  })
}

export function useActualizarCuenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: Partial<NuevaCuenta> }) =>
      dataSource.cuentas.actualizar(id, cambios),
    onSuccess: () => invalidar(qc, 'cuentas', 'saldos'),
  })
}

export function useCrearCategoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (c: NuevaCategoria) => dataSource.categorias.crear(c),
    onSuccess: () => invalidar(qc, 'categorias'),
  })
}

export function useCrearCategorias() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cs: NuevaCategoria[]) => dataSource.categorias.crearVarias(cs),
    onSuccess: () => invalidar(qc, 'categorias'),
  })
}

export function useActualizarCategoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: Partial<NuevaCategoria> }) =>
      dataSource.categorias.actualizar(id, cambios),
    onSuccess: () => invalidar(qc, 'categorias'),
  })
}

export function useReordenarCategorias() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => dataSource.categorias.reordenar(ids),
    onSuccess: () => invalidar(qc, 'categorias'),
  })
}

export function useGuardarAjustes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: Ajustes) => dataSource.ajustes.guardar(a),
    onSuccess: () => invalidar(qc, 'ajustes'),
  })
}

export function useGuardarPresupuesto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { mes: string; categoriaId: string | null; importe: number | null }) =>
      dataSource.presupuestos.guardar(p.mes, p.categoriaId, p.importe),
    onSuccess: () => invalidar(qc, 'presupuestos'),
  })
}

/**
 * Acciones sobre movimientos como funciones normales (no useMutation): siguen funcionando aunque
 * el componente que las lanzó ya se haya cerrado, que es el caso de "Deshacer" en los avisos.
 * Cada una refresca las listas y los saldos.
 */
export function useAccionesMovimiento() {
  const qc = useQueryClient()
  return useMemo(() => {
    const refrescar = () => invalidar(qc, 'movimientos', 'saldos')
    return {
      async crear(m: NuevoMovimiento) {
        const r = await dataSource.movimientos.crear(m)
        await refrescar()
        return r
      },
      async actualizar(id: string, cambios: Partial<NuevoMovimiento>) {
        const r = await dataSource.movimientos.actualizar(id, cambios)
        await refrescar()
        return r
      },
      async borrar(id: string) {
        await dataSource.movimientos.borrar(id)
        await refrescar()
      },
    }
  }, [qc])
}

/** Mensaje en español para mostrar al usuario a partir de cualquier error. */
export const mensajeError = (e: unknown) =>
  e instanceof Error && e.message ? e.message : 'Ha ocurrido un error inesperado.'
