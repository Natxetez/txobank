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
import { useEconomia } from '../../data/EconomiaContext'
import { textoUltimaCopia } from './ultimaCopia'
import { VERSION } from '../../version'
import { guardarTema, leerTema } from '../../tema'
import type { Tema } from '../../tema'

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
  const { activa, economias } = useEconomia()
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
      <nav className="lista" aria-label="Economía">
        <Link to="/ajustes/economias" className="fila">
          <IconoCategoria color={activa.color}>
            <Icono nombre="capas" />
          </IconoCategoria>
          <span className="fila-texto">
            <span>Economías</span>
            <span className="secundario pequeno">
              {economias.length > 1 ? `Estás en ${activa.nombre} · ${economias.length} economías` : `Estás en ${activa.nombre}`}
            </span>
          </span>
          <Icono nombre="derecha" className="chevron" />
        </Link>
        <Link to="/ajustes/copia" className="fila">
          <IconoCategoria color="#15AABF">
            <Icono nombre="exportar" />
          </IconoCategoria>
          <span className="fila-texto">
            <span>Copia de seguridad</span>
            <span className="secundario pequeno">{textoUltimaCopia()}</span>
          </span>
          <Icono nombre="derecha" className="chevron" />
        </Link>
      </nav>
      <p className="secundario pequeno ajustes-de">Ajustes de {activa.nombre}</p>
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
      <Apariencia />
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
    </section>
  )
}

const TEMAS: { valor: Tema; texto: string }[] = [
  { valor: 'sistema', texto: 'Automático' },
  { valor: 'claro', texto: 'Claro' },
  { valor: 'oscuro', texto: 'Oscuro' },
]

/** Tema de la app en este dispositivo: el del sistema, o claro u oscuro siempre. */
function Apariencia() {
  const [tema, setTema] = useState<Tema>(leerTema)
  return (
    <div className="apariencia">
      <p className="secundario pequeno ajustes-de">Apariencia</p>
      <div className="segmentado" role="radiogroup" aria-label="Tema">
        {TEMAS.map((t) => (
          <button
            key={t.valor}
            type="button"
            role="radio"
            aria-checked={tema === t.valor}
            className={tema === t.valor ? 'activa' : ''}
            onClick={() => {
              guardarTema(t.valor)
              setTema(t.valor)
            }}
          >
            {t.texto}
          </button>
        ))}
      </div>
      <p className="secundario pequeno">
        {tema === 'sistema' ? 'Sigue el modo claro u oscuro del iPhone.' : 'Se guarda en este dispositivo.'}
      </p>
    </div>
  )
}
