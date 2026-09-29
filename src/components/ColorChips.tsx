import { PALETA } from '../lib/catalogo'

interface Props {
  valor: string
  onChange: (color: string) => void
}

export function ColorChips({ valor, onChange }: Props) {
  return (
    <div className="colores" role="radiogroup" aria-label="Color">
      {PALETA.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={valor === c}
          aria-label={c}
          className={valor === c ? 'color activo' : 'color'}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  )
}
