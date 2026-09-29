import { Link } from 'react-router-dom'
import { TarjetaRecomendacion } from '../components/TarjetaRecomendacion'
import { useRecomendaciones } from '../data/recomendaciones'

export function Recomendaciones() {
  const { cargando, visibles, total, faltanDatos, descartar } = useRecomendaciones()
  return (
    <section className="pantalla ancho">
      <h1>Recomendaciones</h1>
      {cargando ? (
        <p className="secundario">Calculando…</p>
      ) : (
        <>
          {visibles.length === 0 && (
            <p className="vacio">
              {faltanDatos
                ? 'Cuando tengas 2 meses de movimientos, aquí aparecerán más recomendaciones sobre tus gastos.'
                : 'Ahora mismo no hay nada que recomendarte. ¡Buen trabajo!'}
            </p>
          )}
          {visibles.map((r) => (
            <TarjetaRecomendacion key={r.id} recomendacion={r} onDescartar={() => descartar(r.id)} />
          ))}
          {total > visibles.length && (
            <p className="secundario pequeno">Hay {total - visibles.length} más; salen cuando resuelvas o descartes estas.</p>
          )}
          {visibles.length > 0 && faltanDatos && (
            <p className="secundario pequeno">Cuando tengas 2 meses de movimientos, aquí aparecerán más recomendaciones sobre tus gastos.</p>
          )}
        </>
      )}
      <Link to="/estadisticas" className="enlace">
        Ir a Estadísticas
      </Link>
    </section>
  )
}
