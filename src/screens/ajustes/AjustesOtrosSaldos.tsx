import { useState } from 'react'
import { Cabecera } from '../../components/Cabecera'
import { useFmt } from '../../components/Discreto'
import { FormOtroSaldo } from '../../components/FormOtroSaldo'
import { Hoja } from '../../components/Hoja'
import { HojaOtroSaldo } from '../../components/HojaOtroSaldo'
import { Icono, IconoCategoria } from '../../components/Icono'
import { useAccionesOtrosSaldos, useHistorialSaldos, useOtrosSaldos } from '../../data/consultas'
import { mensajeError } from '../../data/hooks'
import type { OtroSaldo } from '../../data/types'
import { colorPorPosicion } from '../../lib/catalogo'
import { fechaHoraCorta, saldosActuales } from '../../lib/patrimonio'
import type { SaldoActual } from '../../lib/patrimonio'

type Edicion = { modo: 'nuevo' } | { modo: 'editar'; id: string } | { modo: 'detalle'; id: string } | null

/** Otros saldos: dinero fuera de las cuentas. Solo se actualiza su saldo; cada actualización queda en el historial. */
export function AjustesOtrosSaldos() {
  const fmt = useFmt()
  const otros = useOtrosSaldos()
  const historial = useHistorialSaldos().data ?? []
  const acciones = useAccionesOtrosSaldos()
  const [edicion, setEdicion] = useState<Edicion>(null)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [confirmarArchivo, setConfirmarArchivo] = useState(false)
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null)

  const lista = otros.data ?? []
  const actuales = saldosActuales(lista, historial)
  const activos = actuales.filter((s) => !s.otro.archivado)
  const archivados = actuales.filter((s) => s.otro.archivado)
  const total = activos.reduce((t, s) => t + s.saldo, 0)
  const siguienteOrden = lista.reduce((max, o) => Math.max(max, o.orden + 1), 0)
  // Se busca por id para que la hoja abierta refleje los cambios recién guardados.
  const elegido: OtroSaldo | undefined =
    edicion && edicion.modo !== 'nuevo' ? lista.find((o) => o.id === edicion.id) : undefined
  const saldoElegido = elegido ? (actuales.find((a) => a.otro.id === elegido.id)?.saldo ?? 0) : 0

  function cerrar() {
    setEdicion(null)
    setConfirmarBorrado(false)
    setConfirmarArchivo(false)
    setErrorBorrado(null)
  }

  /** Al archivar, el saldo pasa a 0 (queda apuntado en el historial) para que el patrimonio cuadre. */
  async function cambiarArchivo(o: OtroSaldo, saldoActual: number) {
    try {
      if (!o.archivado && saldoActual !== 0) await acciones.registrarSaldo(o.id, 0)
      await acciones.actualizar(o.id, { archivado: !o.archivado })
      cerrar()
    } catch (err) {
      setErrorBorrado(mensajeError(err))
    }
  }

  async function borrar(o: OtroSaldo) {
    try {
      await acciones.borrar(o.id)
      cerrar()
    } catch (err) {
      setErrorBorrado(mensajeError(err))
    }
  }

  const fila = ({ otro, saldo, fechaHora }: SaldoActual) => (
    <li key={otro.id}>
      <button className="fila" onClick={() => setEdicion({ modo: 'detalle', id: otro.id })}>
        <IconoCategoria color={otro.color}>{otro.icono ?? <Icono nombre="cartera" />}</IconoCategoria>
        <span className="fila-texto">
          <span>{otro.nombre}</span>
          <span className="secundario pequeno">
            {fechaHora ? `Actualizado el ${fechaHoraCorta(fechaHora)}` : 'Sin actualizar'}
          </span>
        </span>
        <span className={saldo < 0 ? 'cifra negativo-saldo' : 'cifra'}>{fmt(saldo)}</span>
      </button>
    </li>
  )

  return (
    <section className="pantalla ancho">
      <Cabecera titulo="Otros saldos" />
      {otros.isPending ? (
        <p className="secundario">Cargando…</p>
      ) : (
        <>
          <div className="tile otros-total">
            <span className="secundario pequeno">Total en otros saldos</span>
            <span className={total < 0 ? 'cifra negativo-saldo' : 'cifra'}>{fmt(total)}</span>
            <span className="secundario pequeno">Cuentan en tu patrimonio, no en el control del mes.</span>
          </div>
          {activos.length > 0 && <ul className="lista">{activos.map(fila)}</ul>}
          {lista.length === 0 && (
            <p className="vacio">
              Apunta aquí el dinero que tienes fuera de tus cuentas: Revolut, un fondo indexado, una hucha… Solo tendrás
              que actualizar su saldo de vez en cuando.
            </p>
          )}
          <button className="primario" onClick={() => setEdicion({ modo: 'nuevo' })}>
            Nuevo saldo
          </button>
          {archivados.length > 0 && (
            <>
              <h2 className="subtitulo">Archivados</h2>
              <ul className="lista tenue">{archivados.map(fila)}</ul>
            </>
          )}
        </>
      )}

      {edicion?.modo === 'nuevo' && (
        <Hoja titulo="Nuevo saldo" onCerrar={cerrar}>
          <FormOtroSaldo
            colorPorDefecto={colorPorPosicion(lista.length)}
            orden={siguienteOrden}
            onGuardar={async (datos, saldoInicial) => {
              const creado = await acciones.crear(datos)
              await acciones.registrarSaldo(creado.id, saldoInicial ?? 0)
              cerrar()
            }}
          />
        </Hoja>
      )}

      {edicion?.modo === 'detalle' && elegido && (
        <HojaOtroSaldo
          otro={elegido}
          historial={historial}
          onEditar={() => setEdicion({ modo: 'editar', id: elegido.id })}
          onCerrar={cerrar}
        />
      )}

      {edicion?.modo === 'editar' && elegido && (
        <Hoja titulo="Editar saldo" onCerrar={cerrar}>
          <FormOtroSaldo
            inicial={elegido}
            colorPorDefecto={elegido.color}
            orden={elegido.orden}
            onGuardar={async (datos) => {
              await acciones.actualizar(elegido.id, datos)
              setEdicion({ modo: 'detalle', id: elegido.id })
            }}
          />
          <div className="zona-borrar">
            <p className="secundario pequeno">
              Al archivarlo, su saldo pasa a 0 € y se conserva el historial. Eliminarlo borra también todo su historial.
            </p>
            {errorBorrado && (
              <p className="error" role="alert">
                {errorBorrado}
              </p>
            )}
            {confirmarArchivo ? (
              <div className="confirmar">
                <span>
                  «{elegido.nombre}» tiene {fmt(saldoElegido)}. Al archivarlo, su saldo pasará a 0 € (quedará apuntado en el
                  historial).
                </span>
                <button type="button" className="secundario-btn" onClick={() => setConfirmarArchivo(false)}>
                  Cancelar
                </button>
                <button type="button" className="primario" onClick={() => void cambiarArchivo(elegido, saldoElegido)}>
                  Archivar
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="secundario-btn"
                onClick={() =>
                  !elegido.archivado && saldoElegido !== 0
                    ? setConfirmarArchivo(true)
                    : void cambiarArchivo(elegido, saldoElegido)
                }
              >
                {elegido.archivado ? 'Desarchivar' : 'Archivar'}
              </button>
            )}
            {confirmarBorrado ? (
              <div className="confirmar">
                <span>¿Eliminar «{elegido.nombre}» y su historial?</span>
                <button type="button" className="secundario-btn" onClick={() => setConfirmarBorrado(false)}>
                  Cancelar
                </button>
                <button type="button" className="peligro" onClick={() => void borrar(elegido)}>
                  Eliminar
                </button>
              </div>
            ) : (
              <button type="button" className="secundario-btn borrar" onClick={() => setConfirmarBorrado(true)}>
                Eliminar
              </button>
            )}
          </div>
        </Hoja>
      )}
    </section>
  )
}
