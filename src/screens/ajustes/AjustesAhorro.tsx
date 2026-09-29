import { useState } from 'react'
import type { FormEvent } from 'react'
import { AhorroCampos } from '../../components/AhorroCampos'
import { Cabecera } from '../../components/Cabecera'
import { mensajeError, useAjustes, useGuardarAjustes } from '../../data/hooks'
import type { Ajustes } from '../../data/types'
import { ajustesDesdeCampos, camposDesdeAjustes } from '../../lib/ahorro'
import type { CamposAhorro } from '../../lib/ahorro'

function Formulario({ inicial }: { inicial: Ajustes }) {
  const guardar = useGuardarAjustes()
  const [campos, setCampos] = useState<CamposAhorro>(camposDesdeAjustes(inicial))
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardado(false)
    const ajustes = ajustesDesdeCampos(campos)
    if (!ajustes) return setError('El valor no es válido.')
    try {
      await guardar.mutateAsync(ajustes)
      setGuardado(true)
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  return (
    <form onSubmit={enviar} className="formulario">
      <AhorroCampos
        valor={campos}
        onChange={(c) => {
          setCampos(c)
          setGuardado(false)
        }}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {guardado && <p className="ok">Guardado.</p>}
      <button type="submit" className="primario" disabled={guardar.isPending}>
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}

export function AjustesAhorro() {
  const ajustes = useAjustes()
  return (
    <section className="pantalla ancho">
      <Cabecera titulo="Objetivo de ahorro" />
      <p className="secundario">
        Se descuenta del límite del mes cuando no tienes un presupuesto total, y se compara en las estadísticas.
      </p>
      {ajustes.isPending ? <p className="secundario">Cargando…</p> : <Formulario inicial={ajustes.data!} />}
      {ajustes.isError && (
        <p className="error" role="alert">
          {mensajeError(ajustes.error)}
        </p>
      )}
    </section>
  )
}
