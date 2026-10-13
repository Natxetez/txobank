// Exportación a CSV (SPEC.md, sección 14): separador ";", decimales con coma, UTF-8 con BOM.
import type { Categoria, Cuenta, Fijo, Movimiento } from '../data/types'

export const CABECERA_CSV = ['fecha', 'tipo', 'importe', 'cuenta', 'cuenta_destino', 'categoria', 'concepto', 'descripcion', 'fijo', 'cuenta_para_mes']

/** 1250 → "12,50" (siempre con dos decimales, sin símbolo). */
export function importeCsv(centimos: number): string {
  const abs = Math.abs(centimos)
  const texto = `${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}`
  return centimos < 0 ? `-${texto}` : texto
}

/** Entrecomilla los campos con `;`, comillas o saltos de línea. */
export function campoCsv(valor: string): string {
  return /[;"\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor
}

export function movimientosACsv(
  movs: Movimiento[],
  cuentas: Cuenta[],
  categorias: Categoria[],
  fijos: Fijo[],
): string {
  const cuenta = (id: string | null) => (id ? (cuentas.find((c) => c.id === id)?.nombre ?? '') : '')
  const categoria = (id: string | null) => (id ? (categorias.find((c) => c.id === id)?.nombre ?? '') : '')
  const fijo = (id: string | null) => (id ? (fijos.find((f) => f.id === id)?.nombre ?? '') : '')

  const ordenados = [...movs].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
  const filas = ordenados.map((m) =>
    [
      m.fecha,
      m.tipo,
      importeCsv(m.importe),
      cuenta(m.cuentaId),
      cuenta(m.cuentaDestinoId),
      categoria(m.categoriaId),
      m.nota,
      m.descripcion,
      fijo(m.fijoId),
      m.mesImputado ? m.mesImputado.slice(0, 7) : '',
    ]
      .map(campoCsv)
      .join(';'),
  )
  return [CABECERA_CSV.join(';'), ...filas].join('\r\n') + '\r\n'
}

/** Contenido listo para guardar: con BOM para que Excel y Numbers abran bien los acentos. */
export const conBom = (csv: string) => '﻿' + csv
