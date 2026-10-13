import { Icono } from '../components/Icono'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFmt } from '../components/Discreto'
import { useHojaMovimiento } from '../components/ContextoMovimiento'
import { useControlMes, useTodosMovimientos } from '../data/consultas'
import { useAjustes, useCategorias, useCuentas } from '../data/hooks'
import type { Categoria, Movimiento } from '../data/types'
import { objetivoAhorro } from '../lib/control'
import {
  PERIODOS,
  calendarioGasto,
  deCuenta,
  gastoPorCategoria,
  ingresosPorCategoria,
  mesesDelPeriodo,
  mesesPeriodoAnterior,
  patrimonioPorMes,
  rachaSinGasto,
  resumenPeriodo,
  serieMensual,
  serieRitmo,
  variacion,
} from '../lib/estadisticas'
import type { Periodo } from '../lib/estadisticas'
import { etiquetaMes, hoyISO, mesActual, mesesEntre, nombreMes, sumarMeses } from '../lib/meses'

const EJE = { fill: 'var(--secundario)', fontSize: 11 }
const ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const abreviaturaMes = (mes: string) => ABREV[Number(mes.slice(5, 7)) - 1]

function Variacion({ actual, anterior, buenoSiSube, etiqueta }: { actual: number; anterior: number; buenoSiSube: boolean; etiqueta: string }) {
  const v = variacion(actual, anterior)
  if (v === null || Math.abs(v) < 0.005) return null
  const sube = v > 0
  const bueno = sube === buenoSiSube
  return (
    <span className={bueno ? 'variacion buena' : 'variacion mala'}>
      {sube ? '↑' : '↓'} {Math.round(Math.abs(v) * 100)} % {etiqueta}
    </span>
  )
}

