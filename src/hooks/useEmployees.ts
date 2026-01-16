import { useEffect, useState } from 'react'
import type { Employee } from '../lib/types'
import { watchEmployees } from '../lib/firestore'

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return watchEmployees(setEmployees, (err) => setError(err.message))
  }, [])

  return { employees, error }
}
