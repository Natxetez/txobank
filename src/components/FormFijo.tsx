import { useState } from 'react'
import type { FormEvent } from 'react'
import { mensajeError, useCategorias, useCuentas } from '../data/hooks'
import type { Fijo, NuevoFijo } from '../data/types'
import { PERIODICIDADES, validarFijo } from '../lib/fijos'
import { aTextoEditable, parseImporte } from '../lib/dinero'
import { hoyISO, mesActual } from '../lib/meses'

interface Props {
  /** Si se pasa, se edita ese fijo. */
  inicial?: Fijo
  etiquetaGuardar: string
  onGuardar: (datos: NuevoFijo) => Promise<void>
}

/** "2026-09-01" → "2026-09" (valor de <input type="month">) y al revés. */
const aMesInput = (mes: string) => mes.slice(0, 7)
const deMesInput = (valor: string) => `${valor}-01`

export function FormFijo({ inicial, etiquetaGuardar, onGuardar }: Props) {
  const cuentas = useCuentas().data ?? []
  const categorias = useCategorias().data ?? []
  const cuentasActivas = cuentas.filter((c) => !c.archivada || c.id === inicial?.cuentaId || c.id === inicial?.cuentaDestinoId)

  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [tipo, setTipo] = useState<Fijo['tipo']>(inicial?.tipo ?? 'gasto')
  const [importe, setImporte] = useState(inicial ? aTextoEditable(inicial.importe) : '')
  const [cuentaId, setCuentaId] = useState(inicial?.cuentaId ?? cuentas.find((c) => !c.archivada)?.id ?? '')
  const [destinoId, setDestinoId] = useState(inicial?.cuentaDestinoId ?? '')
  const [categoriaId, setCategoriaId] = useState(inicial?.categoriaId ?? '')
  const [diaMes, setDiaMes] = useState(String(inicial?.diaMes ?? Number(hoyISO().slice(8))))
  const [cadaMeses, setCadaMeses] = useState(inicial?.cadaMeses ?? 1)
  const [desde, setDesde] = useState(aMesInput(inicial?.desde ?? mesActual()))
  const [hasta, setHasta] = useState(inicial?.hasta ? aMesInput(inicial.hasta) : '')
  const [activo, setActivo] = useState(inicial?.activo ?? true)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const categoriasDelTipo = categorias.filter(
    (c) => c.tipo === (tipo === 'ingreso' ? 'ingreso' : 'gasto') && (!c.archivada || c.id === categoriaId),
  )

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const centimos = parseImporte(importe)
    if (centimos === null) return setError('Escribe un importe válido.')
    const datos: NuevoFijo = {
      nombre: nombre.trim(),
      tipo,
      importe: centimos,
      cuentaId,
      cuentaDestinoId: tipo === 'traspaso' ? destinoId || null : null,
      categoriaId: tipo === 'traspaso' ? null : categoriaId || null,
      diaMes: Number(diaMes),
      cadaMeses,
      desde: desde ? deMesInput(desde) : '',
      hasta: hasta ? deMesInput(hasta) : null,
      activo,
    }
    const fallo = validarFijo(datos)
    if (fallo) return setError(fallo)
    setEnviando(true)
    try {
      await onGuardar(datos)
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="formulario">
      <label className="campo">
        Nombre
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Alquiler, Luz, Nómina…" autoFocus={!inicial} />
      </label>
      <div className="segmentado" role="tablist" aria-label="Tipo de fijo">
        {(['gasto', 'ingreso', 'traspaso'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tipo === t}
            className={tipo === t ? 'activa' : ''}
            onClick={() => {
              setTipo(t)
              setCategoriaId('')
            }}
          >
            {t === 'gasto' ? 'Gasto' : t === 'ingreso' ? 'Ingreso' : 'Traspaso'}
          </button>
        ))}
      </div>
      <label className="campo">
        Importe previsto (€)
        <input inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="600" />
      </label>
      <label className="campo">
        {tipo === 'traspaso' ? 'Desde la cuenta' : 'Cuenta'}
        <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
          {cuentasActivas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      {tipo === 'traspaso' ? (
        <label className="campo">
          Hacia la cuenta
          <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
            <option value="">Elige…</option>
            {cuentasActivas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="campo">
          Categoría
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Elige…</option>
            {categoriasDelTipo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icono ? `${c.icono} ` : ''}
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="dos-columnas">
        <label className="campo">
          Día aproximado
          <input inputMode="numeric" value={diaMes} onChange={(e) => setDiaMes(e.target.value)} />
        </label>
        <label className="campo">
          Periodicidad
          <select value={cadaMeses} onChange={(e) => setCadaMeses(Number(e.target.value))}>
            {PERIODICIDADES.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="dos-columnas">
        <label className="campo">
          {cadaMeses === 1 ? 'Desde el mes' : 'Primer mes en que toca'}
          <input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="campo">
          Hasta el mes (opcional)
          <input type="month" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
      </div>
      {cadaMeses > 1 && (
        <p className="secundario pequeno">Tocará ese mes y luego cada {cadaMeses} meses.</p>
      )}
      <label className="casilla">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        Activo (desmárcalo para pausarlo: dejará de salir en los meses siguientes)
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primario" disabled={enviando}>
        {enviando ? 'Guardando…' : etiquetaGuardar}
      </button>
    </form>
  )
}
