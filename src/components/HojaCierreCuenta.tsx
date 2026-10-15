import { useState } from 'react'
import { mensajeError, useAccionesMovimiento, useCuentas } from '../data/hooks'
import type { Cuenta } from '../data/types'
import { saldoInicialParaCerrar, traspasoDeCierre } from '../lib/cuentas'
import { horaActual, hoyISO } from '../lib/meses'
import { useFmt } from './Discreto'
import { Hoja } from './Hoja'

interface Props {
  cuenta: Cuenta
  /** Saldo de la cuenta (ya con los cambios del formulario), distinto de 0. */
  saldo: number
  /** Guarda la cuenta archivada; recibe el saldo inicial con el que debe quedar. */
  onArchivar: (saldoInicial: number) => Promise<void>
  onCerrar: () => void
}

/**
 * Aviso al archivar una cuenta con saldo: se deja a 0 con un traspaso a otra cuenta, o sin
 * movimiento (por si el dinero se sacó en efectivo o fue a otro sitio).
 */
export function HojaCierreCuenta({ cuenta, saldo, onArchivar, onCerrar }: Props) {
  const fmt = useFmt()
  const acciones = useAccionesMovimiento()
  const otras = (useCuentas().data ?? []).filter((c) => c.id !== cuenta.id && !c.archivada)
  const [modo, setModo] = useState<'traspaso' | 'sin-movimiento'>(otras.length > 0 ? 'traspaso' : 'sin-movimiento')
  const [destinoId, setDestinoId] = useState(otras[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function archivar() {
    setError(null)
    if (modo === 'traspaso' && !destinoId) return setError('Elige la cuenta a la que pasa el dinero.')
    setEnviando(true)
    try {
      if (modo === 'traspaso') {
        await acciones.crear(traspasoDeCierre(cuenta, saldo, destinoId, hoyISO(), horaActual()))
        await onArchivar(cuenta.saldoInicial)
      } else {
        await onArchivar(saldoInicialParaCerrar(cuenta.saldoInicial, saldo))
      }
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  return (
    <Hoja titulo={`Archivar ${cuenta.nombre}`} onCerrar={onCerrar}>
      <div className="formulario">
        <p>
          Esta cuenta tiene <strong className="cifra">{fmt(saldo)}</strong>. Al archivarla, su saldo pasa a 0 € para que tu
          patrimonio cuadre.
        </p>
        <fieldset className="alcance">
          <legend>¿Qué ha pasado con ese dinero?</legend>
          {otras.length > 0 && (
            <label className="casilla">
              <input type="radio" name="cierre" checked={modo === 'traspaso'} onChange={() => setModo('traspaso')} />
              {saldo > 0 ? 'Lo he pasado a otra cuenta' : 'La he saldado desde otra cuenta'}
            </label>
          )}
          <label className="casilla">
            <input
              type="radio"
              name="cierre"
              checked={modo === 'sin-movimiento'}
              onChange={() => setModo('sin-movimiento')}
            />
            Cerrar sin movimiento (lo saqué en efectivo o fue a otro sitio)
          </label>
        </fieldset>
        {modo === 'traspaso' ? (
          <label className="campo">
            {saldo > 0 ? 'Cuenta a la que pasa' : 'Cuenta desde la que se salda'}
            <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
              {otras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="ayuda">
            No se apunta ningún movimiento: se ajusta el saldo inicial de la cuenta para dejarla a 0. El patrimonio de los
            meses anteriores también bajará en {fmt(Math.abs(saldo))}.
          </p>
        )}
        {modo === 'traspaso' && (
          <p className="ayuda">Se apunta un traspaso de {fmt(Math.abs(saldo))} con fecha de hoy. No cuenta como gasto.</p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="primario" disabled={enviando} onClick={() => void archivar()}>
          {enviando ? 'Archivando…' : 'Dejar a 0 y archivar'}
        </button>
      </div>
    </Hoja>
  )
}
