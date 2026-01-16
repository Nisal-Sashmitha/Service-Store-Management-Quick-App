import { useEffect, useState } from 'react'
import type { ServiceCatalogItem } from '../lib/types'
import { watchServices } from '../lib/firestore'

export function useServices() {
  const [services, setServices] = useState<ServiceCatalogItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return watchServices(setServices, (err) => setError(err.message))
  }, [])

  return { services, error }
}
