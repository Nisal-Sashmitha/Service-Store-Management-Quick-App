import type { ConfirmationLevel, TicketStatus } from './types'

export function ticketStatusLabel(status: TicketStatus): string {
  switch (status) {
    case 'NEW_CALL':
      return 'New call'
    case 'PRICE_DISCUSSION_PENDING':
      return 'Price discussion'
    case 'APPOINTMENT_TENTATIVE':
      return 'Tentative'
    case 'APPOINTMENT_CONFIRMED':
      return 'Confirmed'
    case 'COMPLETED':
      return 'Completed'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return status
  }
}

export function confirmationLevelLabel(level: ConfirmationLevel): string {
  switch (level) {
    case 'NONE':
      return 'None'
    case 'PARTIALLY_CONFIRMED':
      return 'Partially confirmed'
    case 'FULLY_CONFIRMED':
      return 'Fully confirmed'
    default:
      return level
  }
}

