import { format } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { completeServiceAndRecordIncome } from '../lib/firestore'
import { confirmationLevelLabel, ticketStatusLabel } from '../lib/labels'
import type { Employee, ServiceCatalogItem, TicketActionDraft, TicketServiceItemDraft, TicketStatus } from '../lib/types'
import { CONFIRMATION_LEVELS, TICKET_STATUSES } from '../lib/types'
import { ErrorBanner } from './ErrorBanner'

export type TicketFormValue = {
  customerPhone: string
  customerName: string
  assignedEmployeeId: string
  status: TicketStatus
  overallNote: string
  serviceItems: TicketServiceItemDraft[]
  actions: TicketActionDraft[]
}

export function TicketForm(props: {
  title: string
  backTo?: string
  onBack?: () => void
  ticketId?: string
  employees: Employee[]
  services: ServiceCatalogItem[]
  banners?: string[]
  initialValue: TicketFormValue
  submitLabel: string
  onSubmit: (value: TicketFormValue) => Promise<void>
}) {
  const [value, setValue] = useState<TicketFormValue>(props.initialValue)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [completingServiceId, setCompletingServiceId] = useState<string | null>(null)

  useEffect(() => {
    setValue(props.initialValue)
  }, [props.initialValue])

  const selectedServiceIds = useMemo(() => new Set(value.serviceItems.map((s) => s.serviceId)), [value.serviceItems])
  const [serviceToAddId, setServiceToAddId] = useState<string>('')
  const statusOptions = useMemo(() => TICKET_STATUSES, [])

  function update<K extends keyof TicketFormValue>(key: K, next: TicketFormValue[K]) {
    setValue((v) => ({ ...v, [key]: next }))
  }

  function validate(next: TicketFormValue): string | null {
    if (!next.customerPhone.trim()) return 'Phone number is required.'
    if (!next.assignedEmployeeId) return 'Assigned employee is required.'
    if (next.serviceItems.length < 1) return 'Select at least 1 service.'

    for (const action of next.actions) {
      const hasAny = Boolean(action.description.trim() || action.dueDateTimeInput.trim())
      if (!hasAny) continue
      if (!action.description.trim()) return 'Each action needs a description.'
      if (!action.dueDateTimeInput.trim()) return 'Each action needs a due date/time.'
    }

    return null
  }

  async function handleSubmit() {
    setFormError(null)
    const err = validate(value)
    if (err) {
      setFormError(err)
      return
    }
    setSaving(true)
    try {
      await props.onSubmit(value)
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function addSelectedService() {
    const service = props.services.find((s) => s.id === serviceToAddId)
    if (!service) return
    if (selectedServiceIds.has(service.id)) return
    update('serviceItems', [
      ...value.serviceItems,
      {
        id: service.id,
        serviceId: service.id,
        serviceName: service.name,
        priceText: '',
        serviceNote: '',
        appointmentDateTimeInput: '',
        confirmationLevel: 'NONE',
        isCompleted: false,
        completedAt: null,
        assignedEmployeeId: value.assignedEmployeeId || '',
        customerPhone: value.customerPhone,
        customerName: value.customerName,
      },
    ])
    setServiceToAddId('')
  }

  function removeService(serviceId: string) {
    update(
      'serviceItems',
      value.serviceItems.filter((s) => s.serviceId !== serviceId),
    )
  }

  function updateServiceItem(serviceId: string, patch: Partial<TicketServiceItemDraft>) {
    update(
      'serviceItems',
      value.serviceItems.map((s) => (s.serviceId === serviceId ? { ...s, ...patch } : s)),
    )
  }

  async function completeService(serviceId: string, serviceName: string) {
    if (completingServiceId) return
    if (!props.ticketId) return
    if (!confirm(`Mark "${serviceName}" as completed?`)) return
    const amountRaw = prompt('Amount received', '')
    if (amountRaw === null) return
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError('Invalid amount. Enter a number (0 or more).')
      return
    }
    try {
      setCompletingServiceId(serviceId)
      await completeServiceAndRecordIncome({
        ticketId: props.ticketId,
        serviceId,
        serviceName,
        amount,
      })
      updateServiceItem(serviceId, { isCompleted: true })
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setCompletingServiceId(null)
    }
  }

  function addAction() {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const dueDefault = format(tomorrow, "yyyy-MM-dd'T'HH:mm")
    update('actions', [
      ...value.actions,
      {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        description: '',
        dueDateTimeInput: dueDefault,
        isCompleted: false,
      },
    ])
  }

  function removeAction(index: number) {
    update(
      'actions',
      value.actions.filter((_, i) => i !== index),
    )
  }

  function updateAction(index: number, patch: Partial<TicketActionDraft>) {
    update(
      'actions',
      value.actions.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    )
  }

  return (
    <div className="page">
      <div className="pageHeaderRow">
        {props.onBack ? (
          <button className="iconButton" type="button" onClick={props.onBack} aria-label="Back">
            ←
          </button>
        ) : (
          <Link className="iconButton" to={props.backTo ?? '/'} aria-label="Back">
            ←
          </Link>
        )}
        <div className="pageTitle">{props.title}</div>
      </div>

      {props.banners?.filter(Boolean).map((m, idx) => <ErrorBanner key={idx} message={m} />)}
      {formError ? <ErrorBanner message={formError} /> : null}

      <section className="card">
        <div className="grid2">
          <div className="field">
            <label className="label">Phone number *</label>
            <input
              className="input"
              type="tel"
              inputMode="numeric"
              placeholder="07xxxxxxxx"
              value={value.customerPhone}
              onChange={(e) => update('customerPhone', e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">Name</label>
            <input
              className="input"
              type="text"
              placeholder="Customer name"
              value={value.customerName}
              onChange={(e) => update('customerName', e.target.value)}
            />
          </div>
        </div>

        <div className="grid2">
          <div className="field">
            <label className="label">Assigned employee *</label>
            <select className="select" value={value.assignedEmployeeId} onChange={(e) => update('assignedEmployeeId', e.target.value)}>
              <option value="">Select employee…</option>
              {props.employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Status</label>
            <select className="select" value={value.status} onChange={(e) => update('status', e.target.value as TicketStatus)}>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {ticketStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="sectionTitle">Services *</div>

        <div className="row">
          <select className="select" value={serviceToAddId} onChange={(e) => setServiceToAddId(e.target.value)}>
            <option value="">Add a service…</option>
            {props.services
              .filter((s) => !selectedServiceIds.has(s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <button className="button" type="button" onClick={addSelectedService} disabled={!serviceToAddId}>
            Add
          </button>
        </div>

        {value.serviceItems.length ? (
          <div className="stack">
            {value.serviceItems.map((item) => (
              <div key={item.serviceId} className="subCard">
                <div className="row rowBetween">
                  <div className="subCardTitle">{item.serviceName}</div>
                  <div className="row">
                    {item.isCompleted ? <span className="pill pillConfirm_FULLY_CONFIRMED">Completed</span> : null}
                    {props.ticketId && !item.isCompleted ? (
                      <button
                        className="buttonSecondary"
                        type="button"
                        disabled={saving || completingServiceId !== null}
                        onClick={() => completeService(item.serviceId, item.serviceName)}
                      >
                        {completingServiceId === item.serviceId ? 'Completing...' : 'Complete'}
                      </button>
                    ) : null}
                    <button className="buttonSecondary" type="button" onClick={() => removeService(item.serviceId)}>
                      Remove
                    </button>
                  </div>
                </div>

                <div className="grid2">
                  <div className="field">
                    <label className="label">Price / range told</label>
                    <input
                      className="input"
                      type="text"
                      placeholder="e.g., 3500–4500"
                      value={item.priceText ?? ''}
                      onChange={(e) => updateServiceItem(item.serviceId, { priceText: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label className="label">Confirmation</label>
                    <select
                      className="select"
                      value={item.confirmationLevel}
                      onChange={(e) => updateServiceItem(item.serviceId, { confirmationLevel: e.target.value as (typeof CONFIRMATION_LEVELS)[number] })}
                    >
                      {CONFIRMATION_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {confirmationLevelLabel(lvl)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label className="label">Appointment date/time (optional)</label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={item.appointmentDateTimeInput ?? ''}
                    onChange={(e) => updateServiceItem(item.serviceId, { appointmentDateTimeInput: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label className="label">Service note</label>
                  <textarea
                    className="textarea"
                    rows={2}
                    placeholder="Notes for this service…"
                    value={item.serviceNote ?? ''}
                    onChange={(e) => updateServiceItem(item.serviceId, { serviceNote: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No services selected yet.</div>
        )}
      </section>

      <section className="card">
        <div className="sectionTitle">Overall note</div>
        <textarea
          className="textarea"
          rows={4}
          placeholder="Anything important from the call…"
          value={value.overallNote}
          onChange={(e) => update('overallNote', e.target.value)}
        />
      </section>

      <section className="card">
        <div className="row rowBetween">
          <div className="sectionTitle">Actions / follow-ups</div>
          <button className="buttonSecondary" type="button" onClick={addAction}>
            + Action
          </button>
        </div>

        {value.actions.length ? (
          <div className="stack">
            {value.actions.map((action, index) => (
              <div key={action.id ?? index} className="subCard">
                <div className="row rowBetween">
                  <div className="subCardTitle">Action</div>
                  <button className="buttonSecondary" type="button" onClick={() => removeAction(index)}>
                    Remove
                  </button>
                </div>
                <div className="field">
                  <label className="label">Description *</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g., Call back tomorrow"
                    value={action.description}
                    onChange={(e) => updateAction(index, { description: e.target.value })}
                  />
                </div>
                <div className="grid2">
                  <div className="field">
                    <label className="label">Due date/time *</label>
                    <input
                      className="input"
                      type="datetime-local"
                      value={action.dueDateTimeInput}
                      onChange={(e) => updateAction(index, { dueDateTimeInput: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label className="label">Completed</label>
                    <label className="checkboxRow">
                      <input
                        type="checkbox"
                        checked={action.isCompleted}
                        onChange={(e) => updateAction(index, { isCompleted: e.target.checked })}
                      />
                      <span className="mutedSmall">Done</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No actions yet.</div>
        )}
      </section>

      <div className="stickyFooter">
        <button className="buttonPrimary" type="button" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving…' : props.submitLabel}
        </button>
      </div>
    </div>
  )
}
