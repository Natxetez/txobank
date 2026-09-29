// Umbrales de las recomendaciones (SPEC.md, sección 11). Todo se ajusta aquí.
export const CONFIG_RECOMENDACIONES = {
  /** Máximo de recomendaciones visibles a la vez. */
  maxVisibles: 5,
  /** Las reglas que comparan con la media necesitan al menos estos meses completos de datos. */
  mesesMinimosParaMedia: 2,
  /** Proyección de fin de mes: a partir de este día del mes. */
  diaMinimoProyeccion: 7,
  /** Sin límite, se avisa si la proyección supera la media de 3 meses en más de esta fracción. */
  margenSobreMedia: 0.1,
  /** Ritmo diario bajo: el disponible por día cae por debajo de esta fracción del ritmo previsto. */
  fraccionRitmoBajo: 0.5,
  /** Categoría disparada: gasto por encima de esta fracción de su media y con al menos esta diferencia. */
  categoriaDisparadaFraccion: 1.3,
  categoriaDisparadaDiferencia: 3000,
  /** Sugerir presupuesto: gasto medio mensual mínimo de la categoría (céntimos) y máximo de sugerencias a la vez. */
  sugerirPresupuestoMinimo: 10000,
  sugerirPresupuestoMax: 2,
  /** Gastos hormiga: importe máximo de un gasto pequeño y número mínimo en el mes por categoría. */
  hormigaImporteMaximo: 500,
  hormigaMinimoGastos: 10,
  /** Fijo más caro: sobre la media de sus últimos pagos, con al menos este número de pagos previos. */
  fijoMasCaroMargen: 0.1,
  fijoMasCaroPagosMedia: 3,
  fijoMasCaroPagosMinimos: 2,
  /** Suscripciones: nombre de la categoría y días del primer mes del trimestre en que se muestra. */
  suscripcionesCategoria: 'suscripciones',
  suscripcionesDiasVisible: 7,
  /** Peso de los fijos: fracción de los ingresos medios a partir de la cual se avisa. */
  pesoFijosFraccion: 0.5,
  /** Gasto inusual: múltiplo de la mediana de su categoría, gastos previos necesarios y máximo de avisos. */
  gastoInusualMultiplo: 3,
  gastoInusualGastosPrevios: 5,
  gastoInusualMax: 2,
  /** Solo se avisa de gastos de los últimos días, para que sea una novedad y no un repaso del mes. */
  gastoInusualDias: 7,
  /** Logros: días sin gasto para la racha y meses seguidos ahorrando. */
  rachaMinimaDias: 3,
  mesesAhorrandoMinimos: 3,
}

export type ConfigRecomendaciones = typeof CONFIG_RECOMENDACIONES
