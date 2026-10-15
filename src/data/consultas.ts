// Consultas compartidas (TanStack Query) y el cálculo del control del mes a partir de ellas.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { calcularControl } from '../lib/control'
import type { Control } from '../lib/control'
import { finDeMes, hoyISO, mesActual, sumarMeses } from '../lib/meses'
import { planCambioPresupuesto } from '../lib/presupuestos'
import type { Alcance } from '../lib/presupuestos'
import { dataSource } from './index'
import type { FechaHora, Fecha, Mes, Movimiento, NuevoGrupo, NuevoOtroSaldo, Presupuesto } from './types'

export const opcMovimientos = (desde: Fecha, hasta: Fecha) => ({
  queryKey: ['movimientos', desde, hasta] as const,
  queryFn: () => dataSource.movimientos.listar(desde, hasta),
})

/** Todos los movimientos (para estadísticas y recomendaciones), hasta el final del mes siguiente. */
export const opcTodosMovimientos = () => {
  const hasta = finDeMes(sumarMeses(mesActual(), 1))
  return {
    queryKey: ['movimientos', 'todos', hasta] as const,
    queryFn: () => dataSource.movimientos.listar('2000-01-01', hasta),
  }
}

export const opcPagosFijos = (desde: Mes, hasta: Mes) => ({
  queryKey: ['movimientos', 'pagosFijos', desde, hasta] as const,
  queryFn: () => dataSource.movimientos.listarPagosFijos(desde, hasta),
})

export const opcFijos = () => ({ queryKey: ['fijos'] as const, queryFn: () => dataSource.fijos.listar() })
export const opcOmitidos = () => ({ queryKey: ['omitidos'] as const, queryFn: () => dataSource.fijos.listarOmitidos() })
export const opcFechasFijos = () => ({ queryKey: ['fechasFijos'] as const, queryFn: () => dataSource.fijos.listarFechas() })
export const opcGrupos = () => ({ queryKey: ['grupos'] as const, queryFn: () => dataSource.grupos.listar() })
export const opcOtrosSaldos = () => ({ queryKey: ['otrosSaldos'] as const, queryFn: () => dataSource.otrosSaldos.listar() })
export const opcHistorialSaldos = () => ({
  queryKey: ['historialSaldos'] as const,
  queryFn: () => dataSource.otrosSaldos.listarHistorial(),
})
export const opcPresupuestos = () => ({ queryKey: ['presupuestos'] as const, queryFn: () => dataSource.presupuestos.listar() })
export const opcAjustes = () => ({ queryKey: ['ajustes'] as const, queryFn: () => dataSource.ajustes.obtener() })

/** Rango de movimientos para calcular un mes: el mes y los contiguos, porque los ingresos pueden contar para otro mes. */
const rangoControl = (mes: Mes): [Fecha, Fecha] => [sumarMeses(mes, -1), finDeMes(sumarMeses(mes, 1))]

export interface DatosControl {
  control: Control
  presupuestos: Presupuesto[]
  movimientos: Movimiento[]
}

export function useControlMes(mes: Mes): { datos: DatosControl | null; cargando: boolean; error: Error | null } {
  const [desde, hasta] = rangoControl(mes)
  const movs = useQuery(opcMovimientos(desde, hasta))
  const pagos = useQuery(opcPagosFijos(mes, mes))
  const fijos = useQuery(opcFijos())
  const omitidos = useQuery(opcOmitidos())
  const fechas = useQuery(opcFechasFijos())
  const presupuestos = useQuery(opcPresupuestos())
  const ajustes = useQuery(opcAjustes())
  const consultas = [movs, pagos, fijos, omitidos, fechas, presupuestos, ajustes]

  const datos = useMemo(() => {
    if (!movs.data || !pagos.data || !fijos.data || !omitidos.data || !fechas.data || !presupuestos.data || !ajustes.data) {
      return null
    }
    return {
      control: calcularControl({
        mes,
        hoy: hoyISO(),
        movimientos: movs.data,
        presupuestos: presupuestos.data,
        ajustes: ajustes.data,
        fijos: fijos.data,
        pagos: pagos.data,
        omitidos: omitidos.data,
        fechas: fechas.data,
      }),
      presupuestos: presupuestos.data,
      movimientos: movs.data,
    }
  }, [mes, movs.data, pagos.data, fijos.data, omitidos.data, fechas.data, presupuestos.data, ajustes.data])

  return {
    datos,
    cargando: !datos && consultas.some((c) => c.isPending),
    error: consultas.find((c) => c.error)?.error ?? null,
  }
}

/** Igual que `useControlMes`, pero pidiendo los datos frescos: se usa justo después de guardar algo. */
export async function calcularControlActual(qc: QueryClient, mes: Mes): Promise<DatosControl> {
  const [desde, hasta] = rangoControl(mes)
  const [movimientos, pagos, fijos, omitidos, fechas, presupuestos, ajustes] = await Promise.all([
    qc.fetchQuery({ ...opcMovimientos(desde, hasta), staleTime: 0 }),
    qc.fetchQuery({ ...opcPagosFijos(mes, mes), staleTime: 0 }),
    qc.fetchQuery(opcFijos()),
    qc.fetchQuery(opcOmitidos()),
    qc.fetchQuery(opcFechasFijos()),
    qc.fetchQuery(opcPresupuestos()),
    qc.fetchQuery(opcAjustes()),
  ])
  return {
    control: calcularControl({ mes, hoy: hoyISO(), movimientos, presupuestos, ajustes, fijos, pagos, omitidos, fechas }),
    presupuestos,
    movimientos,
  }
}

