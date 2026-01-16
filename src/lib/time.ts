import { format, parseISO } from 'date-fns'
import type { Timestamp } from 'firebase/firestore'

export function toDateInputValue(ts?: Timestamp | null): string {
  if (!ts) return ''
  return format(ts.toDate(), "yyyy-MM-dd'T'HH:mm")
}

export function parseDateInputValue(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = parseISO(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDateTimeShort(date: Date): string {
  return format(date, 'MMM d, HH:mm')
}

export function formatDateShort(date: Date): string {
  return format(date, 'MMM d')
}

export function formatTimeShort(date: Date): string {
  return format(date, 'HH:mm')
}

