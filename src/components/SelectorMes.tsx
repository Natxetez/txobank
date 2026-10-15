import type { ReactNode } from 'react'
import type { Mes } from '../data/types'
import { etiquetaMes, sumarMeses } from '../lib/meses'
import { Icono } from './Icono'

interface Props {
  mes: Mes
  onCambiar: (mes: Mes) => void
  /** Título; por defecto, "septiembre 2026". */
  titulo?: string
  /** Botones extra a la derecha (por ejemplo, el modo discreto). */
  children?: ReactNode
}

/** Cabecera "‹ septiembre 2026 ›" de las pantallas que van por meses. */
export function SelectorMes({ mes, onCambiar, titulo, children }: Props) {
  return (
    <div className="selector-mes">
      <div className="selector-lado">
        <button type="button" aria-label="Mes anterior" onClick={() => onCambiar(sumarMeses(mes, -1))}>
          <Icono nombre="izquierda" />
        </button>
      </div>
      <h1>{titulo ?? etiquetaMes(mes)}</h1>
      <div className="selector-lado derecha">
        <button type="button" aria-label="Mes siguiente" onClick={() => onCambiar(sumarMeses(mes, 1))}>
          <Icono nombre="derecha" />
        </button>
        {children}
      </div>
    </div>
  )
}
