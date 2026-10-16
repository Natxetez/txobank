import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useEconomia } from '../data/EconomiaContext'
import { Hoja } from './Hoja'
import { HojaEconomia } from './HojaEconomia'
import { Icono } from './Icono'

/** Botón con la economía activa; al tocarlo, una hoja para cambiar de economía o crear otra. */
export function SelectorEconomia() {
  const { economias, activa, cambiar } = useEconomia()
  const [abierta, setAbierta] = useState(false)
  const [nueva, setNueva] = useState(false)

  return (
    <>
      <button
        type="button"
        className="selector-economia"
        aria-haspopup="dialog"
        aria-label={`Economía: ${activa.nombre}. Cambiar de economía`}
        onClick={() => setAbierta(true)}
      >
        <span className="punto" style={{ background: activa.color }} aria-hidden="true" />
        <span className="selector-economia-nombre">{activa.nombre}</span>
        <Icono nombre="abajo" className="chevron" />
      </button>

      {abierta && (
        <Hoja titulo="Economías" onCerrar={() => setAbierta(false)}>
          <ul className="lista" aria-label="Elige economía">
            {economias.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="fila"
                  aria-current={e.id === activa.id ? 'true' : undefined}
                  onClick={() => {
                    setAbierta(false)
                    if (e.id !== activa.id) cambiar(e.id)
                  }}
                >
                  <span className="punto" style={{ background: e.color }} aria-hidden="true" />
                  <span className="fila-texto">{e.nombre}</span>
                  {e.id === activa.id && <Icono nombre="check" className="marca-activa" />}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="secundario-btn"
            onClick={() => {
              setAbierta(false)
              setNueva(true)
            }}
          >
            Nueva economía
          </button>
          <Link className="enlace-texto centrado" to="/ajustes/economias" onClick={() => setAbierta(false)}>
            Gestionar economías
          </Link>
        </Hoja>
      )}
      {nueva && <HojaEconomia onCerrar={() => setNueva(false)} />}
    </>
  )
}
