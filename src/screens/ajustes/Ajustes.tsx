import { Icono, IconoCategoria } from '../../components/Icono'
import type { NombreIcono } from '../../components/Icono'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { entregarCsv } from '../../components/exportarCsv'
import { dataSource } from '../../data'
import { opcFijos } from '../../data/consultas'
import { useSesion } from '../../data/SesionContext'
import { mensajeError } from '../../data/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { Hoja } from '../../components/Hoja'
import { VERSION } from '../../version'

const ENLACES: { a: string; t: string; icono: NombreIcono; color: string }[] = [
  { a: '/presupuestos', t: 'Presupuestos', icono: 'presupuesto', color: '#12B886' },
  { a: '/ajustes/ahorro', t: 'Objetivo de ahorro', icono: 'hucha', color: '#F59F00' },
  { a: '/ajustes/fijos', t: 'Fijos', icono: 'repetir', color: '#4C6EF5' },
  { a: '/ajustes/cuentas', t: 'Cuentas', icono: 'cartera', color: '#15AABF' },
  { a: '/ajustes/categorias', t: 'Categorías', icono: 'etiqueta', color: '#E64980' },
  { a: '/ajustes/grupos', t: 'Grupos de gastos', icono: 'movimientos', color: '#F76707' },
  { a: '/ajustes/otros-saldos', t: 'Otros saldos', icono: 'hucha', color: '#7950F2' },
  { a: '/ajustes/seguridad', t: 'Seguridad', icono: 'candado', color: '#495057' },
]

export function Ajustes() {
  const sesion = useSesion()
  const qc = useQueryClient()
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function exportar() {
    setError(null)
    setExportando(true)
    try {
      const [movs, cuentas, categorias, fijos, grupos] = await Promise.all([
        dataSource.movimientos.listar('2000-01-01', '2100-12-31'),
        dataSource.cuentas.listar(),
        dataSource.categorias.listar(),
        qc.fetchQuery(opcFijos()),
        dataSource.grupos.listar(),
      ])
      await entregarCsv(movs, cuentas, categorias, fijos, grupos)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setExportando(false)
    }
  }

  return (
    <section className="pantalla ancho">
      <h1>Ajustes</h1>
      <nav className="lista" aria-label="Ajustes">
        {ENLACES.map((e) => (
          <Link key={e.a} to={e.a} className="fila">
            <IconoCategoria color={e.color}>
              <Icono nombre={e.icono} />
            </IconoCategoria>
            <span className="fila-texto">{e.t}</span>
            <Icono nombre="derecha" className="chevron" />
          </Link>
        ))}
        <button className="fila" onClick={() => void exportar()} disabled={exportando}>
          <IconoCategoria color="#7950F2">
            <Icono nombre="exportar" />
          </IconoCategoria>
          <span className="fila-texto">{exportando ? 'Preparando…' : 'Exportar a CSV'}</span>
        </button>
      </nav>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <nav className="lista" aria-label="Información">
        <Link to="/ajustes/acerca-de" className="fila">
          <IconoCategoria color="#5E6E66">
            <Icono nombre="resumen" />
          </IconoCategoria>
          <span className="fila-texto">Acerca de</span>
          <span className="secundario cifra fila-valor">v{VERSION}</span>
          <Icono nombre="derecha" className="chevron" />
        </Link>
      </nav>
      <ul className="lista">
        <li>
          <button className="fila" onClick={() => dataSource.sesion.cerrar()}>
            <IconoCategoria color="#E03131">
              <Icono nombre="salir" />
            </IconoCategoria>
            <span className="fila-texto">
              <span>Cerrar sesión</span>
              <span className="secundario pequeno">{sesion?.email}</span>
            </span>
          </button>
        </li>
      </ul>
      <ZonaPruebas />
    </section>
  )
}

/** Temporal: solo mientras la app está en pruebas. Borra todos los datos del usuario (no el usuario). */
function ZonaPruebas() {
  const qc = useQueryClient()
  const [abierta, setAbierta] = useState(false)
  const [texto, setTexto] = useState('')
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmado = texto.trim().toUpperCase() === 'BORRAR'

  function cerrar() {
    if (borrando) return
    setAbierta(false)
    setTexto('')
    setError(null)
  }

  async function borrar() {
    setError(null)
    setBorrando(true)
    try {
      await dataSource.mantenimiento.borrarTodo()
      qc.clear()
      window.location.reload()
    } catch (err) {
      setError(mensajeError(err))
      setBorrando(false)
    }
  }

  return (
    <div className="zona-pruebas">
      <p className="zona-pruebas-titulo">Zona de pruebas</p>
      <p className="secundario pequeno">
        Solo mientras la app está en pruebas. Desaparecerá en la versión definitiva.
      </p>
      <button type="button" className="secundario-btn borrar" onClick={() => setAbierta(true)}>
        Borrar todo
      </button>
      {abierta && (
        <Hoja titulo="Borrar todo" onCerrar={cerrar}>
          <form
            className="formulario"
            onSubmit={(e) => {
              e.preventDefault()
              if (confirmado && !borrando) void borrar()
            }}
          >
            <p className="aviso-suma">
              Se borrarán todos tus datos: movimientos, fijos, presupuestos, grupos, otros saldos, categorías,
              cuentas y ajustes. Tu usuario se mantiene. No se puede deshacer.
            </p>
            <label className="campo">
              Escribe BORRAR para confirmar
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="BORRAR"
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="peligro" disabled={!confirmado || borrando}>
              {borrando ? 'Borrando…' : 'Borrar todo'}
            </button>
          </form>
        </Hoja>
      )}
    </div>
  )
}
