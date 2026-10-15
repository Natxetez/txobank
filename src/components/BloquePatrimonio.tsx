import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHistorialSaldos, useOtrosSaldos } from '../data/consultas'
import { useCuentas, useSaldos } from '../data/hooks'
import { haceCuanto, saldosActuales } from '../lib/patrimonio'
import { useFmt } from './Discreto'
import { Icono, IconoCategoria } from './Icono'

/** Bloque "Patrimonio" de Inicio: cuentas + otros saldos activos; al tocarlo se despliega el detalle. */
export function BloquePatrimonio() {
  const fmt = useFmt()
  const cuentas = useCuentas().data ?? []
  const saldos = useSaldos().data ?? []
  const otros = useOtrosSaldos().data ?? []
  const historial = useHistorialSaldos().data ?? []
  const [abierto, setAbierto] = useState(false)

  const totalCuentas = saldos.reduce((t, s) => t + s.saldo, 0)
  const actuales = saldosActuales(
    otros.filter((o) => !o.archivado),
    historial,
  )
  const totalOtros = actuales.reduce((t, s) => t + s.saldo, 0)
  const ahora = new Date()

  return (
    <div className="bloque">
      <button className="fila saldo-total" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        <span>Patrimonio</span>
        <span className="cifra">
          {fmt(totalCuentas + totalOtros)} <Icono nombre={abierto ? 'arriba' : 'abajo'} className="chevron" />
        </span>
      </button>
      {abierto && (
        <>
          <div className="patrimonio-sub">
            <span>Cuentas</span>
            <span className="cifra">{fmt(totalCuentas)}</span>
          </div>
          <ul className="lista">
            {cuentas
              .filter((c) => !c.archivada)
              .map((c) => (
                <li key={c.id}>
                  <Link className="fila" to={`/movimientos?cuenta=${c.id}`}>
                    <span className="punto" style={{ background: c.color }} aria-hidden="true" />
                    <span className="fila-texto">{c.nombre}</span>
                    <span className="cifra">{fmt(saldos.find((s) => s.cuentaId === c.id)?.saldo ?? 0)}</span>
                  </Link>
                </li>
              ))}
          </ul>

          <div className="patrimonio-sub">
            <span>Otros saldos</span>
            <span className="cifra">{fmt(totalOtros)}</span>
          </div>
          <ul className="lista">
            {actuales.map(({ otro, saldo, fechaHora }) => (
              <li key={otro.id}>
                <Link className="fila" to="/ajustes/otros-saldos">
                  <IconoCategoria color={otro.color}>{otro.icono ?? <Icono nombre="cartera" />}</IconoCategoria>
                  <span className="fila-texto">
                    <span>{otro.nombre}</span>
                    <span className="secundario pequeno">
                      {fechaHora ? `Actualizado ${haceCuanto(fechaHora, ahora)}` : 'Sin actualizar'}
                    </span>
                  </span>
                  <span className={saldo < 0 ? 'cifra negativo-saldo' : 'cifra'}>{fmt(saldo)}</span>
                </Link>
              </li>
            ))}
            <li>
              <Link className="fila" to="/ajustes/otros-saldos">
                <span className="fila-texto">
                  <span className="enlace-texto">{actuales.length > 0 ? 'Gestionar otros saldos' : 'Añadir otros saldos'}</span>
                  {actuales.length === 0 && (
                    <span className="secundario pequeno">Dinero fuera de tus cuentas: Revolut, un fondo indexado…</span>
                  )}
                </span>
                <Icono nombre="derecha" className="chevron" />
              </Link>
            </li>
          </ul>
        </>
      )}
    </div>
  )
}
