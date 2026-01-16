import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { ErrorBanner } from '../components/ErrorBanner'
import { TopBar } from '../components/TopBar'
import { useAppointments } from '../hooks/useAppointments'
import { useEmployees } from '../hooks/useEmployees'
import type { ConfirmationLevel } from '../lib/types'
import { formatTimeShort } from '../lib/time'

function apptKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export function CalendarPage() {
  const location = useLocation()
  const { employees, error: employeesError } = useEmployees()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [employeeId, setEmployeeId] = useState<string | 'ALL'>('ALL')

  const monthStart = useMemo(() => startOfMonth(month), [month])
  const monthEndExclusive = useMemo(() => addMonths(monthStart, 1), [monthStart])

  const { appointments, error: appointmentsError } = useAppointments({ start: monthStart, endExclusive: monthEndExclusive })

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, typeof appointments>()
    for (const a of appointments) {
      if (employeeId !== 'ALL' && a.assignedEmployeeId !== employeeId) continue
      const key = apptKey(a.appointmentDateTime.toDate())
      const prev = map.get(key) ?? []
      map.set(key, [...prev, a])
    }
    return map
  }, [appointments, employeeId])

  const gridStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 1 }), [monthStart])
  const gridEnd = useMemo(() => endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }), [monthStart])

  const days = useMemo(() => {
    const list: Date[] = []
    let d = gridStart
    while (d <= gridEnd) {
      list.push(d)
      d = addDays(d, 1)
    }
    return list
  }, [gridEnd, gridStart])

  function confirmationClass(level: ConfirmationLevel, isCompleted?: boolean) {
    if (isCompleted) return 'apptBlock apptBlockNone'
    switch (level) {
      case 'FULLY_CONFIRMED':
        return 'apptBlock apptBlockFull'
      case 'PARTIALLY_CONFIRMED':
        return 'apptBlock apptBlockPartial'
      default:
        return 'apptBlock apptBlockNone'
    }
  }

  return (
    <div className="page">
      <TopBar title="Calendar" />

      {employeesError ? <ErrorBanner message={employeesError} /> : null}
      {appointmentsError ? <ErrorBanner message={appointmentsError} /> : null}

      <section className="card">
        <div className="row rowBetween calendarHeaderRow">
          <div className="row calendarMonthControls">
            <button className="buttonSecondary" type="button" onClick={() => setMonth((m) => addMonths(m, -1))}>
              ←
            </button>
            <div className="calendarTitle">{format(monthStart, 'MMMM yyyy')}</div>
            <button className="buttonSecondary" type="button" onClick={() => setMonth((m) => addMonths(m, 1))}>
              →
            </button>
          </div>
          <div className="field calendarEmployeeField">
            <label className="label">Employee</label>
            <select className="select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="ALL">All employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="calendarGrid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="calendarDow">
            {d}
          </div>
        ))}
        {days.map((date) => {
          const inMonth = isSameMonth(date, monthStart)
          const key = apptKey(date)
          const dayAppts = appointmentsByDay.get(key) ?? []

          return (
            <div key={key} className={inMonth ? 'dayCell' : 'dayCell dayCellDim'}>
              <div className="dayNumber">{format(date, 'd')}</div>
              <div className="dayAppts">
                {dayAppts.slice(0, 4).map((a) => {
                  const when = a.appointmentDateTime.toDate()
                  const who = (a.customerName ?? '').trim() || a.customerPhone
                  return (
                    <Link
                      key={a.id}
                      to={`/tickets/${a.ticketId}`}
                      state={{ backgroundLocation: location }}
                      className={confirmationClass(a.confirmationLevel, a.isCompleted)}
                    >
                      <span className="mono">{formatTimeShort(when)}</span> {who} · {a.serviceName}
                    </Link>
                  )
                })}
                {dayAppts.length > 4 ? <div className="moreAppts">+{dayAppts.length - 4} more</div> : null}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
