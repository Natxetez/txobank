import { useState } from 'react'
import type { FormEvent } from 'react'
import { AhorroCampos } from '../components/AhorroCampos'
import { FormCuenta } from '../components/FormCuenta'
import { FormFijo } from '../components/FormFijo'
import { Hoja } from '../components/Hoja'
import { useAccionesFijos, useFijos } from '../data/consultas'
import {
  mensajeError,
  useCategorias,
  useCrearCategorias,
  useCrearCuenta,
  useCuentas,
  useGuardarAjustes,
  useGuardarPresupuesto,
} from '../data/hooks'
import { ajustesDesdeCampos } from '../lib/ahorro'
import type { CamposAhorro } from '../lib/ahorro'
import { categoriasPorDefecto, colorPorPosicion } from '../lib/catalogo'
import { parseImporte } from '../lib/dinero'
import { mesActual } from '../lib/meses'
import { useFmt } from '../components/Discreto'
import { useEconomia } from '../data/EconomiaContext'

const TOTAL_PASOS = 3

/**
 * Asistente de primera vez (SPEC.md, sección 8): 1 cuenta, 2 mi mes, 3 mis fijos. Todos los pasos salvo
 * el primero se pueden saltar. Las categorías por defecto se crean nada más tener la cuenta, porque los
 * fijos ya las necesitan.
 */
export function Asistente({ onTerminar }: { onTerminar: () => void }) {
  const fmt = useFmt()
  const { economias, activa, cambiar } = useEconomia()
  // En una economía nueva (no la primera) se puede volver a otra sin terminar el asistente.
  const otra = economias.find((e) => e.id !== activa.id)
  const cuentas = useCuentas()
  const categorias = useCategorias()
  const fijos = useFijos()
  const crearCuenta = useCrearCuenta()
  const crearCategorias = useCrearCategorias()
  const guardarAjustes = useGuardarAjustes()
  const guardarPresupuesto = useGuardarPresupuesto()
  const accionesFijos = useAccionesFijos()

  const [paso, setPaso] = useState<1 | 2 | 3>((cuentas.data?.length ?? 0) > 0 ? 2 : 1)
  const [presupuesto, setPresupuesto] = useState('')
  const [ahorro, setAhorro] = useState<CamposAhorro>({ tipo: '', valor: '' })
  const [nuevoFijo, setNuevoFijo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function asegurarCategorias() {
    if ((categorias.data?.length ?? 0) === 0) await crearCategorias.mutateAsync(categoriasPorDefecto())
  }

  async function terminarMes(guardarMes: boolean) {
    setError(null)
    let importe: number | null = null
    let ajustes = null
    if (guardarMes) {
      if (presupuesto.trim() !== '') {
        importe = parseImporte(presupuesto)
        if (!importe || importe <= 0) return setError('El presupuesto del mes no es un importe válido.')
      }
      ajustes = ajustesDesdeCampos(ahorro)
      if (!ajustes) return setError('Revisa el objetivo de ahorro: el valor no es válido.')
    }
    setEnviando(true)
    try {
      if (importe) await guardarPresupuesto.mutateAsync({ mes: mesActual(), categoriaId: null, importe })
      if (ajustes && ajustes.ahorroTipo) await guardarAjustes.mutateAsync(ajustes)
      await asegurarCategorias()
      setPaso(3)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  function enviarMes(e: FormEvent) {
    e.preventDefault()
    void terminarMes(true)
  }

  return (
    <main className="asistente">
      <p className="secundario paso">
        {otra ? `${activa.nombre} · ` : ''}Paso {paso} de {TOTAL_PASOS}
      </p>

      {paso === 1 && (
        <>
          <h1>{otra ? `Configura ${activa.nombre}` : 'Tu primera cuenta'}</h1>
          <p className="secundario">
            {otra
              ? `Empecemos por la primera cuenta de ${activa.nombre}. Podrás añadir más después.`
              : 'Empecemos por tu primera cuenta. Podrás añadir más después.'}
          </p>
          <FormCuenta
            colorPorDefecto={colorPorPosicion(0)}
            orden={0}
            etiquetaGuardar="Siguiente"
            onGuardar={async (datos) => {
              await crearCuenta.mutateAsync(datos)
              await asegurarCategorias()
              setPaso(2)
            }}
          />
        </>
      )}

      {paso === 2 && (
        <>
          <h1>Tu mes</h1>
          <p className="secundario">
            Ambos datos son opcionales y se pueden cambiar en Ajustes. Sin presupuesto, Inicio te
            enseñará tus ingresos frente a tus gastos.
          </p>
          <form onSubmit={enviarMes} className="formulario">
            <label className="campo">
              Presupuesto total del mes (€), con los gastos fijos incluidos
              <input inputMode="decimal" placeholder="1200" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} />
            </label>
            <AhorroCampos valor={ahorro} onChange={setAhorro} />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="primario" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Siguiente'}
            </button>
            <button type="button" className="texto" disabled={enviando} onClick={() => void terminarMes(false)}>
              Saltar este paso
            </button>
          </form>
        </>
      )}

      {paso === 3 && (
        <>
          <h1>Tus fijos</h1>
          <p className="secundario">
            Alquiler, luz, seguros, suscripciones, la nómina… Nada se apunta solo: cada mes los marcas como pagados el día
            que te los cobran. Puedes añadir más después en Ajustes.
          </p>
          {(fijos.data?.length ?? 0) > 0 && (
            <ul className="lista">
              {fijos.data!.map((f) => (
                <li key={f.id} className="fila">
                  <span className="fila-texto">{f.nombre}</span>
                  <span className="cifra">{fmt(f.importe)}</span>
                </li>
              ))}
            </ul>
          )}
          <button className="secundario-btn" onClick={() => setNuevoFijo(true)}>
            Añadir un fijo
          </button>
          <button className="primario" onClick={onTerminar}>
            {(fijos.data?.length ?? 0) > 0 ? 'Terminar' : 'Saltar este paso'}
          </button>
          {nuevoFijo && (
            <Hoja titulo="Nuevo fijo" onCerrar={() => setNuevoFijo(false)}>
              <FormFijo
                etiquetaGuardar="Añadir"
                onGuardar={async (datos) => {
                  await accionesFijos.crear(datos)
                  setNuevoFijo(false)
                }}
              />
            </Hoja>
          )}
        </>
      )}

      {otra && (
        <button className="texto" onClick={() => cambiar(otra.id)}>
          Volver a {otra.nombre}
        </button>
      )}
    </main>
  )
}
