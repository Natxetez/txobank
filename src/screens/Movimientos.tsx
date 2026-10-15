import { SelectorMes } from '../components/SelectorMes'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAviso } from '../components/Avisos'
import { BotonDiscreto, useFmt } from '../components/Discreto'
import { useHojaMovimiento } from '../components/ContextoMovimiento'
import { FilaDeslizable } from '../components/FilaDeslizable'
import { Icono, IconoCategoria } from '../components/Icono'
import {
  mensajeError,
  useAccionesMovimiento,
  useCategorias,
  useCuentas,
  useMovimientos,
  useSaldos,
} from '../data/hooks'
import { useGrupos } from '../data/consultas'
import type { Movimiento, TipoMovimiento } from '../data/types'
import { etiquetaEntrada, resumenGrupos, separarPorGrupo, textoEntradas } from '../lib/grupos'
import type { ResumenGrupo } from '../lib/grupos'
import { finDeMes, formatoDia, mesActual, nombreMes } from '../lib/meses'
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
  // Las entradas de grupos van en su sección y no en la lista diaria (ni en el total de cada día).
  const gruposQ = useGrupos()
  const { sueltos, resumen } = useMemo(() => {
    const todos = gruposQ.data ?? []
    return {
      sueltos: separarPorGrupo(filtrados, todos, mes).sueltos,
      resumen: resumenGrupos(filtrados, todos, mes),
    }
  }, [filtrados, gruposQ.data, mes])
  const grupos = useMemo(() => agruparPorDia(sueltos), [sueltos])
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set())
  const alternarGrupo = (id: string) =>
    setAbiertos((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
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
          <IconoCategoria color={cat?.color}>
            {cat?.icono ?? <Icono nombre={m.tipo === 'traspaso' ? 'traspaso' : 'etiqueta'} />}
          </IconoCategoria>
          <span className="fila-texto">
            <span>
              {titulo}
              {m.fijoId && <span className="etiqueta">Fijo</span>}
            </span>
            {m.descripcion && <span className="secundario pequeno descripcion">{m.descripcion}</span>}
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

  function entrada(m: Movimiento) {
    const detalle = [m.descripcion, cuentaPorId.get(m.cuentaId)?.nombre].filter(Boolean).join(' · ')
    return (
      <li key={m.id}>
        <FilaDeslizable onTocar={() => hoja.abrirEditar(m)} onEliminar={() => void eliminar(m)} etiquetaEliminar="Eliminar">
          <span className="fila-texto">
            <span>{etiquetaEntrada(m)}</span>
            {detalle && <span className="secundario pequeno descripcion">{detalle}</span>}
          </span>
          <span className="cifra">−{fmt(m.importe)}</span>
        </FilaDeslizable>
      </li>
    )
  }

  function filaGrupo(r: ResumenGrupo) {
    const cat = categoriaPorId.get(r.grupo.categoriaId)
    const abierto = abiertos.has(r.grupo.id)
    return (
      <li key={r.grupo.id} className={abierto ? 'grupo-mov abierto' : 'grupo-mov'}>
        <button className="fila" aria-expanded={abierto} onClick={() => alternarGrupo(r.grupo.id)}>
          <IconoCategoria color={cat?.color}>{cat?.icono ?? <Icono nombre="etiqueta" />}</IconoCategoria>
          <span className="fila-texto">
            <span>{r.grupo.nombre}</span>
            <span className="secundario pequeno">
              {[textoEntradas(r.numEntradas), cat?.nombre].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className="cifra">{fmt(r.total)}</span>
          <Icono nombre={abierto ? 'arriba' : 'abajo'} className="chevron" />
        </button>
        {abierto && <ul className="grupo-entradas">{r.entradas.map(entrada)}</ul>}
      </li>
    )
  }

  return (
    <section className="pantalla ancho">
      <SelectorMes mes={mes} onCambiar={setMes}>
        <BotonDiscreto />
      </SelectorMes>

      <input
        type="search"
        placeholder="Buscar en conceptos y descripciones"
        aria-label="Buscar en conceptos y descripciones"
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

      {movs.isPending || gruposQ.isPending ? (
        <p className="secundario">Cargando…</p>
      ) : movs.isError ? (
        <p className="error" role="alert">
          {mensajeError(movs.error)}
        </p>
      ) : grupos.length === 0 && resumen.length === 0 ? (
        <p className="vacio">
          {hayFiltros
            ? 'Ningún movimiento coincide con los filtros.'
            : `Aún no hay movimientos en ${nombreMes(mes)}. Añade el primero con +`}
        </p>
      ) : (
        <>
          {resumen.length > 0 && (
            <div className="dia grupos-mes">
              <div className="dia-cab">
                <h2>Grupos</h2>
                <span className="cifra secundario">{fmt(resumen.reduce((t, r) => t + r.total, 0))}</span>
              </div>
              <ul className="lista">{resumen.map(filaGrupo)}</ul>
            </div>
          )}
          {grupos.map((g) => (
            <div key={g.fecha} className="dia">
              <div className="dia-cab">
                <h2>{formatoDia(g.fecha)}</h2>
                {g.gastoNeto !== 0 && <span className="cifra secundario">{fmt(g.gastoNeto)}</span>}
              </div>
              <ul className="lista">{g.movimientos.map(fila)}</ul>
            </div>
          ))}
        </>
      )}
    </section>
  )
}
