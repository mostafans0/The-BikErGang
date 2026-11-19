import { useState } from 'react'
import { TextField, SelectField } from '@/components/Field'
import { EmptyState } from '@/components/EmptyState'
import { useStore } from '@/store'

const CATEGORIES = ['Naked', 'Sport', 'Touring', 'Adventure', 'Cruiser', 'Scooter']
const emptyForm = { year: '', make: '', model: '', category: 'Naked', engine: '' }
type FormErrors = Partial<Record<keyof typeof emptyForm, string>>

export default function Garage() {
  const { motorcycles, activeMotorcycleId, addMotorcycle, removeMotorcycle, setActiveMotorcycle } = useStore()
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [success, setSuccess] = useState('')

  const set = (key: keyof typeof emptyForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    setSuccess('')
  }

  const validate = (): FormErrors => {
    const next: FormErrors = {}
    const yearNum = Number(form.year)
    if (!form.year.trim()) next.year = 'Year is required.'
    else if (!Number.isInteger(yearNum) || yearNum < 1950 || yearNum > 2027)
      next.year = 'Enter a year between 1950 and 2027.'
    if (!form.make.trim()) next.make = 'Manufacturer is required.'
    else if (form.make.trim().length < 2) next.make = 'Manufacturer looks too short.'
    if (!form.model.trim()) next.model = 'Model is required.'
    if (form.engine.trim() && !/^\d{2,4}\s?cc$/i.test(form.engine.trim()))
      next.engine = 'Use a format like "689 cc" (or leave blank).'
    return next
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setSuccess('')
      return
    }
    addMotorcycle({
      year: form.year.trim(),
      make: form.make.trim(),
      model: form.model.trim(),
      category: form.category,
      engine: form.engine.trim() || '—',
    })
    setSuccess(`${form.year} ${form.make} ${form.model} added to your garage.`)
    setForm(emptyForm)
  }

  const hasErrors = Object.values(errors).some(Boolean)

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
      <p className="eyebrow">Compatibility context</p>
      <h1 className="section-title mt-3">My garage.</h1>
      <p className="mt-4 max-w-2xl text-[var(--color-muted-foreground)]">
        Add your motorcycle to tailor gear compatibility. Your garage is saved in this browser.
      </p>

      <form onSubmit={submit} noValidate className="mt-8 border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="font-heading text-xl font-bold">Add a motorcycle</h2>

        {/* Form-level feedback */}
        {success && (
          <p role="status" className="mt-4 border border-[var(--color-success)] p-3 text-sm text-[var(--color-success)]">
            {success}
          </p>
        )}
        {hasErrors && (
          <p role="alert" className="mt-4 border border-[var(--color-destructive)] p-3 text-sm text-[var(--color-destructive)]">
            Please fix the highlighted fields below.
          </p>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField id="year" label="Year" required value={form.year} onChange={(v) => set('year', v)} error={errors.year} placeholder="2023" />
          <TextField id="make" label="Manufacturer" required value={form.make} onChange={(v) => set('make', v)} error={errors.make} placeholder="Yamaha" />
          <TextField id="model" label="Model" required value={form.model} onChange={(v) => set('model', v)} error={errors.model} placeholder="MT-07" />
          <SelectField id="category" label="Category" value={form.category} onChange={(v) => set('category', v)} options={CATEGORIES} />
          <TextField id="engine" label="Engine (optional)" value={form.engine} onChange={(v) => set('engine', v)} error={errors.engine} placeholder="689 cc" />
        </div>
        <button type="submit" className="btn-primary mt-6">
          Add motorcycle
        </button>
      </form>

      {motorcycles.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Your garage is empty" description="Add a motorcycle above to set your compatibility context." />
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 md:grid-cols-2">
          {motorcycles.map((m) => {
            const isActive = m.id === activeMotorcycleId
            return (
              <li
                key={m.id}
                className="border bg-[var(--color-card)] p-6"
                style={{ borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border)' }}
              >
                <div className="flex items-start justify-between">
                  <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted-foreground)]">
                    {m.year} {m.make} · {m.category}
                  </p>
                  <button
                    type="button"
                    aria-label={`Remove ${m.model}`}
                    onClick={() => removeMotorcycle(m.id)}
                    className="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"
                  >
                    ✕
                  </button>
                </div>
                <h3 className="mt-2 font-heading text-2xl font-bold">{m.model}</h3>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{m.engine}</p>
                {isActive ? (
                  <span className="mt-5 inline-flex items-center gap-2 text-sm text-[var(--color-primary)]">✓ Active motorcycle</span>
                ) : (
                  <button type="button" onClick={() => setActiveMotorcycle(m.id)} className="btn-secondary mt-5">
                    Set active
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
