import { useState } from 'react'
import { useAccionesFijos } from '../data/consultas'
import { mensajeError } from '../data/hooks'
import type { Fijo, Mes } from '../data/types'
import { FormFijo } from './FormFijo'
import { Hoja } from './Hoja'

interface Props {
  /** Si se pasa, se edita ese fijo; si no, se crea uno nuevo. */
  fijo?: Fijo
  /** Mes en el que empieza un fijo nuevo. */
  mesInicial?: Mes
  onCerrar: () => void
}

/** Hoja para crear, editar o eliminar un fijo. */
export function HojaFijo({ fijo, mesInicial, onCerrar }: Props) {
  const acciones = useAccionesFijos()
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null)

  async function borrar(f: Fijo) {
    try {
      await acciones.borrar(f.id)
      onCerrar()
    } catch (err) {
      setErrorBorrado(mensajeError(err))
    }
  }

  return (
    <Hoja titulo={fijo ? 'Editar fijo' : 'Nuevo fijo'} onCerrar={onCerrar}>
      <FormFijo
        inicial={fijo}
        mesInicial={mesInicial}
        etiquetaGuardar={fijo ? 'Guardar cambios' : 'Crear fijo'}
        onGuardar={async (datos) => {
          if (fijo) await acciones.actualizar(fijo.id, datos)
          else await acciones.crear(datos)
          onCerrar()
        }}
      />
      {fijo && (
        <div className="zona-borrar">
          <p className="secundario pequeno">
            Editar un fijo no cambia los pagos pasados. Al eliminarlo, los movimientos ya pagados se quedan sin fijo.
          </p>
          {errorBorrado && (
            <p className="error" role="alert">
              {errorBorrado}
            </p>
          )}
          {confirmarBorrado ? (
            <div className="confirmar">
              <span>¿Eliminar «{fijo.nombre}»?</span>
              <button type="button" className="secundario-btn" onClick={() => setConfirmarBorrado(false)}>
                Cancelar
              </button>
              <button type="button" className="peligro" onClick={() => void borrar(fijo)}>
                Eliminar
              </button>
            </div>
          ) : (
            <button type="button" className="secundario-btn borrar" onClick={() => setConfirmarBorrado(true)}>
              Eliminar fijo
            </button>
          )}
        </div>
      )}
    </Hoja>
  )
}
