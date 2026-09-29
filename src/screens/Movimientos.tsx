import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAviso } from '../components/Avisos'
import { BotonDiscreto, useFmt } from '../components/Discreto'
import { useHojaMovimiento } from '../components/ContextoMovimiento'
import { FilaDeslizable } from '../components/FilaDeslizable'
import {
  mensajeError,
  useAccionesMovimiento,
  useCategorias,
  useCuentas,
  useMovimientos,
  useSaldos,
} from '../data/hooks'
import type { Movimiento, TipoMovimiento } from '../data/types'
import { etiquetaMes, finDeMes, formatoDia, mesActual, nombreMes, sumarMeses } from '../lib/meses'
import { agruparPorDia, filtrarMovimientos } from '../lib/movimientos'

const SIGNO: Record<TipoMovimiento, string> = { gasto: '−', ingreso: '+', devolucion: '+', traspaso: '' }
const NOMBRE_TIPO: Record<TipoMovimiento, string> = {
  gasto: 'Gastos',
  ingreso: 'Ingresos',
  devolucion: 'Devoluciones',
  traspaso: 'Traspasos',
}

export function Movimientos() {
  const [params] = useSearchParams()
  const hoja = useHojaMovimiento()
  const aviso = useAviso()
  const fmt = useFmt()
  const acciones = useAccionesMovimiento()

  const [mes, setMes] = useState(params.get('mes') ?? mesActual())
  const [texto, setTexto] = useState('')
  const [cuentaId, setCuentaId] = useState(params.get('cuenta') ?? '')
  const [categoriaId, setCategoriaId] = useState(params.get('categoria') ?? '')
  const [fijo, setFijo] = useState<'' | 'fijo' | 'variable'>('')
  const [tipo, setTipo] = useState<TipoMovimiento | ''>('')

  const movs = useMovimientos(mes, finDeMes(mes))
  const cuentas = useCuentas().data ?? []
  const categorias = useCategorias().data ?? []
  const saldos = useSaldos().data

  const cuentaPorId = useMemo(() => new Map(cuentas.map((c) => [c.id, c])), [cuentas])
  const categoriaPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])

  const filtrados = useMemo(
    () =>
      filtrarMovimientos(movs.data ?? [], {
        texto,
        cuentaId: cuentaId || undefined,
        categoriaId: categoriaId || undefined,
        tipo: tipo || undefined,
        fijo: fijo || undefined,
      }),
    [movs.data, texto, cuentaId, categoriaId, tipo, fijo],
  )
  const grupos = useMemo(() => agruparPorDia(filtrados), [filtrados])
  const numFiltros = [cuentaId, categoriaId, tipo, fijo].filter(Boolean).length
  const hayFiltros = numFiltros > 0 || texto.trim() !== ''
  const saldoCuenta = cuentaId ? saldos?.find((s) => s.cuentaId === cuentaId)?.saldo : undefined

  async function eliminar(m: Movimiento) {
    try {
      await acciones.borrar(m.id)
      const { id: _id, ...copia } = m
      aviso.mostrar('Movimiento eliminado', { etiqueta: 'Deshacer', alHacer: () => acciones.crear(copia) })
    } catch (err) {
      aviso.mostrar(mensajeError(err))
    }
  }

  function fila(m: Movimiento) {
    const cat = m.categoriaId ? categoriaPorId.get(m.categoriaId) : undefined
    const origen = cuentaPorId.get(m.cuentaId)?.nombre ?? '—'
    const destino = m.cuentaDestinoId ? (cuentaPorId.get(m.cuentaDestinoId)?.nombre ?? '—') : ''
    const titulo = m.nota || (m.tipo === 'traspaso' ? 'Traspaso' : (cat?.nombre ?? 'Sin categoría'))
    const detalle =
      m.tipo === 'traspaso'
        ? `${origen} → ${destino}`
        : [m.nota ? cat?.nombre : null, origen, m.tipo === 'devolucion' ? 'Devolución' : null]
            .filter(Boolean)
            .join(' · ')
    const imputado = m.mesImputado ? `Cuenta para ${nombreMes(m.mesImputado)}` : null
    const positivo = m.tipo === 'ingreso' || m.tipo === 'devolucion'

    return (
      <li key={m.id}>
        <FilaDeslizable onTocar={() => hoja.abrirEditar(m)} onEliminar={() => void eliminar(m)} etiquetaEliminar="Eliminar">
          <span className="icono-cat" style={{ background: cat?.color ?? 'var(--secundario)' }} aria-hidden="true">
            {cat?.icono ?? (m.tipo === 'traspaso' ? '⇄' : '•')}
          </span>
          <span className="fila-texto">
            <span>
              {titulo}
              {m.fijoId && <span className="etiqueta">Fijo</span>}
            </span>
            <span className="secundario pequeno">{[detalle, imputado].filter(Boolean).join(' · ')}</span>
          </span>
          <span className={positivo ? 'cifra positivo' : 'cifra'}>
            {SIGNO[m.tipo]}
            {fmt(m.importe)}
          </span>
        </FilaDeslizable>
      </li>
    )
  }

  return (
    <section className="pantalla ancho">
      <div className="selector-mes">
        <button aria-label="Mes anterior" onClick={() => setMes(sumarMeses(mes, -1))}>
          ‹
        </button>
        <h1>{etiquetaMes(mes)}</h1>
        <button aria-label="Mes siguiente" onClick={() => setMes(sumarMeses(mes, 1))}>
          ›
        </button>
        <BotonDiscreto />
      </div>

      <input
        type="search"
        placeholder="Buscar en los conceptos"
        aria-label="Buscar en los conceptos"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <details className="filtros" open={numFiltros > 0 || undefined}>
        <summary>Filtros{numFiltros > 0 ? ` (${numFiltros})` : ''}</summary>
        <div className="filtros-campos">
          <select aria-label="Cuenta" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            <option value="">Todas las cuentas</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select aria-label="Categoría" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icono ? `${c.icono} ` : ''}
                {c.nombre} ({c.tipo})
              </option>
            ))}
          </select>
          <select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento | '')}>
            <option value="">Todos los tipos</option>
            {(Object.keys(NOMBRE_TIPO) as TipoMovimiento[]).map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TIPO[t]}
              </option>
            ))}
          </select>
          <select aria-label="Fijos o variables" value={fijo} onChange={(e) => setFijo(e.target.value as '' | 'fijo' | 'variable')}>
            <option value="">Fijos y variables</option>
            <option value="fijo">Solo fijos</option>
            <option value="variable">Solo variables</option>
          </select>
        </div>
      </details>

      {saldoCuenta !== undefined && (
        <p className="secundario">
          Saldo de {cuentaPorId.get(cuentaId)?.nombre}: <span className="cifra">{fmt(saldoCuenta)}</span>
        </p>
      )}

      {movs.isPending ? (
        <p className="secundario">Cargando…</p>
      ) : movs.isError ? (
        <p className="error" role="alert">
          {mensajeError(movs.error)}
        </p>
      ) : grupos.length === 0 ? (
        <p className="vacio">
          {hayFiltros
            ? 'Ningún movimiento coincide con los filtros.'
            : `Aún no hay movimientos en ${nombreMes(mes)}. Añade el primero con +`}
        </p>
      ) : (
        grupos.map((g) => (
          <div key={g.fecha} className="dia">
            <div className="dia-cab">
              <h2>{formatoDia(g.fecha)}</h2>
              {g.gastoNeto !== 0 && <span className="cifra secundario">{fmt(g.gastoNeto)}</span>}
            </div>
            <ul className="lista">{g.movimientos.map(fila)}</ul>
          </div>
        ))
      )}
    </section>
  )
}
