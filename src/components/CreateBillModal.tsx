import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import type { ServiceCatalogItem } from '../lib/types'
import { createBillAndIncomeEntries } from '../lib/firestore'
import { ErrorBanner } from './ErrorBanner'
import { ModalShell } from './ModalShell'

function parseLocalDateInput(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const [y, m, d] = trimmed.split('-').map((v) => Number(v))
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function suggestedAmount(service?: ServiceCatalogItem | null): number | null {
  if (!service) return null
  if (typeof service.currentPrice === 'number') return service.currentPrice
  if (typeof service.originalPrice === 'number') return service.originalPrice
  return null
}

type BillLine = {
  serviceId: string
  serviceName: string
  unitAmount: string
  quantity: number
}

export function CreateBillModal(props: { services: ServiceCatalogItem[]; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'create' | 'download' | null>(null)
  const [serviceQuery, setServiceQuery] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<BillLine[]>([])

  const matches = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase()
    const base = q ? props.services.filter((s) => s.name.toLowerCase().includes(q)) : props.services
    return base.slice(0, 30)
  }, [props.services, serviceQuery])

  const total = useMemo(() => {
    return lines.reduce((sum, l) => sum + (Number(l.unitAmount) || 0) * (Number(l.quantity) || 0), 0)
  }, [lines])

  function addService(service: ServiceCatalogItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.serviceId === service.id)
      if (existing) return prev.map((l) => (l.serviceId === service.id ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l))
      const sug = suggestedAmount(service)
      return [
        ...prev,
        {
          serviceId: service.id,
          serviceName: service.name,
          unitAmount: typeof sug === 'number' ? String(sug) : '',
          quantity: 1,
        },
      ]
    })
    setServiceQuery('')
  }

  async function createBill(options: { downloadPdf: boolean }) {
    if (busyAction) return
    setError(null)
    const parsedDate = parseLocalDateInput(date)
    if (!parsedDate) {
      setError('Select a bill date.')
      return
    }

    setBusyAction(options.downloadPdf ? 'download' : 'create')
    try {
      const { billId, entries } = await createBillAndIncomeEntries({
        date: parsedDate,
        lines: lines.map((l) => ({
          serviceId: l.serviceId,
          serviceName: l.serviceName,
          unitAmount: Number(l.unitAmount),
          quantity: Number(l.quantity) || 0,
        })),
      })

      if (options.downloadPdf) {
        const { downloadIncomeBillPdf } = await import('../lib/billing')
        await downloadIncomeBillPdf({
          entries,
          filenameBase: `bill-${format(parsedDate, 'yyyy-MM-dd')}-${billId.slice(0, 6)}`,
          title: 'Salon Bill',
        })
      }

      props.onClose()
    } catch (e) {
      setError((e as Error).message)
      setBusyAction(null)
    }
  }

  return (
    <ModalShell onClose={props.onClose}>
      <div className="row rowBetween">
        <div className="sectionTitle">New bill</div>
        <button className="buttonSecondary" type="button" disabled={busyAction !== null} onClick={props.onClose}>
          Close
        </button>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="stack">
        <div className="grid2">
          <div className="field">
            <label className="label">Bill date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="subCard">
            <div className="label">Total</div>
            <div style={{ fontWeight: 950, fontSize: 22 }}>{total.toFixed(0)}</div>
          </div>
        </div>

        <div className="field">
          <label className="label">Add services (type to search)</label>
          <input
            className="input"
            type="text"
            placeholder="Start typing a service name..."
            value={serviceQuery}
            onChange={(e) => setServiceQuery(e.target.value)}
          />
          <div className="suggestList">
            {matches.map((s) => (
              <button
                key={s.id}
                type="button"
                className={lines.some((l) => l.serviceId === s.id) ? 'suggestItem suggestItemActive' : 'suggestItem'}
                onClick={() => addService(s)}
              >
                <div style={{ fontWeight: 850 }}>{s.name}</div>
                <div className="mutedSmall">
                  {s.category ?? '-'}
                  {typeof s.currentPrice === 'number' ? ` • ${s.currentPrice}` : typeof s.originalPrice === 'number' ? ` • ${s.originalPrice}` : ''}
                </div>
              </button>
            ))}
          </div>
        </div>

        {lines.length ? (
          <div className="stack">
            <div className="sectionTitle">Items</div>
            {lines.map((l) => (
              <div key={l.serviceId} className="subCard">
                <div className="row rowBetween" style={{ alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 900 }}>{l.serviceName}</div>
                  <button
                    className="buttonSecondary"
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((x) => x.serviceId !== l.serviceId))}
                  >
                    Remove
                  </button>
                </div>
                <div className="grid2" style={{ marginTop: 10 }}>
                  <div className="field">
                    <label className="label">Quantity</label>
                    <div className="qtyControl">
                      <button
                        className="buttonSecondary qtyButton"
                        type="button"
                        onClick={() =>
                          setLines((prev) =>
                            prev.map((x) => (x.serviceId === l.serviceId ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)),
                          )
                        }
                      >
                        −
                      </button>
                      <input
                        className="input qtyInput"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={99}
                        value={l.quantity}
                        onChange={(e) => {
                          const next = Math.max(1, Math.min(99, Number(e.target.value) || 1))
                          setLines((prev) => prev.map((x) => (x.serviceId === l.serviceId ? { ...x, quantity: next } : x)))
                        }}
                      />
                      <button
                        className="buttonSecondary qtyButton"
                        type="button"
                        onClick={() =>
                          setLines((prev) =>
                            prev.map((x) => (x.serviceId === l.serviceId ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x)),
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Unit price</label>
                    <input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      value={l.unitAmount}
                      onChange={(e) =>
                        setLines((prev) => prev.map((x) => (x.serviceId === l.serviceId ? { ...x, unitAmount: e.target.value } : x)))
                      }
                    />
                  </div>
                </div>
                <div className="row rowBetween" style={{ marginTop: 8 }}>
                  <span className="mutedSmall">Line total</span>
                  <span className="mono">{(((Number(l.unitAmount) || 0) * (Number(l.quantity) || 0)) as number).toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">Add at least 1 service to create a bill.</div>
        )}

        <div className="row rowBetween">
          <button className="buttonSecondary" type="button" onClick={() => setLines([])} disabled={!lines.length || busyAction !== null}>
            Clear
          </button>
          <div className="row">
            <button
              className="buttonSecondary"
              type="button"
              disabled={!lines.length || busyAction !== null}
              onClick={() => void createBill({ downloadPdf: false })}
            >
              {busyAction === 'create' ? 'Creating...' : 'Create'}
            </button>
            <button
              className="buttonPrimary"
              type="button"
              disabled={!lines.length || busyAction !== null}
              onClick={() => void createBill({ downloadPdf: true })}
            >
              {busyAction === 'download' ? 'Creating & downloading...' : 'Create & download PDF'}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
