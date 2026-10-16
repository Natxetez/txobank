import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { calcularControlActual } from '../data/consultas'
import { useAccionesMovimiento } from '../data/hooks'
import type { Categoria, Movimiento } from '../data/types'
import { avisoTrasGasto } from '../lib/avisos'
import { mesDeFecha } from '../lib/meses'
import { presupuestoVigente } from '../lib/presupuestos'
import { useAviso } from './Avisos'
import { useFmt } from './Discreto'

const NOMBRE_TIPO: Record<Movimiento['tipo'], string> = {
  gasto: 'Gasto',
  ingreso: 'Ingreso',
  devolucion: 'Devolución',
  traspaso: 'Traspaso',
}

/**
 * Aviso tras guardar un movimiento, con Deshacer. En los gastos añade, en cuanto se calcula, el estado
 * de su categoría y del límite del mes ("Comida: 172 € de 200 €"), destacándolo si cruza el 80 % o el 100 %.
 * `deshacer` deja la base de datos como estaba (por defecto, borra el movimiento).
 */
export function useAvisoGuardado() {
  const aviso = useAviso()
  const fmt = useFmt()
  const qc = useQueryClient()
  const acciones = useAccionesMovimiento()

  return useCallback(
    async (creado: Movimiento, deshacer?: () => Promise<unknown>) => {
      // Por defecto se borra (con su otra mitad, si es un traspaso entre economías).
      const accion = { etiqueta: 'Deshacer', alHacer: deshacer ?? (() => acciones.eliminar(creado)) }
      const basico = `${NOMBRE_TIPO[creado.tipo]} de ${fmt(creado.importe)} guardado`
      aviso.mostrar(basico, accion)
      if (creado.tipo !== 'gasto' || !creado.categoriaId) return

      try {
        const mes = mesDeFecha(creado.fecha)
        const { control, presupuestos } = await calcularControlActual(qc, mes)
        const categorias = qc.getQueryData<Categoria[]>(['categorias']) ?? []
        const nombre = categorias.find((c) => c.id === creado.categoriaId)?.nombre ?? 'Categoría'
        const extra = avisoTrasGasto({
          importe: creado.importe,
          categoriaNombre: nombre,
          gastadoCategoria: control.resumen.porCategoria[creado.categoriaId] ?? 0,
          presupuestoCategoria: presupuestoVigente(presupuestos, mes, creado.categoriaId).importe,
          control,
          fmt,
        })
        if (extra.texto) {
          const texto = extra.texto[0].toUpperCase() + extra.texto.slice(1)
          aviso.mostrar(`${basico}. ${texto}`, accion, extra.destacado)
        }
      } catch {
        /* el aviso básico ya se ha mostrado */
      }
    },
    [aviso, fmt, qc, acciones],
  )
}
