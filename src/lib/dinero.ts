// Importes: siempre enteros en céntimos. Nada de decimales en coma flotante para guardar o sumar.

const formato = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  useGrouping: 'always',
})

/** 1250 → "12,50 €" */
export function formatEuros(centimos: number): string {
  return formato.format(centimos / 100)
}

/** Texto para rellenar un campo de importe: 1250 → "12,50", 1200 → "12". */
export function aTextoEditable(centimos: number): string {
  const abs = Math.abs(centimos)
  const euros = Math.trunc(abs / 100)
  const cent = abs % 100
  const signo = centimos < 0 ? '-' : ''
  return cent === 0 ? `${signo}${euros}` : `${signo}${euros},${String(cent).padStart(2, '0')}`
}

/**
 * Lee un importe escrito por una persona y devuelve céntimos, o null si no es válido.
 * Acepta coma o punto como decimal ("12,5", "12.5") y separadores de miles ("1.234,56").
 * Un único separador seguido de más de 2 dígitos no es válido (ambiguo).
 */
export function parseImporte(texto: string, opciones: { permitirNegativo?: boolean } = {}): number | null {
  let t = texto.replace(/[\s€]/g, '')
  let negativo = false
  if (t.startsWith('-')) {
    if (!opciones.permitirNegativo) return null
    negativo = true
    t = t.slice(1)
  }
  if (t === '' || !/^[\d.,]+$/.test(t)) return null

  const ultimo = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','))
  let entero = t
  let decimales = ''
  if (ultimo >= 0) {
    const sep = t[ultimo]
    const repeticiones = t.split(sep).length - 1
    const mezcla = t.includes('.') && t.includes(',')
    if (mezcla || repeticiones === 1) {
      entero = t.slice(0, ultimo)
      decimales = t.slice(ultimo + 1)
    }
  }

  if (/[.,]/.test(entero)) {
    if (!/^\d{1,3}([.,]\d{3})+$/.test(entero)) return null
    entero = entero.replace(/[.,]/g, '')
  } else if (!/^\d*$/.test(entero)) {
    return null
  }
  if (!/^\d{0,2}$/.test(decimales)) return null
  if (entero === '' && decimales === '') return null

  const valor = Number(entero || '0') * 100 + Number(decimales.padEnd(2, '0') || '0')
  if (!Number.isSafeInteger(valor)) return null
  return negativo ? -valor : valor
}
