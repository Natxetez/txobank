import { EconomiaProvider } from './data/EconomiaContext'
import { useSesion } from './data/SesionContext'
import { Login } from './screens/Login'
import { Arranque } from './screens/Arranque'
import { VerificarCodigo } from './screens/VerificarCodigo'

export function App() {
  const sesion = useSesion()
  if (sesion === undefined) return <div className="cargando">Cargando…</div>
  if (!sesion) return <Login />
  // Con la verificación en dos pasos activada, no se entra hasta introducir el código.
  if (sesion.faltaCodigo) return <VerificarCodigo email={sesion.email} />
  return (
    <EconomiaProvider>
      <Arranque />
    </EconomiaProvider>
  )
}
