import { lazy, Suspense, useEffect } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AvisosProvider } from '../components/Avisos'
import { MovimientoProvider, useHojaMovimiento } from '../components/ContextoMovimiento'
import { Icono } from '../components/Icono'
import { useMovimientos } from '../data/hooks'
import { hoyISO, sumarDias } from '../lib/meses'
import { Ajustes } from './ajustes/Ajustes'
import { AjustesAhorro } from './ajustes/AjustesAhorro'
import { AjustesCategorias } from './ajustes/AjustesCategorias'
import { AjustesCuentas } from './ajustes/AjustesCuentas'
import { AjustesEconomias } from './ajustes/AjustesEconomias'
import { AcercaDe } from './ajustes/AcercaDe'
import { AjustesFijos } from './ajustes/AjustesFijos'
import { AjustesGrupos } from './ajustes/AjustesGrupos'
import { AjustesOtrosSaldos } from './ajustes/AjustesOtrosSaldos'
import { AjustesSeguridad } from './ajustes/AjustesSeguridad'
import { FijosMes } from './FijosMes'
import { Inicio } from './Inicio'
import { Movimientos } from './Movimientos'
import { Presupuestos } from './Presupuestos'
import { Recomendaciones } from './Recomendaciones'
import { Revision } from './Revision'

// Los gráficos (Recharts) pesan bastante: se cargan solo al entrar en Estadísticas.
const Estadisticas = lazy(() => import('./Estadisticas'))
const CategoriaDetalle = lazy(() => import('./CategoriaDetalle'))

function NoEncontrado() {
  return (
    <section className="pantalla">
      <h1>No encontrado</h1>
      <p className="secundario">Esta pantalla no existe.</p>
    </section>
  )
}

function Estructura() {
  const hoja = useHojaMovimiento()
  const { pathname } = useLocation()
  // Cada pantalla empieza arriba del todo.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  // Se cargan ya los últimos 90 días para que la hoja de nuevo movimiento abra con frecuentes y sugerencias.
  const hoy = hoyISO()
  useMovimientos(sumarDias(hoy, -90), hoy)

  return (
    <div className="shell">
      <div className="contenido">
        <Suspense fallback={<p className="secundario">Cargando…</p>}>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/movimientos" element={<Movimientos />} />
            <Route path="/fijos" element={<FijosMes />} />
            <Route path="/presupuestos" element={<Presupuestos />} />
            <Route path="/recomendaciones" element={<Recomendaciones />} />
            <Route path="/revision/:mes" element={<Revision />} />
            <Route path="/estadisticas" element={<Estadisticas />} />
            <Route path="/estadisticas/categoria/:id" element={<CategoriaDetalle />} />
            <Route path="/ajustes" element={<Ajustes />} />
            <Route path="/ajustes/economias" element={<AjustesEconomias />} />
            <Route path="/ajustes/cuentas" element={<AjustesCuentas />} />
            <Route path="/ajustes/categorias" element={<AjustesCategorias />} />
            <Route path="/ajustes/fijos" element={<AjustesFijos />} />
            <Route path="/ajustes/ahorro" element={<AjustesAhorro />} />
            <Route path="/ajustes/grupos" element={<AjustesGrupos />} />
            <Route path="/ajustes/otros-saldos" element={<AjustesOtrosSaldos />} />
            <Route path="/ajustes/acerca-de" element={<AcercaDe />} />
            <Route path="/ajustes/seguridad" element={<AjustesSeguridad />} />
            <Route path="*" element={<NoEncontrado />} />
          </Routes>
        </Suspense>
      </div>
      <nav className="barra" aria-label="Principal">
        <NavLink to="/" end>
          <Icono nombre="inicio" />
          Inicio
        </NavLink>
        <NavLink to="/movimientos">
          <Icono nombre="movimientos" />
          Movimientos
        </NavLink>
        <button className="mas" aria-label="Nuevo movimiento" onClick={() => hoja.abrirNuevo()}>
          <Icono nombre="mas" />
        </button>
        <NavLink to="/estadisticas">
          <Icono nombre="estadisticas" />
          Estadísticas
        </NavLink>
        <NavLink to="/ajustes">
          <Icono nombre="ajustes" />
          Ajustes
        </NavLink>
      </nav>
    </div>
  )
}

export function Shell() {
  return (
    <AvisosProvider>
      <MovimientoProvider>
        <Estructura />
      </MovimientoProvider>
    </AvisosProvider>
  )
}
