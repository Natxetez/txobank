import { Icono } from '../components/Icono'
import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useFmt } from '../components/Discreto'
import { useFijos, useOmitidos, usePresupuestos, useTodosMovimientos } from '../data/consultas'
import { useAjustes, useCategorias } from '../data/hooks'
import { marcarRevisionVista } from '../data/recomendaciones'
import { calcularRevision } from '../lib/revision'
import { etiquetaMes, formatoDia, hoyISO, nombreMes, sumarMeses } from '../lib/meses'

const pct = (f: number) => `${Math.round(Math.abs(f) * 100)} %`

export function Revision() {
  const { mes: parametro = '' } = useParams()
  const mes = `${parametro}-01`
  const fmt = useFmt()
  const todos = useTodosMovimientos()
  const categorias = useCategorias()
  const presupuestos = usePresupuestos()
  const ajustes = useAjustes()
  const fijos = useFijos()
  const omitidos = useOmitidos()

  const valido = /^\d{4}-\d{2}-01$/.test(mes)
  useEffect(() => {
    if (valido) marcarRevisionVista(mes)
  }, [valido, mes])

  const r = useMemo(() => {
    if (!valido || !todos.data || !categorias.data || !presupuestos.data || !ajustes.data || !fijos.data || !omitidos.data) return null
    return calcularRevision({
      mes,
      hoy: hoyISO(),
      movimientos: todos.data,
      categorias: categorias.data,
      presupuestos: presupuestos.data,
      ajustes: ajustes.data,
      fijos: fijos.data,
      omitidos: omitidos.data,
    })
  }, [valido, mes, todos.data, categorias.data, presupuestos.data, ajustes.data, fijos.data, omitidos.data])

  if (!valido) return <p className="error">Mes no válido.</p>
  if (!r) return <p className="secundario">Cargando…</p>

  const nombreCat = (id: string | null) => categorias.data?.find((c) => c.id === id)
  const siguiente = sumarMeses(mes, 1)

  return (
    <section className="pantalla ancho">
      <Link to="/estadisticas" className="volver">
        <Icono nombre="izquierda" />
        Estadísticas
      </Link>
      <h1>Tu resumen de {nombreMes(mes)}</h1>

      <div className="bloque">
        <h2>Gasto del mes</h2>
        <p className="cifra-grande">{fmt(r.gastoNeto)}</p>
        <p className="secundario">
          Fijo {fmt(r.gastoFijo)} · Variable {fmt(r.gastoVariable)}
        </p>
        {r.limite !== null && (
          <p className={r.gastoNeto > r.limite ? 'aviso-texto' : 'ok'}>
            {r.gastoNeto > r.limite
              ? `Te pasaste ${fmt(r.gastoNeto - r.limite)} de tu límite de ${fmt(r.limite)}.`
              : `Dentro de tu límite de ${fmt(r.limite)}: te sobraron ${fmt(r.limite - r.gastoNeto)}.`}
          </p>
        )}
      </div>

      <div className="bloque">
        <h2>Ahorro</h2>
        <p className="cifra-grande">{fmt(r.ahorro)}</p>
        {r.objetivoAhorro > 0 ? (
          <p className={r.ahorro >= r.objetivoAhorro ? 'ok' : 'aviso-texto'}>
            {r.ahorro >= r.objetivoAhorro
              ? `Objetivo de ${fmt(r.objetivoAhorro)} cumplido.`
              : `Te faltaron ${fmt(r.objetivoAhorro - r.ahorro)} para tu objetivo de ${fmt(r.objetivoAhorro)}.`}
          </p>
        ) : (
          <p className="secundario">Ingresos menos gasto neto. Puedes fijar un objetivo en Ajustes.</p>
        )}
      </div>

      <div className="bloque">
        <h2>Categorías que se pasaron</h2>
        {r.categoriasPasadas.length === 0 ? (
          <p className="secundario">Ninguna se pasó de su presupuesto.</p>
        ) : (
          <ul className="lista">
            {r.categoriasPasadas.map((p) => (
              <li key={p.categoria.id} className="fila">
                <span className="fila-texto">
                  {p.categoria.icono ? `${p.categoria.icono} ` : ''}
                  {p.categoria.nombre}
                </span>
                <span className="cifra">
                  {fmt(p.gastado)} de {fmt(p.presupuesto)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bloque">
        <h2>Fijos sin marcar</h2>
        {r.fijosSinMarcar.length === 0 ? (
          <p className="secundario">Todos los fijos están pagados u omitidos.</p>
        ) : (
          <ul className="lista">
            {r.fijosSinMarcar.map((i) => (
              <li key={i.fijo.id} className="fila">
                <span className="fila-texto">{i.fijo.nombre}</span>
                <span className="cifra secundario">{fmt(i.fijo.importe)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bloque">
        <h2>Los 3 mayores gastos</h2>
        {r.mayoresGastos.length === 0 ? (
          <p className="secundario">Sin gastos este mes.</p>
        ) : (
          <ul className="lista">
            {r.mayoresGastos.map((m) => (
              <li key={m.id} className="fila">
                <span className="fila-texto">
                  <span>{m.nota || nombreCat(m.categoriaId)?.nombre}</span>
                  <span className="secundario pequeno">{formatoDia(m.fecha)}</span>
                </span>
                <span className="cifra">{fmt(m.importe)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bloque">
        <h2>Frente a tu media</h2>
        {r.mediaTresMeses === null || r.variacionSobreMedia === null ? (
          <p className="secundario">Aún no hay meses anteriores para comparar.</p>
        ) : (
          <p>
            Tu media de los 3 meses anteriores es {fmt(Math.round(r.mediaTresMeses))}: este mes gastaste un{' '}
            {pct(r.variacionSobreMedia)} {r.variacionSobreMedia > 0 ? 'más' : 'menos'}.
          </p>
        )}
        <p className="secundario">Días sin gasto variable: {r.diasSinGasto}.</p>
      </div>

      <div className="bloque">
        <h2>Y ahora, {etiquetaMes(siguiente)}</h2>
        <Link className="primario boton-enlace" to="/presupuestos?sugerir=1">
          Ajustar los presupuestos
        </Link>
        <Link className="secundario-btn boton-enlace" to="/ajustes/fijos">
          Revisar mis fijos
        </Link>
      </div>
    </section>
  )
}
