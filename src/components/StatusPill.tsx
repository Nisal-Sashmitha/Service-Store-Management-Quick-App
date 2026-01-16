import clsx from 'clsx'
import type { TicketStatus } from '../lib/types'
import { ticketStatusLabel } from '../lib/labels'

export function StatusPill(props: { status: TicketStatus }) {
  return (
    <span className={clsx('pill', `pillStatus_${props.status}`)} title={props.status}>
      {ticketStatusLabel(props.status)}
    </span>
  )
}