function Barras({
  filas,
  onTocar,
}: {
  filas: { id: string; etiqueta: string; valor: number; detalle?: React.ReactNode; color: string }[]
  onTocar?: (id: string) => void
}) {
  const fmt = useFmt()
  const max = Math.max(1, ...filas.map((f) => f.valor))
  return (
    <ul className="barras-h">
      {filas.map((f) => (
        <li key={f.id}>
          <button type="button" className="barra-h" disabled={!onTocar} onClick={() => onTocar?.(f.id)}>
            <span className="barra-h-cab">
              <span>{f.etiqueta}</span>
              <span className="cifra">{fmt(f.valor)}</span>
            </span>
            <span className="barra-fondo">
              <span style={{ width: `${(f.valor / max) * 100}%`, background: f.color }} />
            </span>
            {f.detalle && <span className="secundario pequeno">{f.detalle}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="bloque grafico">
      <h2>{titulo}</h2>
      {children}
    </section>
  )
}

export default function Estadisticas() {
  const fmt = useFmt()
  const nav = useNavigate()
  const hoja = useHojaMovimiento()
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [cuentaId, setCuentaId] = useState('')
  const [diaElegido, setDiaElegido] = useState<string | null>(null)

  const todos = useTodosMovimientos()
  const cuentas = useCuentas().data ?? []
  const categorias = useCategorias().data ?? []
  const ajustes = useAjustes().data
  const hoy = hoyISO()
  const mesHoy = mesActual()
  const { datos: control } = useControlMes(mesHoy)

  const movs = useMemo(() => deCuenta(todos.data ?? [], cuentaId || undefined), [todos.data, cuentaId])
  const meses = mesesDelPeriodo(periodo, mesHoy)
  const anteriores = mesesPeriodoAnterior(periodo, mesHoy)
  const mesesGrafico = periodo === 'mes' ? mesesEntre(sumarMeses(mesHoy, -5), mesHoy) : meses

  const resumen = useMemo(() => resumenPeriodo(movs, meses, hoy), [movs, meses, hoy])
  const previo = useMemo(() => resumenPeriodo(movs, anteriores, hoy), [movs, anteriores, hoy])
  const etiquetaPrevio = periodo === 'mes' ? `frente a ${nombreMes(anteriores[0])}` : 'frente al periodo anterior'

  const catInfo = (id: string): Categoria | undefined => categorias.find((c) => c.id === id)
  const filasCategorias = useMemo(() => gastoPorCategoria(movs, meses, anteriores), [movs, meses, anteriores])
  const filasIngresos = useMemo(() => ingresosPorCategoria(movs, meses), [movs, meses])
  const mensual = useMemo(() => serieMensual(movs, mesesGrafico), [movs, mesesGrafico])
  const patrimonio = useMemo(
    () => patrimonioPorMes(cuentas, todos.data ?? [], mesesGrafico, hoy, cuentaId || undefined),
    [cuentas, todos.data, mesesGrafico, hoy, cuentaId],
  )

  const fijosPendientes = control
    ? control.control.fijosMes
        .filter((i) => i.fijo.tipo === 'gasto' && (i.estado === 'pendiente' || i.estado === 'esperado') && (!cuentaId || i.fijo.cuentaId === cuentaId))
        .reduce((t, i) => t + i.fijo.importe, 0)
    : 0
  const ritmo = useMemo(() => serieRitmo(movs, mesHoy, hoy, fijosPendientes), [movs, mesHoy, hoy, fijosPendientes])
  const limite = !cuentaId ? (control?.control.limite?.valor ?? null) : null

  const calendario = useMemo(() => calendarioGasto(movs, mesHoy, hoy), [movs, mesHoy, hoy])
  const racha = useMemo(() => rachaSinGasto(movs, hoy), [movs, hoy])
  const delDia: Movimiento[] = diaElegido ? movs.filter((m) => m.fecha === diaElegido) : []

  const mesesConDatos = useMemo(() => {
    const set = new Set((todos.data ?? []).map((m) => `${m.fecha.slice(0, 7)}-01`))
    return mesesEntre(sumarMeses(mesHoy, -11), mesHoy).filter((m) => set.has(m)).reverse()
  }, [todos.data, mesHoy])

  const objetivo = ajustes ? objetivoAhorro(ajustes, resumen.ingresos) : 0
  const eje = (v: number) => (fmt(1) === '•••' ? '' : `${Math.round(v / 100)}`)
  const tip = (v: unknown) => fmt(Number(v))

  if (todos.isPending) return <p className="secundario">Cargando…</p>
  if (todos.error) {
    return (
      <p className="error" role="alert">
        {todos.error.message}
      </p>
    )
  }

  if ((todos.data ?? []).length === 0) {
    return (
      <section className="pantalla ancho">
        <h1>Estadísticas</h1>
        <p className="vacio">Aún no hay datos. Cuando apuntes tus primeros movimientos, aquí verás cómo evolucionan tus gastos.</p>
      </section>
    )
  }

  return (
    <section className="pantalla ancho estadisticas">
      <h1>Estadísticas</h1>

      <div className="pestanas" role="tablist" aria-label="Periodo">
        {PERIODOS.map((p) => (
          <button key={p.id} role="tab" aria-selected={periodo === p.id} className={periodo === p.id ? 'activa' : ''} onClick={() => setPeriodo(p.id)}>
            {p.etiqueta}
          </button>
        ))}
      </div>
      <select aria-label="Cuenta" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
        <option value="">Todas las cuentas</option>
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>

      <div className="tiles">
        <div className="tile">
          <span className="secundario pequeno">Ingresos</span>
          <strong className="cifra">{fmt(resumen.ingresos)}</strong>
          <Variacion actual={resumen.ingresos} anterior={previo.ingresos} buenoSiSube etiqueta={etiquetaPrevio} />
        </div>
        <div className="tile">
          <span className="secundario pequeno">Gasto neto</span>
          <strong className="cifra">{fmt(resumen.gastoNeto)}</strong>
          <span className="secundario pequeno">
            Fijo {fmt(resumen.gastoFijo)} · Variable {fmt(resumen.gastoVariable)}
          </span>
          <Variacion actual={resumen.gastoNeto} anterior={previo.gastoNeto} buenoSiSube={false} etiqueta={etiquetaPrevio} />
        </div>
        <div className="tile">
          <span className="secundario pequeno">Ahorro</span>
          <strong className="cifra">{fmt(resumen.ahorro)}</strong>
          <Variacion actual={resumen.ahorro} anterior={previo.ahorro} buenoSiSube etiqueta={etiquetaPrevio} />
        </div>
        <div className="tile">
          <span className="secundario pequeno">Tasa de ahorro</span>
          <strong className="cifra">{resumen.tasaAhorro === null ? '—' : `${Math.round(resumen.tasaAhorro * 100)} %`}</strong>
          {objetivo > 0 && <span className="secundario pequeno">Objetivo {fmt(objetivo)} al mes</span>}
        </div>
        <div className="tile">
          <span className="secundario pequeno">Variable medio al día</span>
          <strong className="cifra">{resumen.variableMedioDiario === null ? '—' : fmt(Math.round(resumen.variableMedioDiario))}</strong>
          {resumen.variableMedioDiario !== null && previo.variableMedioDiario !== null && (
            <Variacion actual={resumen.variableMedioDiario} anterior={previo.variableMedioDiario} buenoSiSube={false} etiqueta={etiquetaPrevio} />
          )}
        </div>
      </div>

      <Link to="/recomendaciones" className="enlace">
        Ver todas las recomendaciones
      </Link>

      <Tarjeta titulo="Ritmo del mes">
        <div className="alto-grafico">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={ritmo.puntos} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--borde)" vertical={false} />
              <XAxis dataKey="dia" tick={EJE} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={eje} width={44} />
              <Tooltip formatter={tip} labelFormatter={(d) => `Día ${d}`} contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 10 }} />
              {limite !== null && <ReferenceLine y={limite} stroke="var(--peligro)" strokeDasharray="4 4" />}
              <Line type="monotone" dataKey="media" name="Media 3 meses" stroke="var(--secundario)" strokeWidth={1.5} dot={false} connectNulls />
              <Line type="stepAfter" dataKey="real" name="Este mes" stroke="var(--principal)" strokeWidth={2.5} dot={false} connectNulls={false} />
              <Line type="linear" dataKey="proyeccion" name="Proyección" stroke="var(--principal)" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="leyenda">
          <span className="l l-real">Este mes</span>
          <span className="l l-media">Media 3 meses</span>
          <span className="l l-proy">Proyección {fmt(Math.round(ritmo.proyectadoFinMes))}</span>
          {limite !== null && <span className="l l-limite">Límite {fmt(limite)}</span>}
        </p>
      </Tarjeta>

      <Tarjeta titulo="Gasto por categoría">
        {filasCategorias.length === 0 ? (
          <p className="secundario">Sin gastos en este periodo.</p>
        ) : (
          <Barras
            filas={filasCategorias.map((f) => ({
              id: f.categoriaId,
              etiqueta: `${catInfo(f.categoriaId)?.icono ?? ''} ${catInfo(f.categoriaId)?.nombre ?? 'Sin categoría'}`,
              valor: f.importe,
              color: catInfo(f.categoriaId)?.color ?? 'var(--principal)',
              detalle: (
                <>
                  {Math.round(f.fraccion * 100)} % del total
                  {f.variacion !== null && ` · ${f.variacion > 0 ? '↑' : '↓'} ${Math.round(Math.abs(f.variacion) * 100)} % ${etiquetaPrevio}`}
                </>
              ),
            }))}
            onTocar={(id) => nav(`/estadisticas/categoria/${id}`)}
          />
        )}
      </Tarjeta>

      <Tarjeta titulo="Fijo frente a variable">
        <div className="alto-grafico corto">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={mensual} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--borde)" vertical={false} />
              <XAxis dataKey="mes" tickFormatter={abreviaturaMes} tick={EJE} tickLine={false} axisLine={false} />
              <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={eje} width={44} />
              <Tooltip formatter={tip} labelFormatter={(m) => etiquetaMes(String(m))} contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 10 }} />
              <Bar dataKey="gastoFijo" name="Fijo" stackId="g" fill="var(--principal)" />
              <Bar dataKey="gastoVariable" name="Variable" stackId="g" fill="var(--acento)" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="leyenda">
          <span className="l l-fijo">Fijo</span>
          <span className="l l-variable">Variable</span>
        </p>
      </Tarjeta>

      <Tarjeta titulo={`Calendario de ${nombreMes(mesHoy)}`}>
        <p className="secundario">
          {calendario.diasSinGasto} días sin gasto variable · racha actual: {racha} {racha === 1 ? 'día' : 'días'}
        </p>
        <div className="calendario" role="grid" aria-label="Gasto variable por día">
          {calendario.dias.map((d) => (
            <button
              key={d.dia}
              type="button"
              role="gridcell"
              className={`dia-cal n${d.nivel}${d.futuro ? ' futuro' : ''}${diaElegido === d.fecha ? ' elegido' : ''}`}
              aria-label={`Día ${d.dia}: ${fmt(d.gastoVariable)}`}
              onClick={() => setDiaElegido(diaElegido === d.fecha ? null : d.fecha)}
            >
              {d.dia}
            </button>
          ))}
        </div>
        {diaElegido && (
          <div>
            <h3 className="subtitulo">Día {Number(diaElegido.slice(8))}</h3>
            {delDia.length === 0 ? (
              <p className="secundario">Sin movimientos.</p>
            ) : (
              <ul className="lista">
                {delDia.map((m) => (
                  <li key={m.id}>
                    <button className="fila" onClick={() => hoja.abrirEditar(m)}>
                      <span className="fila-texto">{m.nota || catInfo(m.categoriaId ?? '')?.nombre || 'Traspaso'}</span>
                      <span className="cifra">{fmt(m.importe)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Ingresos y gastos por mes">
        <div className="alto-grafico corto">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={mensual} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--borde)" vertical={false} />
              <XAxis dataKey="mes" tickFormatter={abreviaturaMes} tick={EJE} tickLine={false} axisLine={false} />
              <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={eje} width={44} />
              <Tooltip formatter={tip} labelFormatter={(m) => etiquetaMes(String(m))} contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 10 }} />
              <ReferenceLine y={0} stroke="var(--borde)" />
              <Bar dataKey="ingresos" name="Ingresos" fill="var(--principal)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastoNeto" name="Gasto neto" fill="var(--acento)" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="ahorro" name="Ahorro" stroke="var(--texto)" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="leyenda">
          <span className="l l-fijo">Ingresos</span>
          <span className="l l-variable">Gasto neto</span>
          <span className="l l-ahorro">Ahorro</span>
        </p>
      </Tarjeta>

      <Tarjeta titulo="Evolución del patrimonio">
        <div className="alto-grafico corto">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={patrimonio} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--borde)" vertical={false} />
              <XAxis dataKey="mes" tickFormatter={abreviaturaMes} tick={EJE} tickLine={false} axisLine={false} />
              <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={eje} width={52} domain={['auto', 'auto']} />
              <Tooltip formatter={tip} labelFormatter={(m) => `Fin de ${etiquetaMes(String(m))}`} contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 10 }} />
              <Area type="monotone" dataKey="saldo" name="Saldo" stroke="var(--principal)" fill="var(--principal)" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Ingresos por categoría">
        {filasIngresos.length === 0 ? (
          <p className="secundario">Sin ingresos en este periodo.</p>
        ) : (
          <Barras
            filas={filasIngresos.map((f) => ({
              id: f.categoriaId,
              etiqueta: `${catInfo(f.categoriaId)?.icono ?? ''} ${catInfo(f.categoriaId)?.nombre ?? 'Sin categoría'}`,
              valor: f.importe,
              color: catInfo(f.categoriaId)?.color ?? 'var(--principal)',
            }))}
          />
        )}
      </Tarjeta>

      <Tarjeta titulo="Revisiones mensuales">
        {mesesConDatos.length === 0 ? (
          <p className="secundario">Cuando termine un mes con movimientos, podrás repasarlo aquí.</p>
        ) : (
          <ul className="lista">
            {mesesConDatos.map((m) => (
              <li key={m}>
                <Link className="fila" to={`/revision/${m.slice(0, 7)}`}>
                  <span className="fila-texto">{etiquetaMes(m)}</span>
                  <Icono nombre="derecha" className="chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </section>
  )
}
