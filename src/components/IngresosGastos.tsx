import { Link } from 'react-router-dom'
import type { Control } from '../lib/control'
import { ingresosFrenteAGastos } from '../lib/control'
import { useFmt } from './Discreto'

interface Props {
  control: Control
  /** Sin presupuesto, estas barras ocupan el sitio de "Te quedan" e invitan a crear uno. */
  sinPresupuesto?: boolean
  /** Media de gasto de los 3 meses anteriores, como referencia cuando no hay presupuesto. */
  mediaTres?: number | null
}

/** Tramo de una barra, con su ancho respecto a la escala común de las dos; nada si no hay importe. */
const tramo = (clase: string, valor: number, escala: number) =>
  valor > 0 && escala > 0 ? <span className={`ig-tramo ${clase}`} style={{ width: `${(valor / escala) * 100}%` }} /> : null

/**
 * Ingresos frente a gastos del mes: dos barras en la misma escala. Lo cobrado y lo pagado van en color
 * sólido; lo que falta por cobrar o pagar de los fijos, rayado. Debajo, lo que se ahorra.
 */
export function IngresosGastos({ control, sinPresupuesto = false, mediaTres = null }: Props) {
  const fmt = useFmt()
  const r = ingresosFrenteAGastos(control)
  const gastos = r.gastoFijo + r.gastoVariable
  const vacio = r.escala === 0

  return (
    <section className={sinPresupuesto ? 'ingresos-gastos destacado' : 'ingresos-gastos'} aria-label="Ingresos y gastos del mes">
      <div className="ig-cab">
        <h2>Ingresos y gastos</h2>
        {!vacio && (
          <p className={r.ahorro >= 0 ? 'ig-ahorro positivo' : 'ig-ahorro negativo-saldo'}>
            {r.ahorro >= 0 ? `Ahorras ${fmt(r.ahorro)}` : `Gastas ${fmt(-r.ahorro)} más`}
          </p>
        )}
      </div>

      {vacio ? (
        <p className="secundario">Aún no hay ingresos ni gastos este mes.</p>
      ) : (
        <>
          <div className="ig-fila">
            <div className="ig-etiqueta">
              <span>Ingresos</span>
              <span className="cifra">{fmt(r.ingresos)}</span>
            </div>
            <div className="ig-barra" role="img" aria-label={`Ingresos ${fmt(r.ingresos)}, por cobrar ${fmt(r.ingresosPendientes)}`}>
              {tramo('ingreso', r.ingresos, r.escala)}
              {tramo('ingreso pendiente', r.ingresosPendientes, r.escala)}
            </div>
            {r.ingresosPendientes > 0 && <p className="ig-nota">+{fmt(r.ingresosPendientes)} de fijos por cobrar</p>}
          </div>

          <div className="ig-fila">
            <div className="ig-etiqueta">
              <span>Gastos</span>
              <span className="cifra">{fmt(gastos)}</span>
            </div>
            <div
              className="ig-barra"
              role="img"
              aria-label={`Gastos ${fmt(gastos)}: fijos ${fmt(r.gastoFijo)}, variables ${fmt(r.gastoVariable)}, por pagar ${fmt(r.gastosPendientes)}`}
            >
              {tramo('fijo', r.gastoFijo, r.escala)}
              {tramo('variable', r.gastoVariable, r.escala)}
              {tramo('fijo pendiente', r.gastosPendientes, r.escala)}
            </div>
            <div className="ig-leyenda">
              {r.gastoFijo > 0 && (
                <span>
                  <i className="ig-punto fijo" /> Fijos {fmt(r.gastoFijo)}
                </span>
              )}
              {r.gastoVariable > 0 && (
                <span>
                  <i className="ig-punto variable" /> Variables {fmt(r.gastoVariable)}
                </span>
              )}
              {r.gastosPendientes > 0 && (
                <span>
                  <i className="ig-punto fijo pendiente" /> Por pagar {fmt(r.gastosPendientes)}
                </span>
              )}
            </div>
          </div>

          {(r.ingresosPendientes > 0 || r.gastosPendientes > 0) && (
            <p className="ig-nota">
              Con lo que falta de los fijos, {r.ahorroPrevisto >= 0 ? `ahorrarás ${fmt(r.ahorroPrevisto)}` : `gastarás ${fmt(-r.ahorroPrevisto)} más de lo que ingresas`}.
            </p>
          )}
          {r.objetivoAhorro > 0 && (
            <p className={r.ahorroPrevisto >= r.objetivoAhorro ? 'ig-nota ok' : 'ig-nota'}>
              Tu objetivo de ahorro es {fmt(r.objetivoAhorro)}
              {r.ahorroPrevisto >= r.objetivoAhorro ? ': vas camino de cumplirlo.' : '.'}
            </p>
          )}
        </>
      )}

      {sinPresupuesto && (
        <p className="ig-nota">
          {mediaTres !== null ? `Tu gasto medio de los 3 meses anteriores es ${fmt(Math.round(mediaTres))}. ` : ''}
          <Link to="/presupuestos" className="enlace-texto">
            Ponle un presupuesto al mes
          </Link>{' '}
          para ver cuánto te queda.
        </p>
      )}
    </section>
  )
}
