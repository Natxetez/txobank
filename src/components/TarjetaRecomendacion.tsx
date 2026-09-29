import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccionesPresupuestos, usePresupuestos } from '../data/consultas'
import { mensajeError } from '../data/hooks'
import type { Recomendacion } from '../lib/recomendaciones'
import { hoyISO, mesDeFecha } from '../lib/meses'

interface Props {
  recomendacion: Recomendacion
  onDescartar: () => void
}

/** Tarjeta con título, explicación con cifras reales y, si tiene sentido, una acción. */
export function TarjetaRecomendacion({ recomendacion: r, onDescartar }: Props) {
  const presupuestos = usePresupuestos()
  const acciones = useAccionesPresupuestos()
  const [error, setError] = useState<string | null>(null)
  const [creado, setCreado] = useState(false)
  const a = r.accion

  async function crearPresupuesto(categoriaId: string, importe: number) {
    setError(null)
    try {
      await acciones.cambiar(presupuestos.data ?? [], mesDeFecha(hoyISO()), categoriaId, importe, 'siguientes')
      setCreado(true)
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  const params = (mes: string, categoriaId?: string) => {
    const q = new URLSearchParams({ mes })
    if (categoriaId) q.set('categoria', categoriaId)
    return `/movimientos?${q.toString()}`
  }

  return (
    <article className={`reco ${r.tipo}`}>
      <div className="reco-cab">
        <h3>{r.titulo}</h3>
        <button type="button" className="cerrar" aria-label="Descartar hasta el mes que viene" onClick={onDescartar}>
          ✕
        </button>
      </div>
      <p>{r.texto}</p>
      {a?.tipo === 'ver-movimientos' && (
        <Link className="enlace" to={params(a.mes, a.categoriaId)}>
          Ver movimientos
        </Link>
      )}
      {a?.tipo === 'revisar-fijos' && (
        <Link className="enlace" to="/ajustes/fijos">
          Revisar mis fijos
        </Link>
      )}
      {a?.tipo === 'ver-presupuestos' && (
        <Link className="enlace" to="/presupuestos">
          Ver presupuestos
        </Link>
      )}
      {a?.tipo === 'crear-presupuesto' &&
        (creado ? (
          <p className="ok">Presupuesto creado.</p>
        ) : (
          <button type="button" className="chip activo" onClick={() => void crearPresupuesto(a.categoriaId, a.importe)}>
            Crear el presupuesto
          </button>
        ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}
