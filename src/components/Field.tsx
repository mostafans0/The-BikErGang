// Reusable labelled form field with validation error messaging.
// Associates label, input and error via ids for accessibility.
type BaseProps = {
  id: string
  label: string
  error?: string
  required?: boolean
}

export function TextField({
  id,
  label,
  error,
  required,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
}: BaseProps & {
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
}) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span aria-hidden="true" className="text-[var(--color-primary)]"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="field"
        style={error ? { borderColor: 'var(--color-destructive)' } : undefined}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-[var(--color-destructive)]">
          {error}
        </p>
      )}
    </div>
  )
}

export function SelectField({
  id,
  label,
  error,
  required,
  value,
  onChange,
  options,
}: BaseProps & {
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span aria-hidden="true" className="text-[var(--color-primary)]"> *</span>}
      </label>
      <select
        id={id}
        value={value}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="field"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="mt-1 text-sm text-[var(--color-destructive)]">
          {error}
        </p>
      )}
    </div>
  )
}
