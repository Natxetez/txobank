import { useNavigate } from 'react-router-dom'
import { Icono } from './Icono'

/** Enlace "‹ Volver" a la pantalla anterior, para pantallas a las que se llega desde varios sitios. */
export function Volver() {
  const navigate = useNavigate()
  return (
    <button type="button" className="volver" onClick={() => navigate(-1)}>
      <Icono nombre="izquierda" />
      Volver
    </button>
  )
}
