import { Icono } from '../components/Icono'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useHojaMovimiento } from '../components/ContextoMovimiento'
import { useFmt } from '../components/Discreto'
import { usePresupuestos, useTodosMovimientos } from '../data/consultas'
import { useCategorias } from '../data/hooks'
import { detalleCategoria } from '../lib/estadisticas'
import { etiquetaMes, formatoDia, mesActual } from '../lib/meses'

const EJE = { fill: 'var(--secundario)', fontSize: 11 }
const ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export default function CategoriaDetalle() {
  const { id = '' } = useParams()
  const fmt = useFmt()
  const hoja = useHojaMovimiento()
  const todos = useTodosMovimientos()
  const categorias = useCategorias().data ?? []
  const presupuestos = usePresupuestos()
  const categoria = categorias.find((c) => c.id === id)

  const detalle = useMemo(
    () => (todos.data && presupuestos.data ? detalleCategoria(todos.data, id, mesActual(), presupuestos.data) : null),
    [todos.data, presupuestos.data, id],
  )

  if (!detalle) return <p className="secundario">Cargando…</p>
  const eje = (v: number) => (fmt(1) === '•••' ? '' : `${Math.round(v / 100)}`)

  return (
    <section className="pantalla ancho">
      <Link to="/estadisticas" className="volver">
        <Icono nombre="izquierda" />
        Estadísticas
      </Link>
      <h1>
        {categoria?.icono ? `${categoria.icono} ` : ''}
        {categoria?.nombre ?? 'Categoría'}
      </h1>

      <section className="bloque grafico">
        <h2>Últimos 12 meses</h2>
        <div className="alto-grafico corto">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={detalle.meses} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--borde)" vertical={false} />
              <XAxis dataKey="mes" tickFormatter={(m: string) => ABREV[Number(m.slice(5, 7)) - 1]} tick={EJE} tickLine={false} axisLine={false} />
              <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={eje} width={44} />
              <Tooltip formatter={(v) => fmt(Number(v))} labelFormatter={(m) => etiquetaMes(String(m))} contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 10 }} />
              <Bar dataKey="importe" name="Gasto" fill={categoria?.color ?? 'var(--principal)'} radius={[4, 4, 0, 0]} />
              <Line type="stepAfter" dataKey="presupuesto" name="Presupuesto" stroke="var(--peligro)" strokeDasharray="4 4" dot={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="leyenda">
          <span className="l l-variable">Gasto</span>
          <span className="l l-limite">Presupuesto de cada mes</span>
        </p>
      </section>

      <div className="tiles">
        <div className="tile">
          <span className="secundario pequeno">Media mensual</span>
          <strong className="cifra">{fmt(Math.round(detalle.media))}</strong>
        </div>
        <div className="tile">
          <span className="secundario pequeno">Movimientos</span>
          <strong className="cifra">{detalle.numeroGastos}</strong>
        </div>
        <div className="tile">
          <span className="secundario pequeno">Ticket medio</span>
          <strong className="cifra">{detalle.ticketMedio === null ? '—' : fmt(Math.round(detalle.ticketMedio))}</strong>
        </div>
      </div>

      <section className="bloque">
        <h2>Los 5 mayores gastos</h2>
        {detalle.mayores.length === 0 ? (
          <p className="secundario">Sin gastos en los últimos 12 meses.</p>
        ) : (
          <ul className="lista">
            {detalle.mayores.map((m) => (
              <li key={m.id}>
                <button className="fila" onClick={() => hoja.abrirEditar(m)}>
                  <span className="fila-texto">
                    <span>{m.nota || categoria?.nombre}</span>
                    <span className="secundario pequeno">{formatoDia(m.fecha)}</span>
                  </span>
                  <span className="cifra">{fmt(m.importe)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
