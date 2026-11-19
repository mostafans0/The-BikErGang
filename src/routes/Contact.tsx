import { useState } from 'react'
import { TextField } from '@/components/Field'

const empty = { name: '', email: '', message: '' }
type Errors = Partial<Record<keyof typeof empty, string>>

export default function Contact() {
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState<Errors>({})
  const [sent, setSent] = useState(false)

  const set = (key: keyof typeof empty, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    setSent(false)
  }

  const validate = (): Errors => {
    const next: Errors = {}
    if (!form.name.trim()) next.name = 'Please enter your name.'
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.message.trim()) next.message = 'Please write a message.'
    else if (form.message.trim().length < 10) next.message = 'Message should be at least 10 characters.'
    return next
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSent(true)
    setForm(empty)
  }

  const hasErrors = Object.values(errors).some(Boolean)

  return (
    <div className="mx-auto max-w-2xl px-5 py-12 lg:px-8">
      <p className="eyebrow">Support</p>
      <h1 className="section-title mt-3">Contact us.</h1>
      <p className="mt-4 text-[var(--color-muted-foreground)]">
        Questions about fit, compatibility, or an order? Send us a message.
      </p>

      <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-5 border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        {sent && (
          <p role="status" className="border border-[var(--color-success)] p-3 text-sm text-[var(--color-success)]">
            Thanks — your message has been sent. We'll reply by email shortly.
          </p>
        )}
        {hasErrors && (
          <p role="alert" className="border border-[var(--color-destructive)] p-3 text-sm text-[var(--color-destructive)]">
            Please correct the highlighted fields.
          </p>
        )}
        <TextField id="name" label="Name" required value={form.name} onChange={(v) => set('name', v)} error={errors.name} autoComplete="name" />
        <TextField id="email" label="Email" type="email" required value={form.email} onChange={(v) => set('email', v)} error={errors.email} autoComplete="email" />
        <div className="flex flex-col">
          <label htmlFor="message" className="text-sm font-medium">
            Message<span aria-hidden="true" className="text-[var(--color-primary)]"> *</span>
          </label>
          <textarea
            id="message"
            value={form.message}
            required
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? 'message-error' : undefined}
            onChange={(e) => set('message', e.target.value)}
            rows={5}
            className="field py-2"
            style={errors.message ? { borderColor: 'var(--color-destructive)' } : undefined}
          />
          {errors.message && (
            <p id="message-error" className="mt-1 text-sm text-[var(--color-destructive)]">
              {errors.message}
            </p>
          )}
        </div>
        <button type="submit" className="btn-primary self-start">
          Send message
        </button>
      </form>
    </div>
  )
}
