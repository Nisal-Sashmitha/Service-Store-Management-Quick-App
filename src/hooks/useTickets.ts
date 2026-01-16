import { useEffect, useMemo, useState } from 'react'
import type { Ticket } from '../lib/types'
import { watchTickets, type WatchTicketsFilters } from '../lib/firestore'

export function useTickets(filters: WatchTicketsFilters) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [error, setError] = useState<string | null>(null)

  const stableFilters = useMemo(
    () => ({ max: filters.max ?? 200 }),
    [filters.max],
  )

  useEffect(() => {
    return watchTickets(stableFilters, setTickets, (err) => setError(err.message))
  }, [stableFilters])

  return { tickets, error }
}
