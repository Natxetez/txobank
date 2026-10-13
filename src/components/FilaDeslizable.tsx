import { useRef, useState } from 'react'
import type { ReactNode } from 'react'

const ANCHO_BOTON = 88

interface Props {
  children: ReactNode
  onTocar: () => void
  onEliminar: () => void
  etiquetaEliminar: string
}

/** Fila que se desliza a la izquierda para mostrar "Eliminar". */
export function FilaDeslizable({ children, onTocar, onEliminar, etiquetaEliminar }: Props) {
  const [desplazamiento, setDesplazamiento] = useState(0)
  const [abierta, setAbierta] = useState(false)
  const inicio = useRef<{ x: number; y: number } | null>(null)
  const horizontal = useRef(false)

  const limitar = (n: number) => Math.max(-ANCHO_BOTON, Math.min(0, n))

  return (
    <div className={desplazamiento < 0 ? 'deslizable moviendo' : 'deslizable'}>
      <button type="button" className="deslizable-borrar" tabIndex={abierta ? 0 : -1} onClick={onEliminar}>
        {etiquetaEliminar}
      </button>
      <div
        className="deslizable-contenido"
        style={{ transform: `translateX(${desplazamiento}px)` }}
        onTouchStart={(e) => {
          inicio.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
          horizontal.current = false
        }}
        onTouchMove={(e) => {
          if (!inicio.current) return
          const dx = e.touches[0].clientX - inicio.current.x
          const dy = e.touches[0].clientY - inicio.current.y
          if (!horizontal.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) horizontal.current = true
          if (horizontal.current) setDesplazamiento(limitar(dx + (abierta ? -ANCHO_BOTON : 0)))
        }}
        onTouchEnd={() => {
          if (horizontal.current) {
            const abrir = desplazamiento < -ANCHO_BOTON / 2
            setAbierta(abrir)
            setDesplazamiento(abrir ? -ANCHO_BOTON : 0)
          }
          inicio.current = null
        }}
      >
        <button
          type="button"
          className="fila"
          onClick={() => {
            if (abierta) {
              setAbierta(false)
              setDesplazamiento(0)
            } else onTocar()
          }}
        >
          {children}
        </button>
      </div>
    </div>
  )
}
