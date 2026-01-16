import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from './firebase'
import type {
  ConfirmationLevel,
  Employee,
  LedgerEntry,
  ServiceCatalogItem,
  ServiceCategory,
  Ticket,
  TicketAction,
  TicketActionDraft,
  TicketServiceItem,
  TicketServiceItemDraft,
  TicketStatus,
} from './types'
import { parseDateInputValue } from './time'

function withId<T>(snap: QueryDocumentSnapshot<DocumentData>): T & { id: string } {
  return { id: snap.id, ...(snap.data() as T) }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed ? trimmed : null
}

function computeNextAppointmentFromDrafts(items: TicketServiceItemDraft[]): {
  date: Date
  serviceName: string
  confirmationLevel: ConfirmationLevel
} | null {
  const dated = items
    .map((i) => {
      const date = parseDateInputValue(i.appointmentDateTimeInput ?? '')
      return date ? { date, serviceName: i.serviceName, confirmationLevel: i.confirmationLevel } : null
    })
    .filter(Boolean) as { date: Date; serviceName: string; confirmationLevel: ConfirmationLevel }[]

  if (!dated.length) return null
  dated.sort((a, b) => a.date.getTime() - b.date.getTime())
  return dated[0] ?? null
}

export function watchEmployees(onChange: (employees: Employee[]) => void, onError?: (err: Error) => void): Unsubscribe {
  const db = getDb()
  const q = query(collection(db, 'employees'), orderBy('name', 'asc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => withId<Employee>(d))),
    (err) => onError?.(err as Error),
  )
}

export function watchServices(onChange: (services: ServiceCatalogItem[]) => void, onError?: (err: Error) => void): Unsubscribe {
  const db = getDb()
  const q = query(collection(db, 'services'), orderBy('name', 'asc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => withId<ServiceCatalogItem>(d))),
    (err) => onError?.(err as Error),
  )
}

export type WatchTicketsFilters = {
  max?: number
}

export function watchTickets(
  filters: WatchTicketsFilters,
  onChange: (tickets: Ticket[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getDb()
  const constraints: QueryConstraint[] = []

  constraints.push(orderBy('updatedAt', 'desc'))
  constraints.push(limit(filters.max ?? 200))

  const q = query(collection(db, 'tickets'), ...constraints)
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => withId<Ticket>(d))),
    (err) => onError?.(err as Error),
  )
}

export function watchTicket(
  ticketId: string,
  onChange: (ticket: Ticket | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getDb()
  const ref = doc(db, 'tickets', ticketId)
  return onSnapshot(
    ref,
    (snap) => onChange(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Ticket, 'id'>) } as Ticket) : null),
    (err) => onError?.(err as Error),
  )
}

