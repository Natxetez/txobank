// Recomendaciones automáticas (SPEC.md, sección 11): reglas puras sobre mis datos.
import type { Ajustes, Categoria, Fecha, Fijo, FijoOmitido, Mes, Movimiento, Presupuesto } from '../../data/types'
import { calcularControl, resumenMes } from '../control'
import { costeAnual, costeMensual } from '../fijos'
import { diasDelMes, diaDeFecha, mesDeFecha, nombreMes, sumarDias, sumarMeses } from '../meses'
import { mediaMensual, presupuestoVigente, redondearDiezEuros } from '../presupuestos'
import { rachaSinGasto, serieRitmo } from '../estadisticas'
import { normalizarConcepto } from '../movimientos'
import { CONFIG_RECOMENDACIONES } from './config'
import type { ConfigRecomendaciones } from './config'

export type TipoRecomendacion = 'aviso' | 'sugerencia' | 'logro'

export type AccionRecomendacion =
  | { tipo: 'ver-movimientos'; mes: Mes; categoriaId?: string }
  | { tipo: 'crear-presupuesto'; categoriaId: string; importe: number }
  | { tipo: 'revisar-fijos' }
  | { tipo: 'ver-presupuestos' }

export interface Recomendacion {
  /** Estable dentro del mes: sirve para descartarla hasta el mes siguiente. */
  id: string
  tipo: TipoRecomendacion
  titulo: string
  texto: string
  accion?: AccionRecomendacion
}

export interface ContextoRecomendaciones {
  hoy: Fecha
  /** Todos los movimientos (incluidos los pagos de fijos). */
  movimientos: Movimiento[]
  categorias: Categoria[]
  presupuestos: Presupuesto[]
  ajustes: Ajustes
  fijos: Fijo[]
  omitidos: FijoOmitido[]
}

export interface ResultadoRecomendaciones {
  /** Ordenadas: avisos, luego sugerencias, luego logros. Sin recortar: la pantalla decide cuántas mostrar. */
  recomendaciones: Recomendacion[]
  /** true si aún no hay meses suficientes para las reglas que comparan con la media. */
  faltanDatos: boolean
}

type Formato = (centimos: number) => string

const ORDEN: Record<TipoRecomendacion, number> = { aviso: 0, sugerencia: 1, logro: 2 }

const pct = (fraccion: number) => Math.round(fraccion * 100)

function mediana(valores: number[]): number {
  const orden = [...valores].sort((a, b) => a - b)
  const mitad = Math.floor(orden.length / 2)
  return orden.length % 2 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2
}

/** Meses completos anteriores al actual, contando desde el mes del primer movimiento. */
export function mesesCompletos(movs: Movimiento[], mesHoy: Mes): number {
  if (movs.length === 0) return 0
  const primero = movs.reduce((a, m) => (m.fecha < a ? m.fecha : a), movs[0].fecha)
  const inicio = mesDeFecha(primero)
  let n = 0
  for (let m = inicio; m < mesHoy; m = sumarMeses(m, 1)) n += 1
  return n
}

