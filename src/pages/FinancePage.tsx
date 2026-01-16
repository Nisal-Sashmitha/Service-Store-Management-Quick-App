import { useMemo, useState } from 'react'
import { addDays, addMonths, format, startOfDay, startOfMonth } from 'date-fns'
import { ErrorBanner } from '../components/ErrorBanner'
import { FinanceEntryModal, type FinanceModalMode } from '../components/FinanceEntryModal'
import { TopBar } from '../components/TopBar'
import { useLedgerEntries } from '../hooks/useLedgerEntries'
import { useServices } from '../hooks/useServices'
import type { LedgerEntry } from '../lib/types'

function parseDateOnly(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const [y, m, d] = trimmed.split('-').map((v) => Number(v))
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

export function FinancePage() {
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily')
  const today = useMemo(() => new Date(), [])
  const [day, setDay] = useState(() => format(today, 'yyyy-MM-dd'))
  const [month, setMonth] = useState(() => startOfMonth(today))
  const [isGeneratingBill, setIsGeneratingBill] = useState(false)

  const dayStart = useMemo(() => startOfDay(parseDateOnly(day) ?? today), [day, today])
  const dayEndExclusive = useMemo(() => addDays(dayStart, 1), [dayStart])

  const monthStart = useMemo(() => startOfMonth(month), [month])
  const monthEndExclusive = useMemo(() => addMonths(monthStart, 1), [monthStart])

  const range = useMemo(
    () => (viewMode === 'daily' ? { start: dayStart, endExclusive: dayEndExclusive } : { start: monthStart, endExclusive: monthEndExclusive }),
    [dayEndExclusive, dayStart, monthEndExclusive, monthStart, viewMode],
  )

  const { services, error: servicesError } = useServices()
  const { entries, error } = useLedgerEntries({ start: range.start, endExclusive: range.endExclusive, max: 500 })

  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<FinanceModalMode>('choose')
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null)
  const [selectedIncomeIds, setSelectedIncomeIds] = useState<Set<string>>(() => new Set())

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const e of entries) {
      if (e.type === 'INCOME') income += e.amount ?? 0
      else if (e.type === 'EXPENSE') expense += e.amount ?? 0
    }
    return { income, expense }
  }, [entries])

  const sortedEntries = useMemo(() => {
    const getMillis = (entry: LedgerEntry) => entry.createdAt?.toMillis() ?? entry.date?.toMillis() ?? 0
    return [...entries].sort((a, b) => getMillis(b) - getMillis(a))
  }, [entries])

  const selectedIncomeEntries = useMemo(
    () => sortedEntries.filter((e) => e.type === 'INCOME' && selectedIncomeIds.has(e.id)),
    [sortedEntries, selectedIncomeIds],
  )

  const allIncomeIdsInView = useMemo(() => sortedEntries.filter((e) => e.type === 'INCOME').map((e) => e.id), [sortedEntries])

  return (
    <div className="page">
      <TopBar title="Income & Expenses" />

      {error ? <ErrorBanner message={error} /> : null}
      {servicesError ? <ErrorBanner message={servicesError} /> : null}

      <section className="card">
        <div className="row rowBetween">
          <div className="row">
            <button
              className={viewMode === 'daily' ? 'buttonPrimary' : 'buttonSecondary'}
              type="button"
              onClick={() => {
                setViewMode('daily')
                setSelectedIncomeIds(new Set())
              }}
            >
              Daily
            </button>
            <button
              className={viewMode === 'monthly' ? 'buttonPrimary' : 'buttonSecondary'}
              type="button"
              onClick={() => {
                setViewMode('monthly')
                setSelectedIncomeIds(new Set())
              }}
            >
              Monthly
            </button>
          </div>
          <button
            className="buttonPrimary"
            type="button"
            onClick={() => {
              setEditingEntry(null)
              setModalMode('choose')
              setShowModal(true)
            }}
          >
            + Add
          </button>
        </div>
        {viewMode === 'daily' ? (
          <div className="grid2" style={{ marginTop: 12 }}>
            <div className="field">
              <label className="label">Date</label>
              <input
                className="input"
                type="date"
                value={day}
                onChange={(e) => {
                  setDay(e.target.value)
                  setSelectedIncomeIds(new Set())
                }}
              />
            </div>
            <div className="field">
              <label className="label">Quick select</label>
              <div className="row">
                <button className="buttonSecondary" type="button" onClick={() => setSelectedIncomeIds(new Set(allIncomeIdsInView))}>
                  Select all income
                </button>
                <button className="buttonSecondary" type="button" onClick={() => setSelectedIncomeIds(new Set())}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="row rowBetween" style={{ marginTop: 12 }}>
            <div className="row">
              <button
                className="buttonSecondary"
                type="button"
                onClick={() => {
                  setMonth((m) => addMonths(m, -1))
                  setSelectedIncomeIds(new Set())
                }}
              >
                ←
              </button>
              <div className="calendarTitle">{format(monthStart, 'MMMM yyyy')}</div>
              <button
                className="buttonSecondary"
                type="button"
                onClick={() => {
                  setMonth((m) => addMonths(m, 1))
                  setSelectedIncomeIds(new Set())
                }}
              >
                →
              </button>
            </div>
            <div className="row">
              <button className="buttonSecondary" type="button" onClick={() => setSelectedIncomeIds(new Set(allIncomeIdsInView))}>
                Select all income
              </button>
              <button className="buttonSecondary" type="button" onClick={() => setSelectedIncomeIds(new Set())}>
                Clear
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="grid2">
          <div className="subCard">
            <div className="label">Total income</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{totals.income.toFixed(0)}</div>
          </div>
          <div className="subCard">
            <div className="label">Total expenses</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{totals.expense.toFixed(0)}</div>
          </div>
        </div>
        <div className="row rowBetween" style={{ marginTop: 12 }}>
          <div className="mutedSmall">Selected income: {selectedIncomeEntries.length}</div>
            <button
              className="buttonPrimary"
              type="button"
              disabled={selectedIncomeEntries.length === 0 || isGeneratingBill}
              onClick={async () => {
                try {
                  setIsGeneratingBill(true)
                  const base = viewMode === 'daily' ? `bill-${day}` : `bill-${format(monthStart, 'yyyy-MM')}`
                  const { downloadIncomeBillPdf } = await import('../lib/billing')
                  await downloadIncomeBillPdf({ entries: selectedIncomeEntries, filenameBase: base, title: 'Salon Bill' })
                } catch (e) {
                  alert((e as Error).message)
                } finally {
                  setIsGeneratingBill(false)
                }
              }}
            >
              {isGeneratingBill ? 'Generating...' : 'Generate bill (PDF)'}
            </button>
        </div>
      </section>

      <section className="stack">
        {sortedEntries.length ? (
          sortedEntries.map((e) => (
            <div
              key={e.id}
              className={`ticketRow financeEntry ${e.type === 'INCOME' ? 'financeEntryIncome' : 'financeEntryExpense'}`}
            >
              <div className="ticketRowTop">
                <div className="row" style={{ gap: 10 }}>
                  {e.type === 'INCOME' ? (
                    <label className="checkboxInline">
                      <input
                        type="checkbox"
                        checked={selectedIncomeIds.has(e.id)}
                        onChange={() =>
                          setSelectedIncomeIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(e.id)) next.delete(e.id)
                            else next.add(e.id)
                            return next
                          })
                        }
                      />
                    </label>
                  ) : (
                    <span style={{ width: 22 }} />
                  )}
                  <div className="financeEntryLeft">
                    <div className="financeEntryType">{e.type === 'INCOME' ? 'Income' : 'Expense'}</div>
                    <div className="financeEntryName">{e.type === 'INCOME' ? e.serviceName ?? '-' : e.reason ?? '-'}</div>
                  </div>
                </div>
                <span
                  className={`pill financeEntryAmount ${
                    e.type === 'INCOME' ? 'pillConfirm_FULLY_CONFIRMED' : 'pillConfirm_PARTIALLY_CONFIRMED'
                  }`}
                >
                  {e.amount.toFixed(0)}
                </span>
              </div>
              <div className="ticketMeta">
                <span className="mutedSmall">{e.date?.toDate ? format(e.date.toDate(), 'MMM d') : ''}</span>
                <span className="dot">•</span>
                <span className="mutedSmall">{e.type === 'INCOME' ? e.serviceName ?? '—' : e.reason ?? '—'}</span>
              </div>
              <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
                <button
                  className="buttonSecondary"
                  type="button"
                  onClick={() => {
                    setEditingEntry(e)
                    setShowModal(true)
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="muted">No entries for this view.</div>
        )}
      </section>

      {showModal ? (
        <FinanceEntryModal
          mode={modalMode}
          services={services}
          entryToEdit={editingEntry}
          onModeChange={setModalMode}
          onClose={() => {
            setShowModal(false)
            setEditingEntry(null)
          }}
        />
      ) : null}
    </div>
  )
}
