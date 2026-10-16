import { useState } from 'react'
import type { FormEvent } from 'react'
import { mensajeError, useAccionesMovimiento, useCuentas } from '../data/hooks'
import type { Mes } from '../data/types'
import { useEconomia } from '../data/EconomiaContext'
import { aTextoEditable, parseImporte } from '../lib/dinero'
import { esTraspasoAOtraEconomia, traspasoDePago, validarTraspasoEconomias } from '../lib/economias'
import { movimientoDePago } from '../lib/fijos'
import type { FijoDelMes } from '../lib/fijos'
import { hoyISO, nombreMes } from '../lib/meses'
import { validarMovimiento } from '../lib/movimientos'
import { Hoja } from './Hoja'
import { useCuentasConEconomia } from './OpcionesCuentas'
import { useAvisoGuardado } from './useAvisoGuardado'

const VERBO = { gasto: 'pagado', ingreso: 'cobrado', traspaso: 'hecho' } as const

interface Props {
  item: FijoDelMes
  mes: Mes
  onCerrar: () => void
}

/** Hoja pequeña para marcar un fijo como pagado (o cobrado, o hecho) con el importe y la fecha reales. */
export function HojaPagarFijo({ item, mes, onCerrar }: Props) {
  const { fijo } = item
  const cuentas = useCuentas().data ?? []
  const acciones = useAccionesMovimiento()
  const avisar = useAvisoGuardado()
  const { activa } = useEconomia()
  const { economiaDe } = useCuentasConEconomia()

  const [importe, setImporte] = useState(aTextoEditable(fijo.importe))
  const [fecha, setFecha] = useState(hoyISO())
  const [cuentaId, setCuentaId] = useState(fijo.cuentaId)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const centimos = parseImporte(importe)
    if (centimos === null) return setError('Escribe un importe válido.')
    const datos = { fecha, importe: centimos, cuentaId }
    // Traspaso a otra economía: el gasto aquí y el ingreso en la cuenta de destino de la otra.
    const traspaso = esTraspasoAOtraEconomia(fijo)
      ? traspasoDePago(fijo, mes, datos, activa.id, economiaDe(fijo.cuentaDestinoId ?? ''))
      : null
    const nuevo = movimientoDePago(fijo, mes, datos)
    const fallo = traspaso ? validarTraspasoEconomias(traspaso) : validarMovimiento(nuevo)
    if (fallo) return setError(fallo)
    setEnviando(true)
    try {
      const creado = traspaso ? await acciones.crearTraspaso(traspaso) : await acciones.crear(nuevo)
      void avisar(creado)
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  return (
    <Hoja titulo={`${fijo.nombre} · ${nombreMes(mes)}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="formulario">
        <input
          className="importe-grande"
          inputMode="decimal"
          aria-label="Importe real en euros"
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
        />
        <div className="linea">
          <label className="campo">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="campo">
            Cuenta
            <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              {cuentas
                .filter((c) => !c.archivada || c.id === cuentaId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primario" disabled={enviando}>
          {enviando ? 'Guardando…' : `Marcar como ${VERBO[fijo.tipo]}`}
        </button>
      </form>
    </Hoja>
  )
}
