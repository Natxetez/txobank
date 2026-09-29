import type { CamposAhorro } from '../lib/ahorro'

interface Props {
  valor: CamposAhorro
  onChange: (c: CamposAhorro) => void
}

export function AhorroCampos({ valor, onChange }: Props) {
  return (
    <>
      <label className="campo">
        Objetivo de ahorro
        <select
          value={valor.tipo}
          onChange={(e) => onChange({ tipo: e.target.value as CamposAhorro['tipo'], valor: '' })}
        >
          <option value="">Sin objetivo</option>
          <option value="importe">Importe fijo al mes</option>
          <option value="porcentaje">Porcentaje de mis ingresos</option>
        </select>
      </label>
      {valor.tipo !== '' && (
        <label className="campo">
          {valor.tipo === 'importe' ? 'Importe al mes (€)' : 'Porcentaje (%)'}
          <input
            inputMode={valor.tipo === 'importe' ? 'decimal' : 'numeric'}
            placeholder={valor.tipo === 'importe' ? '300' : '15'}
            value={valor.valor}
            onChange={(e) => onChange({ ...valor, valor: e.target.value })}
          />
        </label>
      )}
    </>
  )
}
