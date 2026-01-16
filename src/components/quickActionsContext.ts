import { createContext, useContext } from 'react'
import type { FinanceModalMode } from './FinanceEntryModal'

export type QuickActionsApi = {
  openFinance: (mode?: FinanceModalMode) => void
  openBill: () => void
}

export const QuickActionsContext = createContext<QuickActionsApi | null>(null)

export function useQuickActions(): QuickActionsApi {
  const ctx = useContext(QuickActionsContext)
  if (!ctx) throw new Error('useQuickActions must be used within QuickActionsProvider')
  return ctx
}

