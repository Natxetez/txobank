import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cabecera } from '../../components/Cabecera'
import { useFmt } from '../../components/Discreto'
import { FormFijo } from '../../components/FormFijo'
import { Hoja } from '../../components/Hoja'
import { useAccionesFijos, useFijos } from '../../data/consultas'
import { mensajeError, useCategorias } from '../../data/hooks'
import type { Fijo } from '../../data/types'
import { costeAnual, costeMensual, etiquetaPeriodicidad, proximoMesQueToca } from '../../lib/fijos'
import { mesActual, nombreMes } from '../../lib/meses'

type Edicion = { modo: 'nuevo' } | { modo: 'editar'; fijo: Fijo } | null

export function AjustesFijos() {
  const fmt = useFmt()
  const fijos = useFijos()
  const categorias = useCategorias().data ?? []
  const acciones = useAccionesFijos()
  const [edicion, setEdicion] = useState<Edicion>(null)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null)

  const lista = [...(fijos.data ?? [])].sort((a, b) => costeMensual(b) - costeMensual(a))
  const gastos = lista.filter((f) => f.activo && f.tipo === 'gasto')
  const totalMes = gastos.reduce((t, f) => t + costeMensual(f), 0)
  const totalAno = gastos.reduce((t, f) => t + costeAnual(f), 0)
  const hoy = mesActual()

  function cerrar() {
    setEdicion(null)
    setConfirmarBorrado(false)
    setErrorBorrado(null)
  }

  async function borrar(fijo: Fijo) {
    try {
      await acciones.borrar(fijo.id)
      cerrar()
    } catch (err) {
      setErrorBorrado(mensajeError(err))
    }
  }

  function detalle(f: Fijo) {
    const prox = proximoMesQueToca(f, hoy)
    const estado = !f.activo ? 'Pausado' : prox ? `Próximo: ${nombreMes(prox)}` : 'Terminado'
    return `${etiquetaPeriodicidad(f.cadaMeses)} · día ${f.diaMes} · ${estado}`
  }

  return (
    <section className="pantalla ancho">
      <Cabecera titulo="Fijos" />
      {fijos.isPending ? (
        <p className="secundario">Cargando…</p>
      ) : (
        <>
          <p className="resumen-fijos">
            Gastos fijos: <strong className="cifra">{fmt(totalMes)}</strong> al mes,{' '}
            <strong className="cifra">{fmt(totalAno)}</strong> al año
          </p>
          <ul className="lista">
            {lista.map((f) => (
              <li key={f.id} className={f.activo ? '' : 'pausado'}>
                <button className="fila" onClick={() => setEdicion({ modo: 'editar', fijo: f })}>
                  <span className="fila-texto">
                    <span>
                      {categorias.find((c) => c.id === f.categoriaId)?.icono ?? ''} {f.nombre}
                      {f.tipo !== 'gasto' && <span className="etiqueta">{f.tipo === 'ingreso' ? 'Ingreso' : 'Traspaso'}</span>}
                    </span>
                    <span className="secundario pequeno">{detalle(f)}</span>
                  </span>
                  <span className="cifra">{fmt(f.importe)}</span>
                </button>
              </li>
            ))}
          </ul>
          {lista.length === 0 && <p className="vacio">Aún no tienes fijos. Añade el alquiler, la luz, la nómina…</p>}
          <button className="primario" onClick={() => setEdicion({ modo: 'nuevo' })}>
            Nuevo fijo
          </button>
          <Link to="/fijos" className="enlace">
            Ver los fijos de este mes
          </Link>
        </>
      )}

      {edicion && (
        <Hoja titulo={edicion.modo === 'nuevo' ? 'Nuevo fijo' : 'Editar fijo'} onCerrar={cerrar}>
          <FormFijo
            inicial={edicion.modo === 'editar' ? edicion.fijo : undefined}
            etiquetaGuardar={edicion.modo === 'nuevo' ? 'Crear fijo' : 'Guardar cambios'}
            onGuardar={async (datos) => {
              if (edicion.modo === 'nuevo') await acciones.crear(datos)
              else await acciones.actualizar(edicion.fijo.id, datos)
              cerrar()
            }}
          />
          {edicion.modo === 'editar' && (
            <div className="zona-borrar">
              <p className="secundario pequeno">
                Editar un fijo no cambia los pagos pasados. Al eliminarlo, los movimientos ya pagados se quedan sin fijo.
              </p>
              {errorBorrado && (
                <p className="error" role="alert">
                  {errorBorrado}
                </p>
              )}
              {confirmarBorrado ? (
                <div className="confirmar">
                  <span>¿Eliminar «{edicion.fijo.nombre}»?</span>
                  <button type="button" className="secundario-btn" onClick={() => setConfirmarBorrado(false)}>
                    Cancelar
                  </button>
                  <button type="button" className="peligro" onClick={() => void borrar(edicion.fijo)}>
                    Eliminar
                  </button>
                </div>
              ) : (
                <button type="button" className="secundario-btn borrar" onClick={() => setConfirmarBorrado(true)}>
                  Eliminar fijo
                </button>
              )}
            </div>
          )}
        </Hoja>
      )}
    </section>
  )
}
