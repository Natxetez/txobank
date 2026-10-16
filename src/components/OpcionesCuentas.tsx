import { useEconomia } from '../data/EconomiaContext'
import { useCuentasDeTodas } from '../data/consultas'
import { useCuentas } from '../data/hooks'
import type { Cuenta, DeEconomia } from '../data/types'

interface GrupoCuentas {
  nombre: string
  cuentas: Cuenta[]
}

/** Opciones de un `<select>` de cuentas: con varias economías, agrupadas por economía. */
export function OpcionesCuentas({ cuentas, porEconomia }: { cuentas: Cuenta[]; porEconomia: GrupoCuentas[] | null }) {
  const opcion = (c: Cuenta) => (
    <option key={c.id} value={c.id}>
      {c.nombre}
    </option>
  )
  if (!porEconomia) return <>{cuentas.map(opcion)}</>
  return (
    <>
      {porEconomia.map((g) => (
        <optgroup key={g.nombre} label={g.nombre}>
          {g.cuentas.map(opcion)}
        </optgroup>
      ))}
    </>
  )
}

/** Cuentas de todas las economías, para elegir el destino (u origen) de un traspaso entre economías. */
export function useCuentasConEconomia() {
  const { economias, activa } = useEconomia()
  const propias = useCuentas().data ?? []
  const deTodas = useCuentasDeTodas().data
  const todas: DeEconomia<Cuenta>[] = deTodas ?? propias.map((c) => ({ ...c, economiaId: activa.id }))
  const varias = economias.length > 1 && deTodas !== undefined

  return {
    todas,
    /** Economía de una cuenta (la activa si no se conoce). */
    economiaDe: (cuentaId: string) => todas.find((c) => c.id === cuentaId)?.economiaId ?? activa.id,
    nombreEconomia: (id: string) => economias.find((e) => e.id === id)?.nombre ?? '',
    /** Grupos para `OpcionesCuentas` (la activa primero), sin archivadas salvo `elegida`; null con una sola economía. */
    agrupar: (elegida: string): GrupoCuentas[] | null =>
      varias
        ? [...economias]
            .sort((a, b) => (a.id === activa.id ? -1 : b.id === activa.id ? 1 : a.orden - b.orden))
            .map((e) => ({
              nombre: e.nombre,
              cuentas: todas.filter((c) => c.economiaId === e.id && (!c.archivada || c.id === elegida)),
            }))
            .filter((g) => g.cuentas.length > 0)
        : null,
  }
}
