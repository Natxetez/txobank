import { SelectorMes } from '../components/SelectorMes'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BotonDiscreto, useFmt } from '../components/Discreto'
import { Icono, IconoCategoria } from '../components/Icono'
import { ListaFijos } from '../components/ListaFijos'
import { ProximosCargos } from '../components/ProximosCargos'
import { TarjetaRecomendacion } from '../components/TarjetaRecomendacion'
import { useControlMes, useTodosMovimientos } from '../data/consultas'
import { useCategorias } from '../data/hooks'
import { BloquePatrimonio } from '../components/BloquePatrimonio'
import { revisionVista, useRecomendaciones } from '../data/recomendaciones'
import type { Movimiento } from '../data/types'
import { progresoPresupuestos } from '../lib/control'
import type { Control } from '../lib/control'
import { resumenFijos } from '../lib/fijos'
import { hoyISO, mesActual, mesDeFecha, nombreMes, sumarMeses } from '../lib/meses'
import { mediaMensual } from '../lib/presupuestos'
import { mesDeCuenta } from '../lib/control'
import { useHojaMovimiento } from '../components/ContextoMovimiento'
import { SelectorEconomia } from '../components/SelectorEconomia'

const TEXTO_ESTADO = { bien: 'Vas bien', ajustado: 'Vas ajustado', pasado: 'Te pasas' } as const

function Protagonista({ control, mediaTres }: { control: Control; mediaTres: number | null }) {
  const fmt = useFmt()
  const { limite, disponible, disponibleSinPendientes, estado, disponiblePorDia, diasQueQuedan, resumen, fijosGastoPendiente } =
    control

  if (!limite || disponible === null || disponibleSinPendientes === null || estado === null) {
    return (
      <div className="protagonista neutro">
        <p className="etiqueta-grande">Gasto de este mes</p>
        <p className="cifra-enorme">{fmt(resumen.gastoNeto)}</p>
        <p className="secundario">
          {mediaTres !== null
            ? `Tu media de los 3 meses anteriores es ${fmt(Math.round(mediaTres))}.`
            : 'Sin presupuesto ni ingresos, no hay límite. Ponle un presupuesto total al mes en Ajustes.'}
        </p>
      </div>
    )
  }

  // La cifra grande no cuenta los fijos pendientes (no cuentan hasta que se cobran); el estado y el
  // "al día" sí, para no llevarse sorpresas.
  const pasado = disponibleSinPendientes < 0
  const fraccionFijo = limite.valor > 0 ? Math.min(1, resumen.gastoFijo / limite.valor) : 0
  const fraccionVariable = limite.valor > 0 ? Math.min(1 - fraccionFijo, Math.max(0, resumen.gastoVariable) / limite.valor) : 0

  return (
    <div className={`protagonista ${estado}`}>
      <p className="estado-texto">{TEXTO_ESTADO[estado]}</p>
      <p className="etiqueta-grande">{pasado ? 'Te has pasado' : 'Te quedan'}</p>
      <p className="cifra-enorme">{fmt(Math.abs(disponibleSinPendientes))}</p>
      {disponible >= 0 && disponiblePorDia !== null && diasQueQuedan > 0 && (
        <p className="por-dia">
          {fmt(Math.round(disponiblePorDia))} al día durante {diasQueQuedan} {diasQueQuedan === 1 ? 'día' : 'días'}
        </p>
      )}
      {fijosGastoPendiente > 0 && (
        <p className="tras-pendientes">
          {disponible >= 0
            ? `Tras los cargos pendientes: ${fmt(disponible)}`
            : `Con los cargos pendientes te pasarás ${fmt(-disponible)}`}
        </p>
      )}
      <div className="barra-gasto" role="img" aria-label={`Gastado ${fmt(resumen.gastoNeto)} de ${fmt(limite.valor)}`}>
        <span className="tramo fijo" style={{ width: `${fraccionFijo * 100}%` }} />
        <span className="tramo variable" style={{ width: `${fraccionVariable * 100}%` }} />
      </div>
      <div className="leyenda-barra">
        <span>
          <i className="punto fijo" /> Fijo {fmt(resumen.gastoFijo)}
        </span>
        <span>
          <i className="punto variable" /> Variable {fmt(resumen.gastoVariable)}
        </span>
        <span>Límite {fmt(limite.valor)}</span>
      </div>
    </div>
  )
}

