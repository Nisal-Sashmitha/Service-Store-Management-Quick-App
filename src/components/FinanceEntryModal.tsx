import { useMemo, useState } from 'react'
import type { LedgerEntry, ServiceCatalogItem } from '../lib/types'
import { addExpense, addManualIncome, deleteLedgerEntry, updateLedgerEntry } from '../lib/firestore'
import { ErrorBanner } from './ErrorBanner'
import { ModalShell } from './ModalShell'

function parseLocalDateInput(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const [y, m, d] = trimmed.split('-').map((v) => Number(v))
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function toDateInputValue(entry?: LedgerEntry | null): string {
  if (!entry?.date?.toDate) return new Date().toISOString().slice(0, 10)
  return entry.date.toDate().toISOString().slice(0, 10)
}

function suggestedAmount(service?: ServiceCatalogItem | null): number | null {
  if (!service) return null
  if (typeof service.currentPrice === 'number') return service.currentPrice
  if (typeof service.originalPrice === 'number') return service.originalPrice
  return null
}

export type FinanceModalMode = 'choose' | 'income' | 'expense'

export function FinanceEntryModal(props: {
  mode: FinanceModalMode
  services: ServiceCatalogItem[]
  entryToEdit?: LedgerEntry | null
  onClose: () => void
  onModeChange: (mode: FinanceModalMode) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'income' | 'expense' | 'delete' | null>(null)

  const editing = Boolean(props.entryToEdit)
  const editType = props.entryToEdit?.type
  const showIncome = (editing && editType === 'INCOME') || (!editing && props.mode === 'income')
  const showExpense = (editing && editType === 'EXPENSE') || (!editing && props.mode === 'expense')

  const initialIncome =
    props.entryToEdit && props.entryToEdit.type === 'INCOME'
      ? {
          serviceId: props.entryToEdit.serviceId ?? '',
          serviceName: props.entryToEdit.serviceName ?? '',
          date: toDateInputValue(props.entryToEdit),
          amount: String(props.entryToEdit.amount ?? ''),
        }
      : null

  const initialExpense =
    props.entryToEdit && props.entryToEdit.type === 'EXPENSE'
      ? {
          reason: props.entryToEdit.reason ?? '',
          date: toDateInputValue(props.entryToEdit),
          amount: String(props.entryToEdit.amount ?? ''),
        }
      : null

  const [incomeServiceQuery, setIncomeServiceQuery] = useState(initialIncome?.serviceName ?? '')
  const [incomeServiceId, setIncomeServiceId] = useState(initialIncome?.serviceId ?? '')
  const [incomeDate, setIncomeDate] = useState(() => initialIncome?.date ?? new Date().toISOString().slice(0, 10))
  const [incomeAmount, setIncomeAmount] = useState(initialIncome?.amount ?? '')

  const [expenseReason, setExpenseReason] = useState(initialExpense?.reason ?? '')
  const [expenseDate, setExpenseDate] = useState(() => initialExpense?.date ?? new Date().toISOString().slice(0, 10))
  const [expenseAmount, setExpenseAmount] = useState(initialExpense?.amount ?? '')

  const selectedIncomeService = useMemo(
    () => props.services.find((s) => s.id === incomeServiceId) ?? null,
    [incomeServiceId, props.services],
  )

  const matches = useMemo(() => {
    const q = incomeServiceQuery.trim().toLowerCase()
    const base = q ? props.services.filter((s) => s.name.toLowerCase().includes(q)) : props.services
    return base.slice(0, 30)
  }, [incomeServiceQuery, props.services])

  async function submitIncome() {
    if (busyAction) return
    setError(null)
    const svc = props.services.find((s) => s.id === incomeServiceId)
    if (!svc) {
      setError('Select a service.')
      return
    }
    const date = parseLocalDateInput(incomeDate)
    if (!date) {
      setError('Select a date.')
      return
    }
    const amount = Number(incomeAmount)
    setBusyAction('income')
    try {
      if (editing && props.entryToEdit) {
        await updateLedgerEntry({
          entryId: props.entryToEdit.id,
          type: 'INCOME',
          serviceId: svc.id,
          serviceName: svc.name,
          date,
          amount,
        })
      } else {
        await addManualIncome({ serviceId: svc.id, serviceName: svc.name, date, amount })
      }
      props.onClose()
    } catch (e) {
      setError((e as Error).message)
      setBusyAction(null)
    }
  }

  async function submitExpense() {
    if (busyAction) return
    setError(null)
    const date = parseLocalDateInput(expenseDate)
    if (!date) {
      setError('Select a date.')
      return
    }
    const amount = Number(expenseAmount)
    setBusyAction('expense')
    try {
      if (editing && props.entryToEdit) {
        await updateLedgerEntry({
          entryId: props.entryToEdit.id,
          type: 'EXPENSE',
          reason: expenseReason,
          date,
          amount,
        })
      } else {
        await addExpense({ reason: expenseReason, date, amount })
      }
      props.onClose()
    } catch (e) {
      setError((e as Error).message)
      setBusyAction(null)
    }
  }

  async function doDelete() {
    if (busyAction) return
    if (!props.entryToEdit) return
    if (!confirm('Delete this entry?')) return
    setError(null)
    setBusyAction('delete')
    try {
      await deleteLedgerEntry(props.entryToEdit.id)
      props.onClose()
    } catch (e) {
      setError((e as Error).message)
      setBusyAction(null)
    }
  }

  const suggested = suggestedAmount(selectedIncomeService)

  return (
    <ModalShell onClose={props.onClose}>
      <div className="row rowBetween">
        <div className="sectionTitle">{editing ? 'Edit entry' : 'Add income / expense'}</div>
        <button className="buttonSecondary" type="button" disabled={busyAction !== null} onClick={props.onClose}>
          Close
        </button>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {!editing && props.mode === 'choose' ? (
        <div className="stack">
          <button className="buttonPrimary" type="button" onClick={() => props.onModeChange('income')}>
            Add income
          </button>
          <button className="buttonPrimary" type="button" onClick={() => props.onModeChange('expense')}>
            Add expense
          </button>
        </div>
      ) : null}

      {showIncome ? (
        <div className="stack">
          <div className="field">
            <label className="label">Service (type to search)</label>
            <input
              className="input"
              type="text"
              placeholder="Start typing a service name…"
              value={incomeServiceQuery}
              onChange={(e) => {
                setIncomeServiceQuery(e.target.value)
              }}
            />
            <div className="suggestList">
              {matches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={s.id === incomeServiceId ? 'suggestItem suggestItemActive' : 'suggestItem'}
                  onClick={() => {
                    setIncomeServiceId(s.id)
                    setIncomeServiceQuery(s.name)
                    const sug = suggestedAmount(s)
                    if (!incomeAmount.trim() && typeof sug === 'number') setIncomeAmount(String(sug))
                  }}
                >
                  <div style={{ fontWeight: 850 }}>{s.name}</div>
                  <div className="mutedSmall">
                    {s.category ?? '—'}
                    {typeof s.currentPrice === 'number' ? ` · ${s.currentPrice}` : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedIncomeService ? (
            <div className="subCard">
              <div className="mutedSmall">
                Suggested amount:{' '}
                {typeof suggested === 'number' ? (
                  <span className="mono">{suggested}</span>
                ) : (
                  <span className="mutedSmall">No default price</span>
                )}
              </div>
              {typeof suggested === 'number' ? (
                <button className="buttonSecondary" type="button" onClick={() => setIncomeAmount(String(suggested))}>
                  Use suggested amount
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="grid2">
            <div className="field">
              <label className="label">Date</label>
              <input className="input" type="date" value={incomeDate} onChange={(e) => setIncomeDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Amount</label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={incomeAmount}
                onChange={(e) => setIncomeAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="row rowBetween">
            {!editing ? (
              <button className="buttonSecondary" type="button" disabled={busyAction !== null} onClick={() => props.onModeChange('choose')}>
                Back
              </button>
            ) : (
              <span />
            )}
            <div className="row">
              {editing ? (
                <button className="buttonSecondary" type="button" disabled={busyAction !== null} onClick={doDelete}>
                  {busyAction === 'delete' ? 'Deleting...' : 'Delete'}
                </button>
              ) : null}
              <button className="buttonPrimary" type="button" disabled={busyAction !== null} onClick={submitIncome}>
                {busyAction === 'income' ? 'Saving...' : editing ? 'Save changes' : 'Save income'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showExpense ? (
        <div className="stack">
          <div className="field">
            <label className="label">Reason / description</label>
            <input className="input" type="text" value={expenseReason} onChange={(e) => setExpenseReason(e.target.value)} />
          </div>
          <div className="grid2">
            <div className="field">
              <label className="label">Date</label>
              <input className="input" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Amount</label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="row rowBetween">
            {!editing ? (
              <button className="buttonSecondary" type="button" disabled={busyAction !== null} onClick={() => props.onModeChange('choose')}>
                Back
              </button>
            ) : (
              <span />
            )}
            <div className="row">
              {editing ? (
                <button className="buttonSecondary" type="button" disabled={busyAction !== null} onClick={doDelete}>
                  {busyAction === 'delete' ? 'Deleting...' : 'Delete'}
                </button>
              ) : null}
              <button className="buttonPrimary" type="button" disabled={busyAction !== null} onClick={submitExpense}>
                {busyAction === 'expense' ? 'Saving...' : editing ? 'Save changes' : 'Save expense'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ModalShell>
  )
}
