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

const ENLACES: { a: string; t: string; icono: NombreIcono; color: string }[] = [
  { a: '/presupuestos', t: 'Presupuestos', icono: 'presupuesto', color: '#12B886' },
  { a: '/ajustes/ahorro', t: 'Objetivo de ahorro', icono: 'hucha', color: '#F59F00' },
  { a: '/ajustes/fijos', t: 'Fijos', icono: 'repetir', color: '#4C6EF5' },
  { a: '/ajustes/cuentas', t: 'Cuentas', icono: 'cartera', color: '#15AABF' },
  { a: '/ajustes/categorias', t: 'Categorías', icono: 'etiqueta', color: '#E64980' },
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
      const [movs, cuentas, categorias, fijos] = await Promise.all([
        dataSource.movimientos.listar('2000-01-01', '2100-12-31'),
        dataSource.cuentas.listar(),
        dataSource.categorias.listar(),
        qc.fetchQuery(opcFijos()),
      ])
      await entregarCsv(movs, cuentas, categorias, fijos)
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
    </section>
  )
}