export const useTodosMovimientos = () => useQuery(opcTodosMovimientos())
export const useFijos = () => useQuery(opcFijos())
export const useOmitidos = () => useQuery(opcOmitidos())
export const useFechasFijos = () => useQuery(opcFechasFijos())
export const useGrupos = () => useQuery(opcGrupos())
export const useOtrosSaldos = () => useQuery(opcOtrosSaldos())
export const useHistorialSaldos = () => useQuery(opcHistorialSaldos())

/** Acciones sobre grupos de gastos: refrescan los grupos y los movimientos. */
export function useAccionesGrupos() {
  const qc = useQueryClient()
  return useMemo(() => {
    const refrescar = () => Promise.all(['grupos', 'movimientos'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
    return {
      async crear(g: NuevoGrupo) {
        const r = await dataSource.grupos.crear(g)
        await refrescar()
        return r
      },
      /** Si cambian el nombre o la categoría, las entradas ya apuntadas se actualizan también. */
      async actualizar(id: string, cambios: Partial<NuevoGrupo>) {
        const r = await dataSource.grupos.actualizar(id, cambios)
        if (cambios.nombre !== undefined || cambios.categoriaId !== undefined) {
          await dataSource.movimientos.actualizarEntradasGrupo(id, { nota: r.nombre, categoriaId: r.categoriaId })
        }
        await qc.invalidateQueries({ queryKey: ['saldos'] })
        await refrescar()
        return r
      },
      async borrar(id: string) {
        await dataSource.grupos.borrar(id)
        await refrescar()
      },
    }
  }, [qc])
}

/** Acciones sobre otros saldos y su historial. */
export function useAccionesOtrosSaldos() {
  const qc = useQueryClient()
  return useMemo(() => {
    const refrescar = () =>
      Promise.all(['otrosSaldos', 'historialSaldos'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
    return {
      async crear(o: NuevoOtroSaldo) {
        const r = await dataSource.otrosSaldos.crear(o)
        await refrescar()
        return r
      },
      async actualizar(id: string, cambios: Partial<NuevoOtroSaldo>) {
        const r = await dataSource.otrosSaldos.actualizar(id, cambios)
        await refrescar()
        return r
      },
      async borrar(id: string) {
        await dataSource.otrosSaldos.borrar(id)
        await refrescar()
      },
      async registrarSaldo(otroSaldoId: string, saldo: number, fechaHora?: FechaHora) {
        const r = await dataSource.otrosSaldos.registrarSaldo(otroSaldoId, saldo, fechaHora)
        await refrescar()
        return r
      },
      async borrarActualizacion(id: string) {
        await dataSource.otrosSaldos.borrarActualizacion(id)
        await refrescar()
      },
    }
  }, [qc])
}
export const usePresupuestos = () => useQuery(opcPresupuestos())
export const usePagosFijos = (desde: Mes, hasta: Mes) => useQuery(opcPagosFijos(desde, hasta))

/** Acciones sobre fijos y presupuestos: funciones normales que refrescan lo que toca. */
export function useAccionesFijos() {
  const qc = useQueryClient()
  return useMemo(() => {
    const refrescar = () =>
      Promise.all(
        ['fijos', 'omitidos', 'fechasFijos', 'movimientos', 'saldos'].map((k) => qc.invalidateQueries({ queryKey: [k] })),
      )
    return {
      async crear(f: Parameters<typeof dataSource.fijos.crear>[0]) {
        const r = await dataSource.fijos.crear(f)
        await refrescar()
        return r
      },
      async actualizar(id: string, cambios: Parameters<typeof dataSource.fijos.actualizar>[1]) {
        const r = await dataSource.fijos.actualizar(id, cambios)
        await refrescar()
        return r
      },
      async borrar(id: string) {
        await dataSource.fijos.borrar(id)
        await refrescar()
      },
      async omitir(fijoId: string, mes: Mes) {
        await dataSource.fijos.omitir(fijoId, mes)
        await refrescar()
      },
      async quitarOmision(fijoId: string, mes: Mes) {
        await dataSource.fijos.quitarOmision(fijoId, mes)
        await refrescar()
      },
      async fijarFecha(fijoId: string, mes: Mes, fecha: Fecha) {
        await dataSource.fijos.fijarFecha(fijoId, mes, fecha)
        await refrescar()
      },
      async quitarFecha(fijoId: string, mes: Mes) {
        await dataSource.fijos.quitarFecha(fijoId, mes)
        await refrescar()
      },
    }
  }, [qc])
}

/** Cambio de presupuesto con su alcance ("solo este mes" o "este mes y los siguientes"); ver src/lib/presupuestos.ts. */
export function useAccionesPresupuestos() {
  const qc = useQueryClient()
  return useMemo(
    () => ({
      async cambiar(ps: Presupuesto[], mes: Mes, categoriaId: string | null, nuevo: number | null, alcance: Alcance) {
        const plan = planCambioPresupuesto(ps, mes, categoriaId, nuevo, alcance)
        for (const c of plan.guardar) await dataSource.presupuestos.guardar(c.mes, c.categoriaId, c.importe)
        if (plan.eliminarPosteriores) await dataSource.presupuestos.eliminarPosteriores(mes, categoriaId)
        await qc.invalidateQueries({ queryKey: ['presupuestos'] })
      },
    }),
    [qc],
  )
}
