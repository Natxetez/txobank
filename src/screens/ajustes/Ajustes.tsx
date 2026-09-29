import { useState } from 'react'
import { Link } from 'react-router-dom'
import { entregarCsv } from '../../components/exportarCsv'
import { dataSource } from '../../data'
import { opcFijos } from '../../data/consultas'
import { useSesion } from '../../data/SesionContext'
import { mensajeError } from '../../data/hooks'
import { useQueryClient } from '@tanstack/react-query'

const ENLACES = [
  { a: '/presupuestos', t: 'Presupuestos' },
  { a: '/ajustes/ahorro', t: 'Objetivo de ahorro' },
  { a: '/ajustes/fijos', t: 'Fijos' },
  { a: '/ajustes/cuentas', t: 'Cuentas' },
  { a: '/ajustes/categorias', t: 'Categorías' },
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
            <span>{e.t}</span>
            <span className="secundario">›</span>
          </Link>
        ))}
        <button className="fila" onClick={() => void exportar()} disabled={exportando}>
          <span>{exportando ? 'Preparando…' : 'Exportar a CSV'}</span>
          <span className="secundario">↥</span>
        </button>
      </nav>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="secundario">Sesión iniciada como {sesion?.email}</p>
      <button className="secundario-btn" onClick={() => dataSource.sesion.cerrar()}>
        Cerrar sesión
      </button>
    </section>
  )
}