export function watchTicketServiceItems(
  ticketId: string,
  onChange: (items: TicketServiceItem[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getDb()
  const q = query(collection(db, 'tickets', ticketId, 'serviceItems'), orderBy('serviceName', 'asc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => withId<TicketServiceItem>(d))),
    (err) => onError?.(err as Error),
  )
}

export function watchTicketActions(
  ticketId: string,
  onChange: (actions: TicketAction[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getDb()
  const q = query(collection(db, 'tickets', ticketId, 'actions'), orderBy('dueDateTime', 'asc'))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => withId<TicketAction>(d))),
    (err) => onError?.(err as Error),
  )
}

export type AppointmentBlock = {
  id: string
  ticketId: string
  appointmentDateTime: Timestamp
  serviceName: string
  confirmationLevel: ConfirmationLevel
  assignedEmployeeId: string
  customerPhone: string
  customerName?: string | null
  isCompleted?: boolean
}

export type WatchAppointmentsFilters = {
  start: Date
  endExclusive: Date
}

export function watchAppointmentsForRange(
  filters: WatchAppointmentsFilters,
  onChange: (appointments: AppointmentBlock[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getDb()
  const q = query(
    collection(db, 'appointments'),
    where('appointmentDateTime', '>=', Timestamp.fromDate(filters.start)),
    where('appointmentDateTime', '<', Timestamp.fromDate(filters.endExclusive)),
    orderBy('appointmentDateTime', 'asc'),
  )
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => withId<AppointmentBlock>(d))),
    (err) => onError?.(err as Error),
  )
}

export async function createTicket(input: {
  customerPhone: string
  customerName?: string
  status: TicketStatus
  assignedEmployeeId: string
  overallNote?: string
  serviceItems: TicketServiceItemDraft[]
  actions: TicketActionDraft[]
}): Promise<string> {
  const db = getDb()
  const ticketRef = doc(collection(db, 'tickets'))
  const batch = writeBatch(db)

  const next = computeNextAppointmentFromDrafts(input.serviceItems)
  batch.set(ticketRef, {
    customerPhone: input.customerPhone.trim(),
    customerName: normalizeOptionalText(input.customerName),
    status: input.status,
    assignedEmployeeId: input.assignedEmployeeId,
    overallNote: normalizeOptionalText(input.overallNote),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    nextAppointmentDateTime: next ? Timestamp.fromDate(next.date) : null,
    nextAppointmentServiceName: next ? next.serviceName : null,
    nextAppointmentConfirmationLevel: next ? next.confirmationLevel : null,
  })

  for (const item of input.serviceItems) {
    const itemRef = doc(ticketRef, 'serviceItems', item.serviceId)
    const appointmentDate = parseDateInputValue(item.appointmentDateTimeInput ?? '')
    const appointmentRef = doc(db, 'appointments', `${ticketRef.id}__${item.serviceId}`)
    batch.set(itemRef, {
      ticketId: ticketRef.id,
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      priceText: normalizeOptionalText(item.priceText),
      serviceNote: normalizeOptionalText(item.serviceNote),
      appointmentDateTime: appointmentDate ? Timestamp.fromDate(appointmentDate) : null,
      confirmationLevel: item.confirmationLevel,
      isCompleted: Boolean(item.isCompleted),
      completedAt: item.completedAt ?? null,
      assignedEmployeeId: input.assignedEmployeeId,
      customerPhone: input.customerPhone.trim(),
      customerName: normalizeOptionalText(input.customerName),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    if (appointmentDate) {
      batch.set(
        appointmentRef,
        {
          ticketId: ticketRef.id,
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          appointmentDateTime: Timestamp.fromDate(appointmentDate),
          confirmationLevel: item.confirmationLevel,
          isCompleted: Boolean(item.isCompleted),
          assignedEmployeeId: input.assignedEmployeeId,
          customerPhone: input.customerPhone.trim(),
          customerName: normalizeOptionalText(input.customerName),
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      )
    } else {
      batch.delete(appointmentRef)
    }
  }

  for (const action of input.actions) {
    const actionId = action.id ?? doc(collection(ticketRef, 'actions')).id
    const actionRef = doc(ticketRef, 'actions', actionId)
    const dueDate = parseDateInputValue(action.dueDateTimeInput)
    if (!dueDate) continue
    batch.set(actionRef, {
      description: action.description.trim(),
      dueDateTime: Timestamp.fromDate(dueDate),
      isCompleted: Boolean(action.isCompleted),
      createdAt: serverTimestamp(),
    })
  }

  await batch.commit()
  return ticketRef.id
}

export async function updateTicket(input: {
  ticketId: string
  customerPhone: string
  customerName?: string
  status: TicketStatus
  assignedEmployeeId: string
  overallNote?: string
  serviceItems: TicketServiceItemDraft[]
  previousServiceItemIds: string[]
  actions: TicketActionDraft[]
  previousActionIds: string[]
}): Promise<void> {
  const db = getDb()
  const ticketRef = doc(db, 'tickets', input.ticketId)
  const batch = writeBatch(db)

  const next = computeNextAppointmentFromDrafts(input.serviceItems)
  batch.update(ticketRef, {
    customerPhone: input.customerPhone.trim(),
    customerName: normalizeOptionalText(input.customerName),
    status: input.status,
    assignedEmployeeId: input.assignedEmployeeId,
    overallNote: normalizeOptionalText(input.overallNote),
    updatedAt: serverTimestamp(),
    nextAppointmentDateTime: next ? Timestamp.fromDate(next.date) : null,
    nextAppointmentServiceName: next ? next.serviceName : null,
    nextAppointmentConfirmationLevel: next ? next.confirmationLevel : null,
  })

  const prevServiceIds = new Set(input.previousServiceItemIds)
  const nextServiceIds: string[] = []
  for (const item of input.serviceItems) {
    const appointmentDate = parseDateInputValue(item.appointmentDateTimeInput ?? '')
    const data: Record<string, unknown> = {
      ticketId: input.ticketId,
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      priceText: normalizeOptionalText(item.priceText),
      serviceNote: normalizeOptionalText(item.serviceNote),
      appointmentDateTime: appointmentDate ? Timestamp.fromDate(appointmentDate) : null,
      confirmationLevel: item.confirmationLevel,
      isCompleted: Boolean(item.isCompleted),
      assignedEmployeeId: input.assignedEmployeeId,
      customerPhone: input.customerPhone.trim(),
      customerName: normalizeOptionalText(input.customerName),
      updatedAt: serverTimestamp(),
    }
    if (item.isCompleted) {
      if (item.completedAt) data.completedAt = item.completedAt
    } else {
      data.completedAt = null
    }

    const ref = doc(db, 'tickets', input.ticketId, 'serviceItems', item.serviceId)
    nextServiceIds.push(item.serviceId)
    if (prevServiceIds.has(item.serviceId)) {
      batch.update(ref, data)
    } else {
      batch.set(ref, { ...data, createdAt: serverTimestamp() })
    }

    const appointmentRef = doc(db, 'appointments', `${input.ticketId}__${item.serviceId}`)
    if (appointmentDate) {
      batch.set(
        appointmentRef,
        {
          ticketId: input.ticketId,
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          appointmentDateTime: Timestamp.fromDate(appointmentDate),
          confirmationLevel: item.confirmationLevel,
          isCompleted: Boolean(item.isCompleted),
          assignedEmployeeId: input.assignedEmployeeId,
          customerPhone: input.customerPhone.trim(),
          customerName: normalizeOptionalText(input.customerName),
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      )
    } else {
      batch.delete(appointmentRef)
    }
  }

  for (const prevId of input.previousServiceItemIds) {
    if (!nextServiceIds.includes(prevId)) {
      batch.delete(doc(db, 'tickets', input.ticketId, 'serviceItems', prevId))
      batch.delete(doc(db, 'appointments', `${input.ticketId}__${prevId}`))
    }
  }

  const prevActionIds = new Set(input.previousActionIds)
  const nextActionIds: string[] = []
  for (const action of input.actions) {
    const dueDate = parseDateInputValue(action.dueDateTimeInput)
    if (!dueDate) continue
    const actionId = action.id ?? doc(collection(db, 'tickets', input.ticketId, 'actions')).id
    const actionRef = doc(db, 'tickets', input.ticketId, 'actions', actionId)
    const data = {
      description: action.description.trim(),
      dueDateTime: Timestamp.fromDate(dueDate),
      isCompleted: Boolean(action.isCompleted),
    }

    nextActionIds.push(actionId)
    if (prevActionIds.has(actionId)) batch.update(actionRef, data)
    else batch.set(actionRef, { ...data, createdAt: serverTimestamp() })
  }

  for (const prevId of input.previousActionIds) {
    if (!nextActionIds.includes(prevId)) batch.delete(doc(db, 'tickets', input.ticketId, 'actions', prevId))
  }

  await batch.commit()
}

export async function upsertEmployee(item: { id?: string; name: string }): Promise<void> {
  const db = getDb()
  const name = item.name.trim()
  if (!name) return
  if (item.id) {
    await updateDoc(doc(db, 'employees', item.id), { name })
  } else {
    await addDoc(collection(db, 'employees'), { name })
  }
}

export async function upsertService(item: {
  id?: string
  name: string
  category: ServiceCategory
  description?: string | null
  duration?: string | null
  originalPrice?: number | null
  currentPrice?: number | null
  discount?: boolean | null
  rating?: number | null
  popular?: boolean | null
  contactUsForPrice?: boolean | null
}): Promise<void> {
  const db = getDb()
  const name = item.name.trim()
  if (!name) return
  if (!item.category) throw new Error('Category is required.')
  const data = {
    name,
    category: item.category,
    description: normalizeOptionalText(item.description ?? undefined),
    duration: normalizeOptionalText(item.duration ?? undefined),
    originalPrice: item.originalPrice ?? null,
    currentPrice: item.currentPrice ?? null,
    discount: item.discount ?? null,
    rating: item.rating ?? null,
    popular: item.popular ?? null,
    contactUsForPrice: item.contactUsForPrice ?? null,
  }
  if (item.id) {
    await updateDoc(doc(db, 'services', item.id), data)
  } else {
    await addDoc(collection(db, 'services'), data)
  }
}

export async function deleteCatalogItem(collectionName: 'employees' | 'services', id: string): Promise<void> {
  const db = getDb()
  await deleteDoc(doc(db, collectionName, id))
}

export async function ensureCatalogSeed(collectionName: 'employees' | 'services', names: string[]): Promise<void> {
  const db: Firestore = getDb()
  const q = query(collection(db, collectionName), limit(500))
  const snap = await getDocs(q)
  const existing = new Set(snap.docs.map((d) => String((d.data() as { name?: string }).name ?? '').toLowerCase()))

  const batch = writeBatch(db)
  let pending = 0
  for (const name of names) {
    const trimmed = name.trim()
    if (!trimmed) continue
    if (existing.has(trimmed.toLowerCase())) continue
    batch.set(doc(collection(db, collectionName)), { name: trimmed })
    pending += 1
  }

  if (pending) await batch.commit()
}

export type WatchLedgerFilters = {
  start: Date
  endExclusive: Date
  max?: number
}

export function watchLedgerEntriesForRange(
  filters: WatchLedgerFilters,
  onChange: (entries: LedgerEntry[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getDb()
  const q = query(
    collection(db, 'ledger'),
    where('date', '>=', Timestamp.fromDate(filters.start)),
    where('date', '<', Timestamp.fromDate(filters.endExclusive)),
    orderBy('date', 'desc'),
    limit(filters.max ?? 500),
  )
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => withId<LedgerEntry>(d))),
    (err) => onError?.(err as Error),
  )
}

export async function addManualIncome(input: {
  serviceId: string
  serviceName: string
  date: Date
  amount: number
}): Promise<void> {
  const db = getDb()
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be a positive number.')
  await addDoc(collection(db, 'ledger'), {
    type: 'INCOME',
    serviceId: input.serviceId,
    serviceName: input.serviceName,
    ticketId: null,
    billId: null,
    date: Timestamp.fromDate(input.date),
    amount,
    createdAt: serverTimestamp(),
  })
}

export async function addExpense(input: { reason: string; date: Date; amount: number }): Promise<void> {
  const db = getDb()
  const amount = Number(input.amount)
  const reason = input.reason.trim()
  if (!reason) throw new Error('Reason is required.')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be a positive number.')
  await addDoc(collection(db, 'ledger'), {
    type: 'EXPENSE',
    reason,
    date: Timestamp.fromDate(input.date),
    amount,
    createdAt: serverTimestamp(),
  })
}

export async function updateLedgerEntry(input: {
  entryId: string
  type: 'INCOME' | 'EXPENSE'
  date: Date
  amount: number
  serviceId?: string
  serviceName?: string
  reason?: string
}): Promise<void> {
  const db = getDb()
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Amount must be a number (0 or more).')

  const patch: Record<string, unknown> = {
    type: input.type,
    amount,
    date: Timestamp.fromDate(input.date),
  }

  if (input.type === 'INCOME') {
    if (!input.serviceId || !input.serviceName) throw new Error('Service is required for income.')
    patch.serviceId = input.serviceId
    patch.serviceName = input.serviceName
    patch.reason = null
  } else {
    const reason = (input.reason ?? '').trim()
    if (!reason) throw new Error('Reason is required for expense.')
    patch.reason = reason
    patch.serviceId = null
    patch.serviceName = null
  }

  await updateDoc(doc(db, 'ledger', input.entryId), patch)
}

export async function deleteLedgerEntry(entryId: string): Promise<void> {
  const db = getDb()
  await deleteDoc(doc(db, 'ledger', entryId))
}

export async function completeServiceAndRecordIncome(input: {
  ticketId: string
  serviceId: string
  serviceName: string
  amount: number
  date?: Date
}): Promise<void> {
  const db = getDb()
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Amount must be a number (0 or more).')

  const batch = writeBatch(db)
  const completedAt = serverTimestamp()
  const date = input.date ?? new Date()

  batch.update(doc(db, 'tickets', input.ticketId, 'serviceItems', input.serviceId), {
    isCompleted: true,
    completedAt,
    updatedAt: serverTimestamp(),
  })
  batch.set(
    doc(db, 'appointments', `${input.ticketId}__${input.serviceId}`),
    { isCompleted: true, updatedAt: serverTimestamp() },
    { merge: true },
  )
  batch.update(doc(db, 'tickets', input.ticketId), { updatedAt: serverTimestamp() })

  batch.set(doc(collection(db, 'ledger')), {
    type: 'INCOME',
    ticketId: input.ticketId,
    billId: null,
    serviceId: input.serviceId,
    serviceName: input.serviceName,
    date: Timestamp.fromDate(date),
    amount,
    createdAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function createBillAndIncomeEntries(input: {
  date: Date
  lines: { serviceId: string; serviceName: string; unitAmount: number; quantity: number }[]
}): Promise<{ billId: string; entries: LedgerEntry[] }> {
  const db = getDb()
  const date = input.date
  const ts = Timestamp.fromDate(date)

  const lines = input.lines
    .map((l) => ({ ...l, unitAmount: Number(l.unitAmount), quantity: Number(l.quantity) }))
    .filter((l) => l.serviceId && l.serviceName.trim() && Number.isFinite(l.unitAmount) && l.unitAmount > 0 && Number.isFinite(l.quantity) && l.quantity >= 1)
    .map((l) => ({ ...l, quantity: Math.min(99, Math.floor(l.quantity)) }))

  if (!lines.length) throw new Error('Add at least 1 service with a valid quantity and amount.')

  const billRef = doc(collection(db, 'bills'))
  const billId = billRef.id

  const batch = writeBatch(db)
  const entries: LedgerEntry[] = []
  const totalAmount = lines.reduce((sum, l) => sum + l.unitAmount * l.quantity, 0)
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0)

  batch.set(billRef, {
    date: ts,
    totalAmount,
    itemCount,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  for (const line of lines) {
    for (let i = 0; i < line.quantity; i += 1) {
      const entryRef = doc(collection(db, 'ledger'))
      batch.set(entryRef, {
        type: 'INCOME',
        billId,
        ticketId: null,
        serviceId: line.serviceId,
        serviceName: line.serviceName,
        date: ts,
        amount: line.unitAmount,
        createdAt: serverTimestamp(),
      })
      entries.push({
        id: entryRef.id,
        type: 'INCOME',
        billId,
        ticketId: null,
        serviceId: line.serviceId,
        serviceName: line.serviceName,
        date: ts,
        amount: line.unitAmount,
      })
    }
  }

  await batch.commit()
  return { billId, entries }
}
