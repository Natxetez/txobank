import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAccionesFijos } from '../data/consultas'
import { mensajeError } from '../data/hooks'
import type { Mes } from '../data/types'
import type { FijoDelMes } from '../lib/fijos'
import { finDeMes, mesDeFecha, nombreMes } from '../lib/meses'
import { Hoja } from './Hoja'

interface Props {
  item: FijoDelMes
  mes: Mes
  onCerrar: () => void
}

/** Cambia la fecha de cargo de un fijo solo en un mes (este mes la luz llega el 8 en vez del 5). */
export function HojaFechaFijo({ item, mes, onCerrar }: Props) {
  const acciones = useAccionesFijos()
  const [fecha, setFecha] = useState(item.fechaEsperada)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function ejecutar(accion: () => Promise<void>) {
    setError(null)
    setEnviando(true)
    try {
      await accion()
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
      setEnviando(false)
    }
  }

  function guardar(e: FormEvent) {
    e.preventDefault()
    if (!fecha || mesDeFecha(fecha) !== mes) return setError(`Elige un día de ${nombreMes(mes)}.`)
    void ejecutar(() => acciones.fijarFecha(item.fijo.id, mes, fecha))
  }

  return (
    <Hoja titulo={`${item.fijo.nombre} · ${nombreMes(mes)}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="formulario">
        <p className="secundario">
          Cambia el día del cargo solo en {nombreMes(mes)}. Los demás meses siguen siendo el día {item.fijo.diaMes}.
        </p>
        <label className="campo">
          Fecha del cargo
          <input type="date" value={fecha} min={mes} max={finDeMes(mes)} onChange={(e) => setFecha(e.target.value)} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primario" disabled={enviando}>
          Guardar fecha
        </button>
        {item.fechaCambiada && (
          <button
            type="button"
            className="secundario-btn"
            disabled={enviando}
            onClick={() => void ejecutar(() => acciones.quitarFecha(item.fijo.id, mes))}
          >
            Volver al día {item.fijo.diaMes}
          </button>
        )}
      </form>
    </Hoja>
  )
}