export function generarRecomendaciones(
  ctx: ContextoRecomendaciones,
  fmt: Formato,
  cfg: ConfigRecomendaciones = CONFIG_RECOMENDACIONES,
): ResultadoRecomendaciones {
  const { hoy, movimientos, categorias, presupuestos, ajustes, fijos } = ctx
  const mes = mesDeFecha(hoy)
  const diaHoy = diaDeFecha(hoy)
  const diasMes = diasDelMes(mes)
  const restantes = diasMes - diaHoy
  const completos = mesesCompletos(movimientos, mes)
  const hayMedia = completos >= cfg.mesesMinimosParaMedia
  const media = hayMedia ? mediaMensual(movimientos, mes) : null

  const pagos = movimientos.filter((m) => m.fijoId)
  const control = calcularControl({ mes, hoy, movimientos, presupuestos, ajustes, fijos, pagos, omitidos: ctx.omitidos })
  const ritmo = serieRitmo(movimientos, mes, hoy, control.fijosGastoPendiente)
  const nombreCat = (id: string) => categorias.find((c) => c.id === id)?.nombre ?? 'Sin categoría'
  const categoriasGasto = categorias.filter((c) => c.tipo === 'gasto' && !c.archivada)
  const delMes = movimientos.filter((m) => mesDeFecha(m.fecha) === mes)

  const res: Recomendacion[] = []
  const anadir = (r: Omit<Recomendacion, 'id'> & { clave: string }) => {
    const { clave, ...resto } = r
    res.push({ id: `${clave}:${mes}`, ...resto })
  }

  // 1. Proyección de fin de mes
  if (diaHoy >= cfg.diaMinimoProyeccion) {
    if (control.limite) {
      const exceso = ritmo.proyectadoFinMes - control.limite.valor
      if (exceso > 0) {
        anadir({
          clave: 'proyeccion',
          tipo: 'aviso',
          titulo: 'Vas a pasarte del límite',
          texto: `A este ritmo terminarás el mes ${fmt(Math.round(exceso))} por encima de tu límite.`,
          accion: { tipo: 'ver-movimientos', mes },
        })
      }
    } else if (media && media.total > 0 && ritmo.proyectadoFinMes > media.total * (1 + cfg.margenSobreMedia)) {
      anadir({
        clave: 'proyeccion',
        tipo: 'aviso',
        titulo: 'Gastas más que de costumbre',
        texto: `A este ritmo terminarás el mes con ${fmt(Math.round(ritmo.proyectadoFinMes))}, un ${pct(ritmo.proyectadoFinMes / media.total - 1)} % más que tu media de 3 meses.`,
        accion: { tipo: 'ver-movimientos', mes },
      })
    }
  }

  // 2. Ritmo diario bajo
  if (
    control.limite &&
    control.disponible !== null &&
    control.disponible >= 0 &&
    control.disponiblePorDia !== null &&
    control.ritmoPrevisto !== null &&
    control.ritmoPrevisto > 0 &&
    control.disponiblePorDia < control.ritmoPrevisto * cfg.fraccionRitmoBajo
  ) {
    anadir({
      clave: 'ritmo-bajo',
      tipo: 'aviso',
      titulo: 'Te queda poco por día',
      texto: `Para llegar a fin de mes te quedan ${fmt(Math.round(control.disponiblePorDia))} al día; tu ritmo previsto era ${fmt(Math.round(control.ritmoPrevisto))}.`,
    })
  }

  // 3. Presupuesto en riesgo (los fijos ya pagados o pendientes no se proyectan de forma lineal)
  if (diaHoy >= cfg.diaMinimoProyeccion) {
    for (const cat of categoriasGasto) {
      const presupuesto = presupuestoVigente(presupuestos, mes, cat.id).importe
      const gastado = control.resumen.porCategoria[cat.id] ?? 0
      if (presupuesto === null || gastado <= 0) continue
      const fijoPagado = delMes.filter((m) => m.tipo === 'gasto' && m.fijoId && m.categoriaId === cat.id).reduce((t, m) => t + m.importe, 0)
      const fijoPendiente = control.fijosMes
        .filter((i) => i.fijo.tipo === 'gasto' && i.fijo.categoriaId === cat.id && (i.estado === 'pendiente' || i.estado === 'esperado'))
        .reduce((t, i) => t + i.fijo.importe, 0)
      const proyectado = fijoPagado + fijoPendiente + ((gastado - fijoPagado) / diaHoy) * diasMes
      if (proyectado > presupuesto) {
        anadir({
          clave: `presupuesto-riesgo:${cat.id}`,
          tipo: 'aviso',
          titulo: `${cat.nombre}: presupuesto en riesgo`,
          texto: `${cat.nombre}: llevas ${fmt(gastado)} de ${fmt(presupuesto)} y quedan ${restantes} ${restantes === 1 ? 'día' : 'días'}.`,
          accion: { tipo: 'ver-movimientos', mes, categoriaId: cat.id },
        })
      }
    }
  }

  // 4. Ahorro en riesgo
  if (control.objetivoAhorro > 0 && control.ingresosPrevistos > 0 && diaHoy >= cfg.diaMinimoProyeccion) {
    const proyectado = control.ingresosPrevistos - ritmo.proyectadoFinMes
    if (proyectado < control.objetivoAhorro) {
      anadir({
        clave: 'ahorro-riesgo',
        tipo: 'aviso',
        titulo: 'Tu objetivo de ahorro está en riesgo',
        texto: `Si sigues así, ahorrarás ${fmt(Math.max(0, Math.round(proyectado)))} de los ${fmt(control.objetivoAhorro)} previstos.`,
      })
    }
  }

  // 5. Categoría disparada
  if (media) {
    for (const cat of categoriasGasto) {
      const actual = control.resumen.porCategoria[cat.id] ?? 0
      const habitual = media.porCategoria[cat.id] ?? 0
      if (habitual > 0 && actual > habitual * cfg.categoriaDisparadaFraccion && actual - habitual >= cfg.categoriaDisparadaDiferencia) {
        anadir({
          clave: `categoria-disparada:${cat.id}`,
          tipo: 'aviso',
          titulo: `${cat.nombre} se dispara`,
          texto: `Este mes gastas un ${pct(actual / habitual - 1)} % más en ${cat.nombre} que de costumbre.`,
          accion: { tipo: 'ver-movimientos', mes, categoriaId: cat.id },
        })
      }
    }
  }

  // 8. Fijo más caro (al pagar un fijo por encima de la media de sus últimos pagos)
  for (const pago of delMes.filter((m) => m.tipo === 'gasto' && m.fijoId && m.fijoMes === mes)) {
    const previos = pagos
      .filter((p) => p.fijoId === pago.fijoId && p.tipo === 'gasto' && p.fijoMes !== null && p.fijoMes < mes)
      .sort((a, b) => (b.fijoMes! < a.fijoMes! ? -1 : 1))
      .slice(0, cfg.fijoMasCaroPagosMedia)
    if (previos.length < cfg.fijoMasCaroPagosMinimos) continue
    const mediaFijo = previos.reduce((t, p) => t + p.importe, 0) / previos.length
    if (pago.importe > mediaFijo * (1 + cfg.fijoMasCaroMargen)) {
      const nombre = fijos.find((f) => f.id === pago.fijoId)?.nombre ?? pago.nota
      anadir({
        clave: `fijo-caro:${pago.fijoId}`,
        tipo: 'aviso',
        titulo: `${nombre} sube`,
        texto: `El pago de «${nombre}» de este mes (${fmt(pago.importe)}) es un ${pct(pago.importe / mediaFijo - 1)} % más caro que tu media.`,
        accion: { tipo: 'revisar-fijos' },
      })
    }
  }

  // 11. Gasto inusual
  const inusuales = delMes
    .filter((m) => m.tipo === 'gasto' && !m.fijoId && m.categoriaId && m.fecha >= sumarDias(hoy, -cfg.gastoInusualDias) && m.fecha <= hoy)
    .map((m) => {
      const previos = movimientos.filter(
        (o) => o.tipo === 'gasto' && !o.fijoId && o.categoriaId === m.categoriaId && o.fecha < m.fecha,
      )
      return { m, previos }
    })
    .filter(({ previos }) => previos.length >= cfg.gastoInusualGastosPrevios)
    .filter(({ m, previos }) => m.importe > mediana(previos.map((p) => p.importe)) * cfg.gastoInusualMultiplo)
    .sort((a, b) => b.m.importe - a.m.importe)
    .slice(0, cfg.gastoInusualMax)
  for (const { m } of inusuales) {
    anadir({
      clave: `gasto-inusual:${m.id}`,
      tipo: 'aviso',
      titulo: 'Un gasto fuera de lo normal',
      texto: `El gasto de ${fmt(m.importe)} en ${nombreCat(m.categoriaId!)} del día ${diaDeFecha(m.fecha)} es mucho mayor de lo habitual.`,
      accion: { tipo: 'ver-movimientos', mes, categoriaId: m.categoriaId! },
    })
  }

  // 6. Sugerir presupuesto
  if (media) {
    const candidatas = categoriasGasto
      .filter((c) => presupuestoVigente(presupuestos, mes, c.id).importe === null && (media.porCategoria[c.id] ?? 0) > cfg.sugerirPresupuestoMinimo)
      .sort((a, b) => (media.porCategoria[b.id] ?? 0) - (media.porCategoria[a.id] ?? 0))
      .slice(0, cfg.sugerirPresupuestoMax)
    for (const cat of candidatas) {
      const habitual = media.porCategoria[cat.id]
      const sugerido = redondearDiezEuros(habitual)
      anadir({
        clave: `sugerir-presupuesto:${cat.id}`,
        tipo: 'sugerencia',
        titulo: `Un presupuesto para ${cat.nombre}`,
        texto: `Sueles gastar ${fmt(Math.round(habitual))} al mes en ${cat.nombre}. ¿Le pones un presupuesto de ${fmt(sugerido)}?`,
        accion: { tipo: 'crear-presupuesto', categoriaId: cat.id, importe: sugerido },
      })
    }
  }

  // 7. Gastos hormiga
  for (const cat of categoriasGasto) {
    const pequenos = delMes.filter(
      (m) => m.tipo === 'gasto' && !m.fijoId && m.categoriaId === cat.id && m.importe < cfg.hormigaImporteMaximo,
    )
    if (pequenos.length >= cfg.hormigaMinimoGastos) {
      anadir({
        clave: `hormiga:${cat.id}`,
        tipo: 'sugerencia',
        titulo: 'Gastos pequeños que suman',
        texto: `${pequenos.length} gastos pequeños en ${cat.nombre} suman ${fmt(pequenos.reduce((t, m) => t + m.importe, 0))}.`,
        accion: { tipo: 'ver-movimientos', mes, categoriaId: cat.id },
      })
    }
  }

  // 9. Suscripciones (al empezar cada trimestre)
  const mesTrimestre = [1, 4, 7, 10].includes(Number(mes.slice(5, 7)))
  if (mesTrimestre && diaHoy <= cfg.suscripcionesDiasVisible) {
    const idsSuscripciones = categorias.filter((c) => normalizarConcepto(c.nombre) === cfg.suscripcionesCategoria).map((c) => c.id)
    const suscripciones = fijos.filter((f) => f.activo && f.tipo === 'gasto' && f.categoriaId && idsSuscripciones.includes(f.categoriaId))
    if (suscripciones.length > 0) {
      anadir({
        clave: 'suscripciones',
        tipo: 'sugerencia',
        titulo: 'Repasa tus suscripciones',
        texto: `Tus suscripciones suman ${fmt(suscripciones.reduce((t, f) => t + costeAnual(f), 0))} al año. ¿Las usas todas?`,
        accion: { tipo: 'revisar-fijos' },
      })
    }
  }

  // 10. Peso de los fijos
  if (hayMedia) {
    const previos = [1, 2, 3].map((i) => sumarMeses(mes, -i)).filter((m) => m >= mesDeFecha(movimientos.reduce((a, x) => (x.fecha < a ? x.fecha : a), movimientos[0].fecha)))
    const ingresosMedios = previos.length > 0 ? previos.reduce((t, m) => t + resumenMes(movimientos, m).ingresos, 0) / previos.length : 0
    const fijosMensual = fijos.filter((f) => f.activo && f.tipo === 'gasto').reduce((t, f) => t + costeMensual(f), 0)
    if (ingresosMedios > 0 && fijosMensual > ingresosMedios * cfg.pesoFijosFraccion) {
      anadir({
        clave: 'peso-fijos',
        tipo: 'sugerencia',
        titulo: 'Mucho de tu dinero va a fijos',
        texto: `Tus gastos fijos son el ${pct(fijosMensual / ingresosMedios)} % de tus ingresos.`,
        accion: { tipo: 'revisar-fijos' },
      })
    }
  }

  // 12. Logros
  const racha = rachaSinGasto(movimientos, hoy)
  if (racha >= cfg.rachaMinimaDias) {
    anadir({ clave: 'racha', tipo: 'logro', titulo: 'Buena racha', texto: `Llevas ${racha} días seguidos sin gasto variable.` })
  }
  if (completos >= 1) {
    const anterior = sumarMeses(mes, -1)
    const r = resumenMes(movimientos, anterior)
    const ahorro = r.ingresos - r.gastoNeto
    const objetivo =
      ajustes.ahorroTipo === 'importe' ? ajustes.ahorroValor : ajustes.ahorroTipo === 'porcentaje' && ajustes.ahorroValor ? Math.round((r.ingresos * ajustes.ahorroValor) / 100) : null
    if (objetivo !== null && objetivo > 0 && r.ingresos > 0 && ahorro >= objetivo) {
      anadir({
        clave: 'objetivo-cumplido',
        tipo: 'logro',
        titulo: 'Objetivo de ahorro cumplido',
        texto: `En ${nombreMes(anterior)} ahorraste ${fmt(ahorro)}, por encima de tu objetivo de ${fmt(objetivo)}.`,
      })
    }
    let seguidos = 0
    for (let i = 1; i <= completos; i++) {
      const rm = resumenMes(movimientos, sumarMeses(mes, -i))
      if (rm.ingresos - rm.gastoNeto > 0) seguidos += 1
      else break
    }
    if (seguidos >= cfg.mesesAhorrandoMinimos && r.ingresos > 0) {
      anadir({
        clave: 'meses-ahorrando',
        tipo: 'logro',
        titulo: 'Ahorras mes tras mes',
        texto: `Llevas ${seguidos} meses seguidos ahorrando: el último, un ${pct(ahorro / r.ingresos)} % de tus ingresos.`,
      })
    }
  }

  return {
    recomendaciones: res.map((r, i) => ({ r, i })).sort((a, b) => ORDEN[a.r.tipo] - ORDEN[b.r.tipo] || a.i - b.i).map((x) => x.r),
    faltanDatos: !hayMedia,
  }
}
