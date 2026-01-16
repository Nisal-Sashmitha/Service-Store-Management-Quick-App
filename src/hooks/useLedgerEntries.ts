import { useEffect, useMemo, useState } from 'react'
import { watchLedgerEntriesForRange, type WatchLedgerFilters } from '../lib/firestore'
import type { LedgerEntry } from '../lib/types'

export function useLedgerEntries(filters: WatchLedgerFilters) {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const stable = useMemo(
    () => ({ start: filters.start, endExclusive: filters.endExclusive, max: filters.max ?? 500 }),
    [filters.endExclusive, filters.max, filters.start],
  )

  useEffect(() => {
    return watchLedgerEntriesForRange(stable, setEntries, (err) => setError(err.message))
  }, [stable])

  return { entries, error }
}

