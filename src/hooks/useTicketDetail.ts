import { useEffect, useMemo, useState } from 'react'
import type { Ticket, TicketAction, TicketServiceItem } from '../lib/types'
import { watchTicket, watchTicketActions, watchTicketServiceItems } from '../lib/firestore'

export function useTicketDetail(ticketId: string) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [serviceItems, setServiceItems] = useState<TicketServiceItem[]>([])
  const [actions, setActions] = useState<TicketAction[]>([])
  const [error, setError] = useState<string | null>(null)

  const id = useMemo(() => ticketId, [ticketId])

  useEffect(() => {
    const unsubTicket = watchTicket(id, setTicket, (err) => setError(err.message))
    const unsubItems = watchTicketServiceItems(id, setServiceItems, (err) => setError(err.message))
    const unsubActions = watchTicketActions(id, setActions, (err) => setError(err.message))
    return () => {
      unsubTicket()
      unsubItems()
      unsubActions()
    }
  }, [id])

  return {
    ticket,
    serviceItems,
    actions,
    error,
    previousServiceItemIds: serviceItems.map((i) => i.id),
    previousActionIds: actions.map((a) => a.id),
  }
}
