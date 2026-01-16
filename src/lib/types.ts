import type { Timestamp } from 'firebase/firestore'

export const TICKET_STATUSES = [
  'NEW_CALL',
  'PRICE_DISCUSSION_PENDING',
  'APPOINTMENT_TENTATIVE',
  'APPOINTMENT_CONFIRMED',
  'COMPLETED',
  'CANCELLED',
] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const CONFIRMATION_LEVELS = ['NONE', 'PARTIALLY_CONFIRMED', 'FULLY_CONFIRMED'] as const
export type ConfirmationLevel = (typeof CONFIRMATION_LEVELS)[number]

export type DocId = string

export type Employee = {
  id: DocId
  name: string
}

export const SERVICE_CATEGORIES = ['hair', 'beauty', 'nails'] as const
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]

export type ServiceCatalogItem = {
  id: DocId
  name: string
  category?: ServiceCategory | null
  description?: string | null
  duration?: string | null
  originalPrice?: number | null
  currentPrice?: number | null
  discount?: boolean | null
  rating?: number | null
  popular?: boolean | null
  contactUsForPrice?: boolean | null
}

export type Ticket = {
  id: DocId
  customerPhone: string
  customerName?: string | null
  status: TicketStatus
  assignedEmployeeId: DocId
  overallNote?: string | null
  createdAt?: Timestamp
  updatedAt?: Timestamp

  nextAppointmentDateTime?: Timestamp | null
  nextAppointmentServiceName?: string | null
  nextAppointmentConfirmationLevel?: ConfirmationLevel | null
}

export type TicketServiceItem = {
  id: DocId
  ticketId: DocId
  serviceId: DocId
  serviceName: string
  priceText?: string | null
  serviceNote?: string | null
  appointmentDateTime?: Timestamp | null
  confirmationLevel: ConfirmationLevel
  isCompleted?: boolean
  completedAt?: Timestamp | null

  // denormalized for calendar queries
  assignedEmployeeId: DocId
  customerPhone: string
  customerName?: string | null
}

export type TicketAction = {
  id: DocId
  description: string
  dueDateTime: Timestamp
  isCompleted: boolean
  createdAt?: Timestamp
}

export type TicketServiceItemDraft = Omit<TicketServiceItem, 'id' | 'ticketId' | 'appointmentDateTime'> & {
  id?: DocId
  appointmentDateTimeInput?: string // yyyy-MM-ddTHH:mm
}

export type TicketActionDraft = Omit<TicketAction, 'id' | 'dueDateTime'> & {
  id?: DocId
  dueDateTimeInput: string // yyyy-MM-ddTHH:mm
}

export const LEDGER_ENTRY_TYPES = ['INCOME', 'EXPENSE'] as const
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number]

export type LedgerEntry = {
  id: DocId
  type: LedgerEntryType
  date: Timestamp
  amount: number
  createdAt?: Timestamp

  // income
  ticketId?: DocId | null
  billId?: DocId | null
  serviceId?: DocId | null
  serviceName?: string | null

  // expense
  reason?: string | null
}
