import { Cabecera } from '../../components/Cabecera'
import { config } from '../../config'
import { useSesion } from '../../data/SesionContext'
import { COMMIT, FECHA_BUILD, VERSION } from '../../version'

const formatoFecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

function fechaCompilacion(): string {
  const fecha = new Date(FECHA_BUILD)
  return Number.isNaN(fecha.getTime()) ? FECHA_BUILD : formatoFecha.format(fecha)
}

const nombreBackend = () => ((config.backend ?? 'supabase') === 'memoria' ? 'Memoria (datos de ejemplo)' : 'Supabase')

export function AcercaDe() {
  const sesion = useSesion()
  const datos: [string, string][] = [
    ['Versión', VERSION],
    ['Commit', COMMIT],
    ['Compilada', fechaCompilacion()],
    ['Base de datos', nombreBackend()],
    ['Usuario', sesion?.email ?? '—'],
  ]

  return (
    <section className="pantalla ancho">
      <Cabecera titulo="Acerca de" />
      <div className="acerca-marca">
        <div className="logo" aria-hidden="true">T</div>
        <h2>TxoBank</h2>
        <p className="secundario">Tu mes, bajo control.</p>
      </div>
      <dl className="lista datos-app">
        {datos.map(([t, v]) => (
          <div key={t} className="fila">
            <dt>{t}</dt>
            <dd className={t === 'Versión' || t === 'Commit' ? 'cifra' : undefined}>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
