import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface Props {
  titulo: string
  onCerrar: () => void
  children: ReactNode
}

/** Hoja inferior para formularios (SPEC.md, sección 12). */
export function Hoja({ titulo, onCerrar, children }: Props) {
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [onCerrar])

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="hoja-cab">
          <h2>{titulo}</h2>
          <button type="button" className="cerrar" aria-label="Cerrar" onClick={onCerrar}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
