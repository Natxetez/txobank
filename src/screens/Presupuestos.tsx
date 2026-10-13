import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SelectorMes } from '../components/SelectorMes'
import { useFmt } from '../components/Discreto'
import { Hoja } from '../components/Hoja'
import { useAccionesPresupuestos, usePresupuestos, useTodosMovimientos } from '../data/consultas'
import { mensajeError, useCategorias } from '../data/hooks'
import type { Mes, Presupuesto } from '../data/types'
import { aTextoEditable, parseImporte } from '../lib/dinero'
import { mesActual, nombreMes } from '../lib/meses'
import { excesoSobreTotal, presupuestoVigente, sugerirDesdeMedia } from '../lib/presupuestos'
import type { Alcance } from '../lib/presupuestos'

interface Fila {
  categoriaId: string | null
  titulo: string
  icono: string | null
}

function EditarPresupuesto({
  fila,
  mes,
  presupuestos,
  onCerrar,
}: {
  fila: Fila
  mes: Mes
  presupuestos: Presupuesto[]
  onCerrar: () => void
}) {
  const fmt = useFmt()
  const acciones = useAccionesPresupuestos()
  const vigente = presupuestoVigente(presupuestos, mes, fila.categoriaId)
  const [importe, setImporte] = useState(vigente.importe !== null ? aTextoEditable(vigente.importe) : '')
  const [alcance, setAlcance] = useState<Alcance>('siguientes')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function guardar(nuevo: number | null) {
    setEnviando(true)
    setError(null)
    try {
      await acciones.cambiar(presupuestos, mes, fila.categoriaId, nuevo, alcance)
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    const centimos = parseImporte(importe)
    if (centimos === null || centimos <= 0) return setError('Escribe un importe mayor que 0.')
    void guardar(centimos)
  }

  return (
    <Hoja titulo={`${fila.icono ? fila.icono + ' ' : ''}${fila.titulo} · ${nombreMes(mes)}`} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="formulario">
        <input
          className="importe-grande"
          inputMode="decimal"
          placeholder="0"
          aria-label="Presupuesto en euros"
          autoFocus
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
        />
        {vigente.importe !== null && vigente.definidoEn !== mes && vigente.definidoEn && (
          <p className="secundario pequeno">
            Ahora es {fmt(vigente.importe)}, igual que en {nombreMes(vigente.definidoEn)}.
          </p>
        )}
        <fieldset className="alcance">
          <legend>¿Desde cuándo?</legend>
          <label className="casilla">
            <input type="radio" name="alcance" checked={alcance === 'mes'} onChange={() => setAlcance('mes')} />
            Solo este mes
          </label>
          <label className="casilla">
            <input type="radio" name="alcance" checked={alcance === 'siguientes'} onChange={() => setAlcance('siguientes')} />
            Este mes y los siguientes
          </label>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primario" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
        {vigente.importe !== null && (
          <button type="button" className="secundario-btn borrar" disabled={enviando} onClick={() => void guardar(null)}>
            Quitar el presupuesto
          </button>
        )}
      </form>
    </Hoja>
  )
}

function HojaSugerencias({ mes, presupuestos, onCerrar }: { mes: Mes; presupuestos: Presupuesto[]; onCerrar: () => void }) {
  const fmt = useFmt()
  const categorias = useCategorias().data ?? []
  const todos = useTodosMovimientos()
  const acciones = useAccionesPresupuestos()
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [quitadas, setQuitadas] = useState<Set<string>>(new Set())

  const gasto = categorias.filter((c) => c.tipo === 'gasto' && !c.archivada)
  const sugerido = useMemo(
    () => (todos.data ? sugerirDesdeMedia(todos.data, mes, gasto.map((c) => c.id)) : null),
    [todos.data, mes, gasto],
  )
  const clave = (id: string | null) => id ?? 'total'

  const filas = sugerido
    ? [
        ...(sugerido.total ? [{ id: null as string | null, titulo: 'Presupuesto total', importe: sugerido.total }] : []),
        ...sugerido.porCategoria.map((s) => ({
          id: s.categoriaId as string | null,
          titulo: `${gasto.find((c) => c.id === s.categoriaId)?.icono ?? ''} ${gasto.find((c) => c.id === s.categoriaId)?.nombre ?? ''}`,
          importe: s.importe,
        })),
      ]
    : []

  async function aplicar() {
    setEnviando(true)
    setError(null)
    try {
      let actuales = presupuestos
      for (const f of filas.filter((x) => !quitadas.has(clave(x.id)))) {
        await acciones.cambiar(actuales, mes, f.id, f.importe, 'siguientes')
        actuales = actuales.filter((p) => !(p.categoriaId === f.id && p.mes > mes))
      }
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  return (
    <Hoja titulo="Sugeridos según tu media" onCerrar={onCerrar}>
      {todos.isPending ? (
        <p className="secundario">Calculando…</p>
      ) : filas.length === 0 ? (
        <p className="secundario">Todavía no hay meses anteriores con movimientos para calcular una media.</p>
      ) : (
        <div className="formulario">
          <p className="secundario pequeno">Media de los 3 meses anteriores, redondeada a 10 €. Se aplican a este mes y los siguientes.</p>
          <ul className="lista">
            {filas.map((f) => (
              <li key={clave(f.id)}>
                <label className="fila casilla">
                  <input
                    type="checkbox"
                    checked={!quitadas.has(clave(f.id))}
                    onChange={(e) => {
                      const nuevo = new Set(quitadas)
                      if (e.target.checked) nuevo.delete(clave(f.id))
                      else nuevo.add(clave(f.id))
                      setQuitadas(nuevo)
                    }}
                  />
                  <span className="fila-texto">{f.titulo}</span>
                  <span className="cifra">{fmt(f.importe)}</span>
                </label>
              </li>
            ))}
          </ul>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primario" disabled={enviando} onClick={() => void aplicar()}>
            {enviando ? 'Aplicando…' : 'Aplicar'}
          </button>
        </div>
      )}
    </Hoja>
  )
}

export function Presupuestos() {
  const fmt = useFmt()
  const [mes, setMes] = useState(mesActual())
  const presupuestos = usePresupuestos()
  const categorias = useCategorias().data ?? []
  const [editando, setEditando] = useState<Fila | null>(null)
  const [params] = useSearchParams()
  const [sugiriendo, setSugiriendo] = useState(params.get('sugerir') === '1')

  const gasto = categorias.filter((c) => c.tipo === 'gasto' && !c.archivada)
  const ps = presupuestos.data ?? []
  const exceso = excesoSobreTotal(ps, mes, gasto.map((c) => c.id))

  const filas: Fila[] = [
    { categoriaId: null, titulo: 'Presupuesto total', icono: null },
    ...gasto.map((c) => ({ categoriaId: c.id, titulo: c.nombre, icono: c.icono })),
  ]

  return (
    <section className="pantalla ancho">
      <SelectorMes mes={mes} onCambiar={setMes} />
      <p className="secundario pequeno">
        El presupuesto total incluye los gastos fijos. Cada mes hereda el del anterior si no lo cambias.
      </p>

      {exceso && (
        <p className="aviso-suma" role="status">
          Tus categorías suman {fmt(exceso.suma)} y tu presupuesto total es {fmt(exceso.total)}.
        </p>
      )}

      {presupuestos.isPending ? (
        <p className="secundario">Cargando…</p>
      ) : (
        <ul className="lista">
          {filas.map((f) => {
            const v = presupuestoVigente(ps, mes, f.categoriaId)
            const heredado = v.definidoEn !== null && v.definidoEn !== mes
            return (
              <li key={f.categoriaId ?? 'total'}>
                <button className="fila" onClick={() => setEditando(f)}>
                  <span className="fila-texto">
                    <span>
                      {f.icono ? `${f.icono} ` : ''}
                      {f.titulo}
                    </span>
                    {v.importe !== null && heredado && v.definidoEn && (
                      <span className="secundario pequeno">igual que en {nombreMes(v.definidoEn)}</span>
                    )}
                  </span>
                  <span className={v.importe === null ? 'secundario' : 'cifra'}>
                    {v.importe === null ? 'Sin presupuesto' : fmt(v.importe)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button className="secundario-btn" onClick={() => setSugiriendo(true)}>
        Sugerir a partir de mi media
      </button>
      <Link to="/" className="enlace">
        Volver a Inicio
      </Link>

      {editando && <EditarPresupuesto fila={editando} mes={mes} presupuestos={ps} onCerrar={() => setEditando(null)} />}
      {sugiriendo && <HojaSugerencias mes={mes} presupuestos={ps} onCerrar={() => setSugiriendo(false)} />}
    </section>
  )
}
