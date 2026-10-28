import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Cabecera } from '../../components/Cabecera'
import { entregarArchivo } from '../../components/exportarCsv'
import { dataSource } from '../../data'
import { useEconomia } from '../../data/EconomiaContext'
import { mensajeError } from '../../data/hooks'
import type { CopiaSeguridad } from '../../data/types'
import { crearCopia, leerCopia, nombreArchivoCopia, prepararRestauracion, resumenCopia } from '../../lib/copia'
import { hoyISO } from '../../lib/meses'
import { fechaHoraCorta } from '../../lib/patrimonio'
import { VERSION } from '../../version'
import { guardarUltimaCopia, textoUltimaCopia } from './ultimaCopia'

/** Ajustes › Copia de seguridad: descargar todos los datos en un archivo y restaurarlos desde él. */
export function AjustesCopia() {
  const qc = useQueryClient()
  const { economias, cambiar } = useEconomia()
  const [descargando, setDescargando] = useState(false)
  const [ultima, setUltima] = useState(textoUltimaCopia)
  const [copia, setCopia] = useState<CopiaSeguridad | null>(null)
  const [restaurando, setRestaurando] = useState(false)
  const [restauradas, setRestauradas] = useState<{ id: string; nombre: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  async function descargar() {
    setError(null)
    setDescargando(true)
    try {
      const creada = new Date().toISOString()
      const datos = crearCopia(await dataSource.copia.exportar(), VERSION, creada)
      const archivo = new File([JSON.stringify(datos)], nombreArchivoCopia(hoyISO()), { type: 'application/json' })
      if (await entregarArchivo(archivo)) {
        guardarUltimaCopia(creada)
        setUltima(textoUltimaCopia())
      }
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setDescargando(false)
    }
  }

  async function elegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    setError(null)
    setRestauradas([])
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    try {
      setCopia(leerCopia(await archivo.text()))
    } catch (err) {
      setCopia(null)
      setError(mensajeError(err))
    }
  }

  async function restaurar() {
    if (!copia) return
    setError(null)
    setRestaurando(true)
    try {
      const nuevas = prepararRestauracion(copia, economias, () => crypto.randomUUID())
      await dataSource.copia.restaurar(nuevas)
      await qc.invalidateQueries()
      setRestauradas(nuevas.map((n) => ({ id: n.economia.id, nombre: n.economia.nombre })))
      setCopia(null)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setRestaurando(false)
    }
  }

  const resumen = copia ? resumenCopia(copia) : null

  return (
    <section className="pantalla ancho">
      <Cabecera titulo="Copia de seguridad" />

      <div className="tarjeta copia">
        <h2>Descargar copia</h2>
        <p className="secundario">
          Un archivo con todo: tus economías con sus cuentas, movimientos, fijos, presupuestos, grupos, otros saldos y
          ajustes. Guárdalo en Archivos o en iCloud Drive.
        </p>
        <button type="button" className="primario" disabled={descargando} onClick={() => void descargar()}>
          {descargando ? 'Preparando…' : 'Descargar copia'}
        </button>
        <p className="secundario pequeno">{ultima}</p>
      </div>

      <div className="tarjeta copia">
        <h2>Restaurar una copia</h2>
        <p className="secundario">
          Las economías de la copia se añaden como economías nuevas: no se toca ni se borra nada de lo que ya tienes. Si
          una se llama igual que otra tuya, se le añade «(restaurada)».
        </p>
        <label className="secundario-btn boton-archivo">
          Elegir archivo
          <input type="file" accept=".json,application/json" onChange={(e) => void elegirArchivo(e)} />
        </label>

        {resumen && (
          <div className="resumen-copia">
            <p>
              Copia del <strong>{fechaHoraCorta(resumen.creada)}</strong>:
            </p>
            <ul>
              {resumen.economias.map((e, i) => (
                <li key={i}>
                  <strong>{e.nombre}</strong>: {e.cuentas} {e.cuentas === 1 ? 'cuenta' : 'cuentas'}, {e.movimientos}{' '}
                  {e.movimientos === 1 ? 'movimiento' : 'movimientos'} y {e.fijos} {e.fijos === 1 ? 'fijo' : 'fijos'}
                </li>
              ))}
            </ul>
            <button type="button" className="primario" disabled={restaurando} onClick={() => void restaurar()}>
              {restaurando
                ? 'Restaurando…'
                : resumen.economias.length === 1
                  ? 'Restaurar como economía nueva'
                  : `Restaurar ${resumen.economias.length} economías nuevas`}
            </button>
            <button type="button" className="texto" disabled={restaurando} onClick={() => setCopia(null)}>
              Cancelar
            </button>
          </div>
        )}

        {restauradas.length > 0 && (
          <div className="resumen-copia">
            <p className="ok">Copia restaurada.</p>
            {restauradas.map((r) => (
              <button key={r.id} type="button" className="secundario-btn" onClick={() => cambiar(r.id)}>
                Entrar en {r.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
