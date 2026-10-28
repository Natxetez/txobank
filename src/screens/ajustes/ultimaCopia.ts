// Cuándo se descargó la última copia de seguridad en este dispositivo (solo para recordarlo).
import { haceCuanto } from '../../lib/patrimonio'

const CLAVE = 'txobank.ultimaCopia'
/** A partir de estos días se recuerda que conviene hacer otra. */
const DIAS_AVISO = 30

export function leerUltimaCopia(): string | null {
  try {
    return localStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

export function guardarUltimaCopia(fechaHora: string) {
  try {
    localStorage.setItem(CLAVE, fechaHora)
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
}

/** "Última: hace 3 días", con aviso si hace más de un mes, o "Aún no has hecho ninguna". */
export function textoUltimaCopia(ahora: Date = new Date()): string {
  const ultima = leerUltimaCopia()
  if (!ultima) return 'Aún no has descargado ninguna en este dispositivo'
  const dias = (ahora.getTime() - Date.parse(ultima)) / 86400000
  return `Última: ${haceCuanto(ultima, ahora)}${dias > DIAS_AVISO ? ' · conviene hacer otra' : ''}`
}
