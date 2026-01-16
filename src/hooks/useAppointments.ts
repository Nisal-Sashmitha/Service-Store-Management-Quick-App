import { useEffect, useMemo, useState } from 'react'
import { watchAppointmentsForRange, type AppointmentBlock } from '../lib/firestore'

export function useAppointments(filters: { start: Date; endExclusive: Date }) {
  const [appointments, setAppointments] = useState<AppointmentBlock[]>([])
  const [error, setError] = useState<string | null>(null)

  const stable = useMemo(() => ({ start: filters.start, endExclusive: filters.endExclusive }), [filters.endExclusive, filters.start])

  useEffect(() => {
    return watchAppointmentsForRange(stable, setAppointments, (err) => setError(err.message))
  }, [stable])

  return { appointments, error }
}
