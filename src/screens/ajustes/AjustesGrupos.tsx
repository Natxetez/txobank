import { useState } from 'react'
import { Cabecera } from '../../components/Cabecera'
import { useFmt } from '../../components/Discreto'
import { HojaGrupo } from '../../components/HojaGrupo'
import { Icono, IconoCategoria } from '../../components/Icono'
import { useGrupos } from '../../data/consultas'
import { mensajeError, useCategorias, useMovimientos } from '../../data/hooks'
import type { Grupo } from '../../data/types'
import { ordenarGrupos, resumenGrupos, textoEntradas } from '../../lib/grupos'
import { finDeMes, mesActual, nombreMes } from '../../lib/meses'

type Edicion = { modo: 'nuevo' } | { modo: 'editar'; grupo: Grupo } | null

/** Ajustes › Grupos de gastos: lista con el total de este mes, crear, editar, archivar y eliminar. */
export function AjustesGrupos() {
  const fmt = useFmt()
  const grupos = useGrupos()
  const categorias = useCategorias().data ?? []
  const mes = mesActual()
  const movs = useMovimientos(mes, finDeMes(mes)).data ?? []
  const [edicion, setEdicion] = useState<Edicion>(null)

  const todos = grupos.data ?? []
  const resumen = new Map(resumenGrupos(movs, todos, mes).map((r) => [r.grupo.id, r]))
  const activos = ordenarGrupos(todos.filter((g) => !g.archivado))
  const archivados = ordenarGrupos(todos.filter((g) => g.archivado))

  const fila = (g: Grupo) => {
    const cat = categorias.find((c) => c.id === g.categoriaId)
    const r = resumen.get(g.id)
    return (
      <li key={g.id}>
        <button className="fila" onClick={() => setEdicion({ modo: 'editar', grupo: g })}>
          <IconoCategoria color={cat?.color}>{cat?.icono ?? <Icono nombre="etiqueta" />}</IconoCategoria>
          <span className="fila-texto">
            <span>{g.nombre}</span>
            <span className="secundario pequeno">
              {[cat?.nombre ?? 'Sin categoría', r ? `${textoEntradas(r.numEntradas)} en ${nombreMes(mes)}` : `Sin entradas en ${nombreMes(mes)}`].join(' · ')}
            </span>
          </span>
          <span className="cifra">{fmt(r?.total ?? 0)}</span>
        </button>
      </li>
    )
  }

  return (
    <section className="pantalla ancho">
      <Cabecera titulo="Grupos de gastos" />
      <p className="secundario pequeno grupos-explica">
        Reúne gastos repetidos (cafés, taxis…) bajo un nombre y una categoría. Cada entrada es un gasto normal; el total
        del grupo se cuenta por meses y cada mes empieza de cero.
      </p>
      {grupos.isPending ? (
        <p className="secundario">Cargando…</p>
      ) : grupos.isError ? (
        <p className="error" role="alert">
          {mensajeError(grupos.error)}
        </p>
      ) : (
        <>
          {activos.length > 0 ? (
            <ul className="lista">{activos.map(fila)}</ul>
          ) : (
            <p className="vacio">Aún no tienes grupos. Crea uno, por ejemplo «Cafés y pintxos».</p>
          )}
          {archivados.length > 0 && (
            <>
              <h2 className="subtitulo">Archivados</h2>
              <ul className="lista tenue">{archivados.map(fila)}</ul>
            </>
          )}
          <button className="primario" onClick={() => setEdicion({ modo: 'nuevo' })}>
            Nuevo grupo
          </button>
        </>
      )}

      {edicion && (
        <HojaGrupo grupo={edicion.modo === 'editar' ? edicion.grupo : undefined} onCerrar={() => setEdicion(null)} />
      )}
    </section>
  )
}
