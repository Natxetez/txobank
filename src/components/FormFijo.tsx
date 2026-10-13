import { useState } from 'react'
import type { FormEvent } from 'react'
import { mensajeError, useCategorias, useCuentas } from '../data/hooks'
import type { Fijo, NuevoFijo } from '../data/types'
import { PERIODICIDADES, esPuntual, validarFijo } from '../lib/fijos'
import { aTextoEditable, parseImporte } from '../lib/dinero'
import type { Mes } from '../data/types'
import { diaDeFecha, fechaEnMes, hoyISO, mesActual, mesDeFecha } from '../lib/meses'

interface Props {
  /** Si se pasa, se edita ese fijo. */
  inicial?: Fijo
  /** Mes en el que empieza un fijo nuevo (por defecto, el actual). */
  mesInicial?: Mes
  etiquetaGuardar: string
  onGuardar: (datos: NuevoFijo) => Promise<void>
}

/** "2026-09-01" → "2026-09" (valor de <input type="month">) y al revés. */
const aMesInput = (mes: string) => mes.slice(0, 7)
const deMesInput = (valor: string) => `${valor}-01`

/** Valor del selector de periodicidad para un cargo puntual ("Una vez"). */
const UNA_VEZ = 0

export function FormFijo({ inicial, mesInicial, etiquetaGuardar, onGuardar }: Props) {
  const cuentas = useCuentas().data ?? []
  const categorias = useCategorias().data ?? []
  const cuentasActivas = cuentas.filter((c) => !c.archivada || c.id === inicial?.cuentaId || c.id === inicial?.cuentaDestinoId)

  const mesBase = inicial?.desde ?? mesInicial ?? mesActual()
  const diaBase = inicial?.diaMes ?? Number(hoyISO().slice(8))

  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '')
  const [tipo, setTipo] = useState<Fijo['tipo']>(inicial?.tipo ?? 'gasto')
  const [importe, setImporte] = useState(inicial ? aTextoEditable(inicial.importe) : '')
  const [cuentaId, setCuentaId] = useState(inicial?.cuentaId ?? cuentas.find((c) => !c.archivada)?.id ?? '')
  const [destinoId, setDestinoId] = useState(inicial?.cuentaDestinoId ?? '')
  const [categoriaId, setCategoriaId] = useState(inicial?.categoriaId ?? '')
  const [diaMes, setDiaMes] = useState(String(diaBase))
  const [cadaMeses, setCadaMeses] = useState(inicial && esPuntual(inicial) ? UNA_VEZ : (inicial?.cadaMeses ?? 1))
  const [desde, setDesde] = useState(aMesInput(mesBase))
  const [hasta, setHasta] = useState(inicial?.hasta && !esPuntual(inicial) ? aMesInput(inicial.hasta) : '')
  const [fechaUnica, setFechaUnica] = useState(fechaEnMes(mesBase, diaBase))
  const unaVez = cadaMeses === UNA_VEZ
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
    if (unaVez && !fechaUnica) return setError('Elige la fecha del cargo.')
    const mesUnico = unaVez ? mesDeFecha(fechaUnica) : null
    const datos: NuevoFijo = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      tipo,
      importe: centimos,
      cuentaId,
      cuentaDestinoId: tipo === 'traspaso' ? destinoId || null : null,
      categoriaId: tipo === 'traspaso' ? null : categoriaId || null,
      diaMes: mesUnico ? diaDeFecha(fechaUnica) : Number(diaMes),
      cadaMeses: mesUnico ? 1 : cadaMeses,
      desde: mesUnico ?? (desde ? deMesInput(desde) : ''),
      hasta: mesUnico ?? (hasta ? deMesInput(hasta) : null),
      activo: unaVez ? true : activo,
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
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Alquiler, Luz, IBI, Nómina…" autoFocus={!inicial} />
      </label>
      <label className="campo">
        Descripción (opcional)
        <textarea
          rows={2}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Compañía, número de contrato, cómo se paga…"
        />
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
      <label className="campo">
        Periodicidad
        <select value={cadaMeses} onChange={(e) => setCadaMeses(Number(e.target.value))}>
          {PERIODICIDADES.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.etiqueta}
            </option>
          ))}
          <option value={UNA_VEZ}>Una vez (cargo puntual)</option>
        </select>
      </label>
      {unaVez ? (
        <label className="campo">
          Fecha del cargo
          <input type="date" value={fechaUnica} onChange={(e) => setFechaUnica(e.target.value)} />
        </label>
      ) : (
        <>
          <label className="campo">
            Día del cargo
            <input inputMode="numeric" value={diaMes} onChange={(e) => setDiaMes(e.target.value)} />
          </label>
          <p className="ayuda">Si un mes se cobra otro día, cámbialo desde la lista de fijos de ese mes.</p>
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
          {cadaMeses > 1 && <p className="ayuda">Tocará ese mes y luego cada {cadaMeses} meses.</p>}
        </>
      )}
      {!unaVez && (
        <label className="casilla">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          <span>
            Activo
            <span className="secundario pequeno bloque">
              Desactívalo para pausarlo: dejará de salir en los meses siguientes.
            </span>
          </span>
        </label>
      )}
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
