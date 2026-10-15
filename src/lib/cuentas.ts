// Cierre de cuentas: al archivar una cuenta con saldo, su saldo se deja a 0 (SPEC.md, sección 8).
import type { Fecha, Hora, NuevoMovimiento } from '../data/types'

/**
 * Traspaso que deja a 0 una cuenta: si tiene saldo positivo, sale de ella hacia `destinoId`;
 * si es negativo (una tarjeta con deuda), entra en ella desde `destinoId`.
 */
export function traspasoDeCierre(
  cuenta: { id: string; nombre: string },
  saldo: number,
  destinoId: string,
  fecha: Fecha,
  hora: Hora,
): NuevoMovimiento {
  const sale = saldo > 0
  return {
    tipo: 'traspaso',
    importe: Math.abs(saldo),
    fecha,
    hora,
    cuentaId: sale ? cuenta.id : destinoId,
    cuentaDestinoId: sale ? destinoId : cuenta.id,
    categoriaId: null,
    nota: `Cierre de ${cuenta.nombre}`,
    descripcion: '',
    fijoId: null,
    fijoMes: null,
    mesImputado: null,
    grupoId: null,
  }
}

/** Saldo inicial con el que una cuenta queda a 0 sin apuntar ningún movimiento. */
export const saldoInicialParaCerrar = (saldoInicial: number, saldo: number) => saldoInicial - saldo
