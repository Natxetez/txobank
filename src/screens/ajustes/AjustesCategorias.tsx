import { useState } from 'react'
import { Cabecera } from '../../components/Cabecera'
import { FormCategoria } from '../../components/FormCategoria'
import { Hoja } from '../../components/Hoja'
import {
  mensajeError,
  useActualizarCategoria,
  useCategorias,
  useCrearCategoria,
  useReordenarCategorias,
} from '../../data/hooks'
import type { Categoria, TipoCategoria } from '../../data/types'
import { colorPorPosicion } from '../../lib/catalogo'

type Edicion = { modo: 'nueva' } | { modo: 'editar'; categoria: Categoria } | null

export function AjustesCategorias() {
  const categorias = useCategorias()
  const crear = useCrearCategoria()
  const actualizar = useActualizarCategoria()
  const reordenar = useReordenarCategorias()
  const [tipo, setTipo] = useState<TipoCategoria>('gasto')
  const [edicion, setEdicion] = useState<Edicion>(null)

  const delTipo = (categorias.data ?? []).filter((c) => c.tipo === tipo)
  const activas = delTipo.filter((c) => !c.archivada)
  const archivadas = delTipo.filter((c) => c.archivada)
  const siguienteOrden = delTipo.reduce((max, c) => Math.max(max, c.orden + 1), 0)

  function mover(indice: number, delta: -1 | 1) {
    const ids = activas.map((c) => c.id)
    const destino = indice + delta
    if (destino < 0 || destino >= ids.length) return
    ;[ids[indice], ids[destino]] = [ids[destino], ids[indice]]
    reordenar.mutate(ids)
  }

  const contenido = (c: Categoria) => (
    <>
      <span className="punto" style={{ background: c.color }} aria-hidden="true" />
      <span className="fila-texto">
        {c.icono ? `${c.icono} ` : ''}
        {c.nombre}
      </span>
    </>
  )

  return (
    <section className="pantalla ancho">
      <Cabecera titulo="Categorías" />
      <div className="pestanas" role="tablist">
        {(['gasto', 'ingreso'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tipo === t}
            className={tipo === t ? 'activa' : ''}
            onClick={() => setTipo(t)}
          >
            {t === 'gasto' ? 'Gasto' : 'Ingreso'}
          </button>
        ))}
      </div>

      {categorias.isPending ? (
        <p className="secundario">Cargando…</p>
      ) : (
        <>
          <ul className="lista">
            {activas.map((c, i) => (
              <li key={c.id} className="fila-doble">
                <button className="fila" onClick={() => setEdicion({ modo: 'editar', categoria: c })}>
                  {contenido(c)}
                </button>
                <button
                  className="mini"
                  aria-label={`Subir ${c.nombre}`}
                  disabled={i === 0 || reordenar.isPending}
                  onClick={() => mover(i, -1)}
                >
                  ▲
                </button>
                <button
                  className="mini"
                  aria-label={`Bajar ${c.nombre}`}
                  disabled={i === activas.length - 1 || reordenar.isPending}
                  onClick={() => mover(i, 1)}
                >
                  ▼
                </button>
              </li>
            ))}
          </ul>
          {reordenar.isError && (
            <p className="error" role="alert">
              {mensajeError(reordenar.error)}
            </p>
          )}
          <button className="primario" onClick={() => setEdicion({ modo: 'nueva' })}>
            Nueva categoría
          </button>
          {archivadas.length > 0 && (
            <>
              <h2 className="subtitulo">Archivadas</h2>
              <ul className="lista tenue">
                {archivadas.map((c) => (
                  <li key={c.id}>
                    <button className="fila" onClick={() => setEdicion({ modo: 'editar', categoria: c })}>
                      {contenido(c)}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {edicion && (
        <Hoja
          titulo={edicion.modo === 'nueva' ? 'Nueva categoría' : 'Editar categoría'}
          onCerrar={() => setEdicion(null)}
        >
          <FormCategoria
            tipo={tipo}
            inicial={edicion.modo === 'editar' ? edicion.categoria : undefined}
            colorPorDefecto={colorPorPosicion(delTipo.length)}
            orden={siguienteOrden}
            onGuardar={async (datos) => {
              if (edicion.modo === 'nueva') await crear.mutateAsync(datos)
              else await actualizar.mutateAsync({ id: edicion.categoria.id, cambios: datos })
              setEdicion(null)
            }}
          />
        </Hoja>
      )}
    </section>
  )
}
