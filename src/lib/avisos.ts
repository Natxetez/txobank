import type { Control } from './control'
import { nivelPresupuesto } from './presupuestos'

export interface AvisoGasto {
  texto: string
  /** true si con este gasto se cruza el 80 % o el 100 % de la categoría o del límite del mes. */
  destacado: boolean
}

interface Entrada {
  importe: number
  categoriaNombre: string
  /** Gasto neto de la categoría en el mes, ya con este gasto incluido. */
  gastadoCategoria: number
  presupuestoCategoria: number | null
  /** Control del mes calculado con este gasto ya incluido. */
  control: Control
  fmt: (centimos: number) => string
}

const pctDe = (parte: number, total: number) => (total > 0 ? parte / total : 1)

/** Cruce de umbral: 0 = ninguno, 1 = supera el 80 %, 2 = alcanza el 100 %. */
function umbral(gastado: number, limite: number): number {
  const n = nivelPresupuesto(gastado, limite)
  return n === 'superado' ? 2 : n === 'aviso' ? 1 : 0
}

/**
 * Aviso que sale tras guardar un gasto: estado de su categoría si tiene presupuesto ("Comida: 172 € de 200 €")
 * y del límite del mes, destacando si este gasto cruza el 80 % o el 100 %.
 */
export function avisoTrasGasto({ importe, categoriaNombre, gastadoCategoria, presupuestoCategoria, control, fmt }: Entrada): AvisoGasto {
  const partes: string[] = []
  let destacado = false

  if (presupuestoCategoria !== null) {
    const antes = umbral(gastadoCategoria - importe, presupuestoCategoria)
    const despues = umbral(gastadoCategoria, presupuestoCategoria)
    partes.push(`${categoriaNombre}: ${fmt(gastadoCategoria)} de ${fmt(presupuestoCategoria)}`)
    if (despues > antes) {
      destacado = true
      partes.push(despues === 2 ? 'has superado el presupuesto' : `llevas el ${Math.round(pctDe(gastadoCategoria, presupuestoCategoria) * 100)} %`)
    }
  }

  if (control.limite && control.limite.valor > 0) {
    const gasto = control.resumen.gastoNeto
    const antes = umbral(gasto - importe, control.limite.valor)
    const despues = umbral(gasto, control.limite.valor)
    if (despues > antes) {
      destacado = true
      partes.push(despues === 2 ? 'has superado el límite del mes' : 'ya llevas más del 80 % del límite del mes')
    }
  }

  return { texto: partes.join(' · '), destacado }
}
