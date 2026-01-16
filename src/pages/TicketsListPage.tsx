import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, format, startOfDay, subDays } from 'date-fns'
import { ErrorBanner } from '../components/ErrorBanner'
import { StatusPill } from '../components/StatusPill'
import { TopBar } from '../components/TopBar'
import { useQuickActions } from '../components/quickActionsContext'
import { useEmployees } from '../hooks/useEmployees'
import { useTickets } from '../hooks/useTickets'
import { ticketStatusLabel } from '../lib/labels'
import type { Ticket, TicketStatus } from '../lib/types'
import { TICKET_STATUSES } from '../lib/types'
import { formatDateTimeShort } from '../lib/time'

function parseDateOnly(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const [y, m, d] = trimmed.split('-').map((v) => Number(v))
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function nextApptMillis(t: Ticket): number | null {
  return t.nextAppointmentDateTime ? t.nextAppointmentDateTime.toMillis() : null
}

function compareTickets(a: Ticket, b: Ticket): number {
  const now = Date.now()
  const aAppt = nextApptMillis(a)
  const bAppt = nextApptMillis(b)

  const aHasAppt = aAppt !== null
  const bHasAppt = bAppt !== null

  if (aHasAppt !== bHasAppt) return aHasAppt ? -1 : 1

  if (aHasAppt && bHasAppt) {
    const aDelta = aAppt - now
    const bDelta = bAppt - now
    const aPast = aDelta < 0
    const bPast = bDelta < 0
    if (aPast !== bPast) return aPast ? 1 : -1
    return aAppt - bAppt
  }

  const aCreated = a.createdAt?.toMillis?.() ?? 0
  const bCreated = b.createdAt?.toMillis?.() ?? 0
  if (aCreated !== bCreated) return bCreated - aCreated
  const aUpdated = a.updatedAt?.toMillis?.() ?? 0
  const bUpdated = b.updatedAt?.toMillis?.() ?? 0
  return bUpdated - aUpdated
}

export function TicketsListPage() {
  const today = useMemo(() => new Date(), [])
  const quick = useQuickActions()
  const { employees, error: employeesError } = useEmployees()
  const { tickets, error: ticketsError } = useTickets({ max: 500 })

  const [status, setStatus] = useState<TicketStatus | 'ALL'>('ALL')
  const [employeeId, setEmployeeId] = useState<string | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [createdFrom, setCreatedFrom] = useState(() => format(subDays(today, 2), 'yyyy-MM-dd'))
  const [createdTo, setCreatedTo] = useState(() => format(today, 'yyyy-MM-dd'))

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of employees) map.set(e.id, e.name)
    return map
  }, [employees])

  const visibleTickets = useMemo(() => {
    const from = startOfDay(parseDateOnly(createdFrom) ?? subDays(today, 2))
    const toStart = startOfDay(parseDateOnly(createdTo) ?? today)
    const endExclusive = addDays(toStart, 1)

    let list = tickets
    list = list.filter((t) => {
      const created = t.createdAt?.toDate?.()
      if (!created) return false
      return created >= from && created < endExclusive
    })
    if (status !== 'ALL') list = list.filter((t) => t.status === status)
    if (employeeId !== 'ALL') list = list.filter((t) => t.assignedEmployeeId === employeeId)

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((t) => {
        const name = (t.customerName ?? '').toLowerCase()
        const phone = (t.customerPhone ?? '').toLowerCase()
        return name.includes(q) || phone.includes(q)
      })
    }

    return [...list].sort(compareTickets)
  }, [createdFrom, createdTo, employeeId, search, status, tickets, today])

  return (
    <div className="page">
      <TopBar title="Tickets" />

      {employeesError ? <ErrorBanner message={employeesError} /> : null}
      {ticketsError ? <ErrorBanner message={ticketsError} /> : null}

      <section className="card">
        <div className="grid2">
          <div className="field">
            <label className="label">Status</label>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | 'ALL')}>
              <option value="ALL">All</option>
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ticketStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Employee</label>
            <select className="select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="ALL">All</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="label">Search</label>
          <input
            className="input"
            type="search"
            placeholder="Name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid2">
          <div className="field">
            <label className="label">Created from</label>
            <input className="input" type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Created to</label>
            <input className="input" type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button
            className="buttonSecondary"
            type="button"
            onClick={() => {
              setCreatedFrom(format(subDays(new Date(), 2), 'yyyy-MM-dd'))
              setCreatedTo(format(new Date(), 'yyyy-MM-dd'))
            }}
          >
            Last 3 days
          </button>
          <div className="row">
            <button className="buttonPrimary" type="button" onClick={() => quick.openBill()}>
              + Create Bill
            </button>
          </div>
        </div>
      </section>

      <section className="stack">
        {visibleTickets.length ? (
          visibleTickets.map((t) => (
            <Link key={t.id} to={`/tickets/${t.id}`} className="ticketRow">
              <div className="ticketRowTop">
                <div className="ticketName">{t.customerName?.trim() ? t.customerName : 'Unknown'}</div>
                <StatusPill status={t.status} />
              </div>
              <div className="ticketMeta">
                <span className="mono">{t.customerPhone}</span>
                <span className="dot">•</span>
                <span className="mutedSmall">{employeeNameById.get(t.assignedEmployeeId) ?? '—'}</span>
              </div>
              {t.nextAppointmentDateTime ? (
                <div className="ticketAppt">
                  Next: {formatDateTimeShort(t.nextAppointmentDateTime.toDate())}
                  {t.nextAppointmentServiceName ? ` · ${t.nextAppointmentServiceName}` : ''}
                </div>
              ) : null}
            </Link>
          ))
        ) : (
          <div className="muted">No tickets found.</div>
        )}
      </section>

    </div>
  )
}
