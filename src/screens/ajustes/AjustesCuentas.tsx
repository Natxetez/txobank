import { useState } from 'react'
import { Cabecera } from '../../components/Cabecera'
import { FormCuenta } from '../../components/FormCuenta'
import { Hoja } from '../../components/Hoja'
import { useActualizarCuenta, useCrearCuenta, useCuentas, useSaldos } from '../../data/hooks'
import type { Cuenta } from '../../data/types'
import { ETIQUETA_TIPO_CUENTA, colorPorPosicion } from '../../lib/catalogo'
import { useFmt } from '../../components/Discreto'

type Edicion = { modo: 'nueva' } | { modo: 'editar'; cuenta: Cuenta } | null

export function AjustesCuentas() {
  const fmt = useFmt()
  const cuentas = useCuentas()
  const saldos = useSaldos()
  const crear = useCrearCuenta()
  const actualizar = useActualizarCuenta()
  const [edicion, setEdicion] = useState<Edicion>(null)

  const lista = cuentas.data ?? []
  const activas = lista.filter((c) => !c.archivada)
  const archivadas = lista.filter((c) => c.archivada)
  const saldoDe = (id: string) => saldos.data?.find((s) => s.cuentaId === id)?.saldo
  const siguienteOrden = lista.reduce((max, c) => Math.max(max, c.orden + 1), 0)

  const fila = (c: Cuenta) => {
    const saldo = saldoDe(c.id)
    return (
      <li key={c.id}>
        <button className="fila" onClick={() => setEdicion({ modo: 'editar', cuenta: c })}>
          <span className="punto" style={{ background: c.color }} aria-hidden="true" />
          <span className="fila-texto">
            <span>{c.nombre}</span>
            <span className="secundario pequeno">{ETIQUETA_TIPO_CUENTA[c.tipo]}</span>
          </span>
          <span className="cifra">{saldo === undefined ? '' : fmt(saldo)}</span>
        </button>
      </li>
    )
  }

  return (
    <section className="pantalla ancho">
      <Cabecera titulo="Cuentas" />
      {cuentas.isPending ? (
        <p className="secundario">Cargando…</p>
      ) : (
        <>
          <ul className="lista">{activas.map(fila)}</ul>
          {activas.length === 0 && <p className="secundario">No tienes cuentas activas.</p>}
          <button className="primario" onClick={() => setEdicion({ modo: 'nueva' })}>
            Nueva cuenta
          </button>
          {archivadas.length > 0 && (
            <>
              <h2 className="subtitulo">Archivadas</h2>
              <ul className="lista tenue">{archivadas.map(fila)}</ul>
            </>
          )}
        </>
      )}

      {edicion && (
        <Hoja titulo={edicion.modo === 'nueva' ? 'Nueva cuenta' : 'Editar cuenta'} onCerrar={() => setEdicion(null)}>
          <FormCuenta
            inicial={edicion.modo === 'editar' ? edicion.cuenta : undefined}
            colorPorDefecto={colorPorPosicion(lista.length)}
            orden={siguienteOrden}
            etiquetaGuardar={edicion.modo === 'nueva' ? 'Crear cuenta' : 'Guardar cambios'}
            onGuardar={async (datos) => {
              if (edicion.modo === 'nueva') await crear.mutateAsync(datos)
              else await actualizar.mutateAsync({ id: edicion.cuenta.id, cambios: datos })
              setEdicion(null)
            }}
          />
        </Hoja>
      )}
    </section>
  )
}
