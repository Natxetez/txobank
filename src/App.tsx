import { useSesion } from './data/SesionContext'
import { Login } from './screens/Login'
import { Arranque } from './screens/Arranque'

export function App() {
  const sesion = useSesion()
  if (sesion === undefined) return <div className="cargando">Cargando…</div>
  return sesion ? <Arranque /> : <Login />
}