export function Inicio() {
  const fmt = useFmt()
  const hoja = useHojaMovimiento()
  const [mes, setMes] = useState(mesActual())
  const { datos, cargando, error } = useControlMes(mes)
  const todos = useTodosMovimientos()
  const categorias = useCategorias().data ?? []
  const reco = useRecomendaciones()

  const hoy = hoyISO()
  const esMesActual = mes === mesActual()
  const mesAnterior = sumarMeses(mesActual(), -1)
  const mediaTres = useMemo(() => (todos.data ? (mediaMensual(todos.data, mes)?.total ?? null) : null), [todos.data, mes])
  const revisionPendiente =
    esMesActual && !revisionVista(mesAnterior) && (todos.data ?? []).some((m) => mesDeCuenta(m) === mesAnterior)

  const ultimos: Movimiento[] = useMemo(
    () => (todos.data ?? []).filter((m) => m.fecha <= hoy).slice(0, 5),
    [todos.data, hoy],
  )
  const hayMovimientosEnElMes = (datos?.movimientos ?? []).some((m) => mesDeFecha(m.fecha) === mes)

  const progreso = datos ? progresoPresupuestos(datos.control, datos.presupuestos, categorias) : []
  const fijos = datos?.control.fijosMes ?? []
  const resumenF = resumenFijos(fijos)
  const cat = (id: string | null) => categorias.find((c) => c.id === id)

  return (
    <section className="pantalla ancho inicio">
      <SelectorEconomia />
      <SelectorMes mes={mes} onCambiar={setMes}>
        <BotonDiscreto />
      </SelectorMes>

      {cargando && <p className="secundario">Cargando…</p>}
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}

      {datos && (
        <>
          <Protagonista control={datos.control} mediaTres={mediaTres} />

          {esMesActual && <ProximosCargos />}

          {!hayMovimientosEnElMes && (
            <p className="vacio">
              Aún no hay gastos en {nombreMes(mes)}.{' '}
              <button className="enlace-boton" onClick={() => hoja.abrirNuevo()}>
                Añade el primero con +
              </button>
            </p>
          )}

          {revisionPendiente && (
            <Link to={`/revision/${mesAnterior.slice(0, 7)}`} className="tarjeta-revision">
              <IconoCategoria>
                <Icono nombre="resumen" />
              </IconoCategoria>
              <span className="fila-texto">
                <strong>Tu resumen de {nombreMes(mesAnterior)}</strong>
                <span className="secundario">Cómo fue el mes, qué ajustar y qué revisar</span>
              </span>
              <Icono nombre="derecha" className="chevron" />
            </Link>
          )}

          <div className="bloque">
            <div className="bloque-cab">
              <h2>Fijos del mes</h2>
              <Link to="/fijos" className="enlace">
                Ver todos
              </Link>
            </div>
            {resumenF.total > 0 && (
              <p className="secundario">
                {resumenF.pagados} de {resumenF.total} pagados: {fmt(resumenF.importePagado)} de {fmt(resumenF.importeTotal)}
              </p>
            )}
            <ListaFijos items={fijos} mes={mes} />
          </div>

          <div className="bloque">
            <div className="bloque-cab">
              <h2>Presupuestos</h2>
              <Link to="/presupuestos" className="enlace">
                {progreso.length > 0 ? 'Ajustar' : 'Crear'}
              </Link>
            </div>
            {progreso.length === 0 ? (
              <p className="secundario">Sin presupuestos por categoría este mes.</p>
            ) : (
              <Link to="/presupuestos" className="barras-cat">
                {progreso.map((p) => (
                  <div key={p.categoria.id} className={`barra-cat ${p.nivel}`}>
                    <div className="barra-cat-cab">
                      <span>
                        {p.categoria.icono ? `${p.categoria.icono} ` : ''}
                        {p.categoria.nombre}
                      </span>
                      <span className="cifra secundario">
                        {fmt(p.gastado)} de {fmt(p.presupuesto)}
                      </span>
                    </div>
                    <div className="barra-fondo">
                      <span style={{ width: `${Math.min(100, Math.max(0, p.fraccion * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </Link>
            )}
          </div>
        </>
      )}

      {reco.visibles[0] && (
        <div className="bloque">
          <div className="bloque-cab">
            <h2>Para ti</h2>
            <Link to="/recomendaciones" className="enlace">
              Ver todas{reco.total > 1 ? ` (${reco.total})` : ''}
            </Link>
          </div>
          <TarjetaRecomendacion recomendacion={reco.visibles[0]} onDescartar={() => reco.descartar(reco.visibles[0].id)} />
        </div>
      )}

      <BloquePatrimonio />

      <div className="bloque">
        <div className="bloque-cab">
          <h2>Últimos movimientos</h2>
          <Link to="/movimientos" className="enlace">
            Ver todos
          </Link>
        </div>
        {ultimos.length === 0 ? (
          <p className="secundario">Todavía no hay movimientos.</p>
        ) : (
          <ul className="lista">
            {ultimos.map((m) => {
              const c = cat(m.categoriaId)
              const positivo = m.tipo === 'ingreso' || m.tipo === 'devolucion'
              return (
                <li key={m.id}>
                  <button className="fila" onClick={() => hoja.abrirEditar(m)}>
                    <IconoCategoria color={c?.color}>
                      {c?.icono ?? <Icono nombre={m.tipo === 'traspaso' ? 'traspaso' : 'etiqueta'} />}
                    </IconoCategoria>
                    <span className="fila-texto">
                      <span>{m.nota || c?.nombre || 'Traspaso'}</span>
                      {m.descripcion && <span className="secundario pequeno descripcion">{m.descripcion}</span>}
                      <span className="secundario pequeno">{m.fecha.slice(8)}/{m.fecha.slice(5, 7)}</span>
                    </span>
                    <span className={positivo ? 'cifra positivo' : 'cifra'}>
                      {m.tipo === 'gasto' ? '−' : positivo ? '+' : ''}
                      {fmt(m.importe)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
