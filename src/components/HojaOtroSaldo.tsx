import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAccionesOtrosSaldos } from '../data/consultas'
import { mensajeError } from '../data/hooks'
import type { ActualizacionSaldo, OtroSaldo } from '../data/types'
import { aEntradaLocal, deEntradaLocal, fechaHoraCorta, historialDe } from '../lib/patrimonio'
import { useFmt } from './Discreto'
import { CampoSaldo, leerSaldo } from './FormOtroSaldo'
import { Hoja } from './Hoja'
import { Icono, IconoCategoria } from './Icono'

interface Props {
  otro: OtroSaldo
  historial: ActualizacionSaldo[]
  onEditar: () => void
  onCerrar: () => void
}

/** Hoja de un otro saldo: actualizar su saldo (con fecha y hora) y ver o borrar su historial. */
export function HojaOtroSaldo({ otro, historial, onEditar, onCerrar }: Props) {
  const fmt = useFmt()
  const acciones = useAccionesOtrosSaldos()
  const entradas = historialDe(historial, otro.id)
  const actual = entradas[0]?.actualizacion

  const [saldo, setSaldo] = useState('')
  const [negativo, setNegativo] = useState(false)
  const [cuando, setCuando] = useState(() => aEntradaLocal())
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [aBorrar, setABorrar] = useState<string | null>(null)
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null)

  async function registrar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const valor = leerSaldo(saldo, negativo)
    if (valor === null) return setError('Escribe el saldo actual (por ejemplo, 125,40).')
    const fechaHora = deEntradaLocal(cuando)
    if (!fechaHora) return setError('La fecha y hora no son válidas.')
    setEnviando(true)
    try {
      await acciones.registrarSaldo(otro.id, valor, fechaHora)
      setSaldo('')
      setNegativo(false)
      setCuando(aEntradaLocal())
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  async function borrar(id: string) {
    setErrorBorrado(null)
    try {
      await acciones.borrarActualizacion(id)
      setABorrar(null)
    } catch (err) {
      setErrorBorrado(mensajeError(err))
    }
  }

  return (
    <Hoja titulo={otro.nombre} onCerrar={onCerrar}>
      <div className="otro-cab">
        <IconoCategoria color={otro.color}>{otro.icono ?? <Icono nombre="cartera" />}</IconoCategoria>
        <div className="fila-texto">
          <span className={actual && actual.saldo < 0 ? 'cifra otro-cifra negativo-saldo' : 'cifra otro-cifra'}>
            {fmt(actual?.saldo ?? 0)}
          </span>
          <span className="secundario pequeno">
            {actual ? `Actualizado el ${fechaHoraCorta(actual.fechaHora)}` : 'Aún sin actualizaciones'}
          </span>
        </div>
        <button type="button" className="secundario-btn" onClick={onEditar}>
          Editar
        </button>
      </div>

      <form onSubmit={registrar} className="formulario">
        <CampoSaldo
          etiqueta="Nuevo saldo (€)"
          valor={saldo}
          negativo={negativo}
          onValor={setSaldo}
          onNegativo={setNegativo}
          autoFocus
        />
        <label className="campo">
          Fecha y hora
          <input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primario" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Actualizar saldo'}
        </button>
      </form>

      <h3 className="subtitulo">Historial</h3>
      {entradas.length === 0 ? (
        <p className="secundario">Aún no hay actualizaciones.</p>
      ) : (
        <ul className="lista historial-saldos">
          {entradas.map(({ actualizacion: a, diferencia }) => (
            <li key={a.id}>
              <div className="fila">
                <span className="fila-texto">
                  <span className={a.saldo < 0 ? 'cifra negativo-saldo' : 'cifra'}>{fmt(a.saldo)}</span>
                  <span className="secundario pequeno">{fechaHoraCorta(a.fechaHora)}</span>
                </span>
                {diferencia !== null && diferencia !== 0 && (
                  <span className={diferencia > 0 ? 'cifra diferencia sube' : 'cifra diferencia baja'}>
                    {diferencia > 0 ? '+' : '−'}
                    {fmt(Math.abs(diferencia))}
                  </span>
                )}
                {diferencia === null && <span className="secundario pequeno">Inicial</span>}
                <button
                  type="button"
                  className="mini"
                  aria-label={`Borrar la actualización del ${fechaHoraCorta(a.fechaHora)}`}
                  onClick={() => setABorrar(aBorrar === a.id ? null : a.id)}
                >
                  <Icono nombre="cerrar" />
                </button>
              </div>
              {aBorrar === a.id && (
                <div className="confirmar confirmar-historial">
                  <span>¿Borrar esta actualización?</span>
                  <button type="button" className="secundario-btn" onClick={() => setABorrar(null)}>
                    Cancelar
                  </button>
                  <button type="button" className="peligro" onClick={() => void borrar(a.id)}>
                    Borrar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {errorBorrado && (
        <p className="error" role="alert">
          {errorBorrado}
        </p>
      )}
    </Hoja>
  )
}
