import { conBom, movimientosACsv } from '../lib/csv'
import { hoyISO } from '../lib/meses'
import type { Categoria, Cuenta, Fijo, Grupo, Movimiento } from '../data/types'

/**
 * Entrega el CSV al usuario. En iPhone se comparte con la Web Share API para guardarlo en Archivos;
 * si el navegador no puede compartir archivos, se descarga de la forma normal.
 * Devuelve false si la persona cancela el menú de compartir.
 */
export async function entregarCsv(
  movs: Movimiento[],
  cuentas: Cuenta[],
  categorias: Categoria[],
  fijos: Fijo[],
  grupos: Grupo[],
): Promise<boolean> {
  const nombre = `txobank-${hoyISO()}.csv`
  const contenido = conBom(movimientosACsv(movs, cuentas, categorias, fijos, grupos))
  const archivo = new File([contenido], nombre, { type: 'text/csv;charset=utf-8' })

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: 'TxoBank' })
      return true
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false
      // Si compartir falla por otra razón, se cae a la descarga normal.
    }
  }

  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}
