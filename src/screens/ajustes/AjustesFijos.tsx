import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cabecera } from '../../components/Cabecera'
import { useFmt } from '../../components/Discreto'
import { HojaFijo } from '../../components/HojaFijo'
import { Icono, IconoCategoria } from '../../components/Icono'
import { useFijos } from '../../data/consultas'
import { useCategorias } from '../../data/hooks'
import type { Fijo } from '../../data/types'
import { costeAnual, costeMensual, esPuntual, etiquetaPeriodicidad, proximoMesQueToca } from '../../lib/fijos'
import { diaDeFecha, fechaEnMes, mesActual, nombreMes } from '../../lib/meses'

type Edicion = { modo: 'nuevo' } | { modo: 'editar'; fijo: Fijo } | null

export function AjustesFijos() {
  const fmt = useFmt()
  const fijos = useFijos()
  const categorias = useCategorias().data ?? []
  const [edicion, setEdicion] = useState<Edicion>(null)

  const todos = fijos.data ?? []
  const recurrentes = todos.filter((f) => !esPuntual(f)).sort((a, b) => costeMensual(b) - costeMensual(a))
  const puntuales = todos.filter(esPuntual).sort((a, b) => (a.desde < b.desde ? 1 : -1))
  const gastos = recurrentes.filter((f) => f.activo && f.tipo === 'gasto')
  const totalMes = gastos.reduce((t, f) => t + costeMensual(f), 0)
  const totalAno = gastos.reduce((t, f) => t + costeAnual(f), 0)
  const hoy = mesActual()

  function detalle(f: Fijo) {
    if (esPuntual(f)) {
      const fecha = fechaEnMes(f.desde, f.diaMes)
      return `Una vez · ${diaDeFecha(fecha)} de ${nombreMes(f.desde)}${f.desde < hoy ? ' · Pasado' : ''}`
    }
    const prox = proximoMesQueToca(f, hoy)
    const estado = !f.activo ? 'Pausado' : prox ? `Próximo: ${nombreMes(prox)}` : 'Terminado'
    return `${etiquetaPeriodicidad(f)} · día ${f.diaMes} · ${estado}`
  }

  const fila = (f: Fijo) => {
    const cat = categorias.find((c) => c.id === f.categoriaId)
    return (
      <li key={f.id} className={f.activo ? '' : 'pausado'}>
        <button className="fila" onClick={() => setEdicion({ modo: 'editar', fijo: f })}>
          <IconoCategoria color={cat?.color}>{cat?.icono ?? <Icono nombre={f.tipo === 'traspaso' ? 'traspaso' : 'repetir'} />}</IconoCategoria>
          <span className="fila-texto">
            <span>
              {f.nombre}
              {f.tipo !== 'gasto' && <span className="etiqueta">{f.tipo === 'ingreso' ? 'Ingreso' : 'Traspaso'}</span>}
            </span>
            {f.descripcion && <span className="secundario pequeno descripcion">{f.descripcion}</span>}
            <span className="secundario pequeno">{detalle(f)}</span>
          </span>
          <span className="cifra">{fmt(f.importe)}</span>
        </button>
      </li>
    )
  }

  return (
    <section className="pantalla ancho">
      <Cabecera titulo="Fijos" />
      {fijos.isPending ? (
        <p className="secundario">Cargando…</p>
      ) : (
        <>
          <div className="tiles">
            <div className="tile">
              <span className="secundario pequeno">Fijos al mes</span>
              <span className="cifra">{fmt(totalMes)}</span>
            </div>
            <div className="tile">
              <span className="secundario pequeno">Al año</span>
              <span className="cifra">{fmt(totalAno)}</span>
            </div>
          </div>
          {recurrentes.length > 0 && <ul className="lista">{recurrentes.map(fila)}</ul>}
          {puntuales.length > 0 && (
            <>
              <h2 className="subtitulo">Cargos puntuales</h2>
              <ul className="lista">{puntuales.map(fila)}</ul>
            </>
          )}
          {todos.length === 0 && (
            <p className="vacio">Aún no tienes fijos. Añade el alquiler, la luz, la nómina o un cargo puntual como el IBI.</p>
          )}
          <button className="primario" onClick={() => setEdicion({ modo: 'nuevo' })}>
            Nuevo fijo
          </button>
          <Link to="/fijos" className="enlace">
            Ver los fijos de este mes
            <Icono nombre="derecha" />
          </Link>
        </>
      )}

      {edicion && (
        <HojaFijo fijo={edicion.modo === 'editar' ? edicion.fijo : undefined} onCerrar={() => setEdicion(null)} />
      )}
    </section>
  )
}
