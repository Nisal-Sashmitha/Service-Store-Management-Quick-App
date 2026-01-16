import { useEffect, useMemo, useState } from 'react'
import { ErrorBanner } from '../components/ErrorBanner'
import { TopBar } from '../components/TopBar'
import { useEmployees } from '../hooks/useEmployees'
import { useServices } from '../hooks/useServices'
import { deleteCatalogItem, upsertEmployee, upsertService } from '../lib/firestore'
import { SERVICE_CATEGORIES, type ServiceCategory, type ServiceCatalogItem } from '../lib/types'

function parseOptionalNumber(value: string): number | null | 'invalid' {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return 'invalid'
  return n
}

function EmployeesSection(props: { items: { id: string; name: string }[] }) {
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState<{ id: string; action: 'add' | 'save' | 'delete' } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const initialEdits = useMemo(() => {
    const map = new Map<string, string>()
    for (const i of props.items) map.set(i.id, i.name)
    return map
  }, [props.items])

  const [edits, setEdits] = useState<Map<string, string>>(initialEdits)
  useEffect(() => setEdits(initialEdits), [initialEdits])

  async function add() {
    setError(null)
    const name = newName.trim()
    if (!name) return
    setBusy({ id: 'new', action: 'add' })
    try {
      await upsertEmployee({ name })
      setNewName('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function save(id: string) {
    setError(null)
    const name = (edits.get(id) ?? '').trim()
    if (!name) return
    setBusy({ id, action: 'save' })
    try {
      await upsertEmployee({ id, name })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this employee?')) return
    setError(null)
    setBusy({ id, action: 'delete' })
    try {
      await deleteCatalogItem('employees', id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card">
      <div className="sectionTitle">Employees</div>
      {error ? <ErrorBanner message={error} /> : null}

      <div className="row">
        <input className="input" type="text" placeholder="Add employee…" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="buttonPrimary" type="button" onClick={add} disabled={!newName.trim() || busy !== null}>
          {busy?.id === 'new' && busy.action === 'add' ? 'Adding...' : 'Add'}
        </button>
      </div>

      <div className="stack" style={{ marginTop: 12 }}>
        {props.items.length ? (
          props.items.map((i) => (
            <div key={i.id} className="row" style={{ alignItems: 'stretch' }}>
              <input
                className="input"
                type="text"
                value={edits.get(i.id) ?? i.name}
                onChange={(e) =>
                  setEdits((prev) => {
                    const next = new Map(prev)
                    next.set(i.id, e.target.value)
                    return next
                  })
                }
              />
              <button className="buttonSecondary" type="button" onClick={() => save(i.id)} disabled={busy !== null}>
                {busy?.id === i.id && busy.action === 'save' ? 'Saving...' : 'Save'}
              </button>
              <button className="buttonSecondary" type="button" onClick={() => remove(i.id)} disabled={busy !== null}>
                {busy?.id === i.id && busy.action === 'delete' ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          ))
        ) : (
          <div className="muted">No employees yet.</div>
        )}
      </div>
    </section>
  )
}

type ServiceEdit = {
  name: string
  category: ServiceCategory | ''
  description: string
  duration: string
  originalPrice: string
  currentPrice: string
  discount: boolean
  popular: boolean
  rating: string
  contactUsForPrice: boolean
}

function toEdit(s: ServiceCatalogItem): ServiceEdit {
  return {
    name: s.name ?? '',
    category: s.category ?? '',
    description: s.description ?? '',
    duration: s.duration ?? '',
    originalPrice: typeof s.originalPrice === 'number' ? String(s.originalPrice) : '',
    currentPrice: typeof s.currentPrice === 'number' ? String(s.currentPrice) : '',
    discount: Boolean(s.discount),
    popular: Boolean(s.popular),
    rating: typeof s.rating === 'number' ? String(s.rating) : '',
    contactUsForPrice: Boolean(s.contactUsForPrice),
  }
}

function ServicesSection(props: { items: ServiceCatalogItem[] }) {
  const [busy, setBusy] = useState<{ id: string; action: 'add' | 'save' | 'delete' } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [newItem, setNewItem] = useState<ServiceEdit>(() => ({
    name: '',
    category: 'beauty',
    description: '',
    duration: '',
    originalPrice: '',
    currentPrice: '',
    discount: false,
    popular: false,
    rating: '',
    contactUsForPrice: false,
  }))

  const initialEdits = useMemo(() => {
    const map = new Map<string, ServiceEdit>()
    for (const i of props.items) map.set(i.id, toEdit(i))
    return map
  }, [props.items])

  const [edits, setEdits] = useState<Map<string, ServiceEdit>>(initialEdits)
  useEffect(() => setEdits(initialEdits), [initialEdits])

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function add() {
    setError(null)
    const name = newItem.name.trim()
    const category = newItem.category
    if (!name) return
    if (!category) {
      setError('Select a category.')
      return
    }

    const originalPrice = parseOptionalNumber(newItem.originalPrice)
    const currentPrice = parseOptionalNumber(newItem.currentPrice)
    const rating = parseOptionalNumber(newItem.rating)
    if (originalPrice === 'invalid' || currentPrice === 'invalid' || rating === 'invalid') {
      setError('Invalid number in price/rating fields.')
      return
    }

    setBusy({ id: 'new', action: 'add' })
    try {
      await upsertService({
        name,
        category,
        description: newItem.description,
        duration: newItem.duration,
        originalPrice,
        currentPrice,
        discount: newItem.discount,
        popular: newItem.popular,
        rating,
        contactUsForPrice: newItem.contactUsForPrice,
      })
      setNewItem({
        name: '',
        category: 'beauty',
        description: '',
        duration: '',
        originalPrice: '',
        currentPrice: '',
        discount: false,
        popular: false,
        rating: '',
        contactUsForPrice: false,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function save(id: string) {
    setError(null)
    const patch = edits.get(id)
    if (!patch) return
    const name = patch.name.trim()
    const category = patch.category
    if (!name) return
    if (!category) {
      setError('Select a category.')
      return
    }

    const originalPrice = parseOptionalNumber(patch.originalPrice)
    const currentPrice = parseOptionalNumber(patch.currentPrice)
    const rating = parseOptionalNumber(patch.rating)
    if (originalPrice === 'invalid' || currentPrice === 'invalid' || rating === 'invalid') {
      setError('Invalid number in price/rating fields.')
      return
    }

    setBusy({ id, action: 'save' })
    try {
      await upsertService({
        id,
        name,
        category,
        description: patch.description,
        duration: patch.duration,
        originalPrice,
        currentPrice,
        discount: patch.discount,
        popular: patch.popular,
        rating,
        contactUsForPrice: patch.contactUsForPrice,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this service?')) return
    setError(null)
    setBusy({ id, action: 'delete' })
    try {
      await deleteCatalogItem('services', id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card">
      <div className="sectionTitle">Services</div>
      {error ? <ErrorBanner message={error} /> : null}

      <div className="subCard">
        <div className="sectionTitle">Add service</div>
        <div className="grid2">
          <div className="field">
            <label className="label">Name</label>
            <input className="input" type="text" placeholder="Service name…" value={newItem.name} onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="field">
            <label className="label">Category</label>
            <select className="select" value={newItem.category} onChange={(e) => setNewItem((p) => ({ ...p, category: e.target.value as ServiceCategory }))}>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid2">
          <div className="field">
            <label className="label">Current price</label>
            <input className="input" type="number" inputMode="decimal" value={newItem.currentPrice} onChange={(e) => setNewItem((p) => ({ ...p, currentPrice: e.target.value }))} />
          </div>
          <div className="field">
            <label className="label">Original price</label>
            <input className="input" type="number" inputMode="decimal" value={newItem.originalPrice} onChange={(e) => setNewItem((p) => ({ ...p, originalPrice: e.target.value }))} />
          </div>
        </div>
        <div className="field">
          <label className="label">Duration</label>
          <input className="input" type="text" value={newItem.duration} onChange={(e) => setNewItem((p) => ({ ...p, duration: e.target.value }))} />
        </div>
        <div className="field">
          <label className="label">Description</label>
          <textarea className="textarea" rows={3} value={newItem.description} onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))} />
        </div>
        <div className="grid2">
          <label className="checkboxRow">
            <input type="checkbox" checked={newItem.discount} onChange={(e) => setNewItem((p) => ({ ...p, discount: e.target.checked }))} />
            <span className="mutedSmall">Discount</span>
          </label>
          <label className="checkboxRow">
            <input type="checkbox" checked={newItem.popular} onChange={(e) => setNewItem((p) => ({ ...p, popular: e.target.checked }))} />
            <span className="mutedSmall">Popular</span>
          </label>
        </div>
        <div className="grid2">
          <div className="field">
            <label className="label">Rating</label>
            <input className="input" type="number" inputMode="decimal" value={newItem.rating} onChange={(e) => setNewItem((p) => ({ ...p, rating: e.target.value }))} />
          </div>
          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={newItem.contactUsForPrice}
              onChange={(e) => setNewItem((p) => ({ ...p, contactUsForPrice: e.target.checked }))}
            />
            <span className="mutedSmall">Contact us for price</span>
          </label>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="buttonPrimary" type="button" onClick={add} disabled={!newItem.name.trim() || busy !== null}>
            {busy?.id === 'new' && busy.action === 'add' ? 'Adding...' : 'Add service'}
          </button>
        </div>
      </div>

      <div className="stack" style={{ marginTop: 12 }}>
        {props.items.length ? (
          props.items.map((i) => {
            const patch = edits.get(i.id) ?? toEdit(i)
            const isExpanded = expanded.has(i.id)
            return (
              <div key={i.id} className="subCard">
                <div className="row rowBetween">
                  <div className="subCardTitle">{i.name}</div>
                  <button className="buttonSecondary" type="button" onClick={() => toggleExpanded(i.id)}>
                    {isExpanded ? 'Less' : 'More'}
                  </button>
                </div>

                <div className="grid2" style={{ marginTop: 10 }}>
                  <div className="field">
                    <label className="label">Name</label>
                    <input
                      className="input"
                      type="text"
                      value={patch.name}
                      onChange={(e) =>
                        setEdits((prev) => {
                          const next = new Map(prev)
                          next.set(i.id, { ...patch, name: e.target.value })
                          return next
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label className="label">Category</label>
                    <select
                      className="select"
                      value={patch.category}
                      onChange={(e) =>
                        setEdits((prev) => {
                          const next = new Map(prev)
                          next.set(i.id, { ...patch, category: e.target.value as ServiceCategory })
                          return next
                        })
                      }
                    >
                      <option value="">Select…</option>
                      {SERVICE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid2" style={{ marginTop: 10 }}>
                  <div className="field">
                    <label className="label">Current price</label>
                    <input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      value={patch.currentPrice}
                      onChange={(e) =>
                        setEdits((prev) => {
                          const next = new Map(prev)
                          next.set(i.id, { ...patch, currentPrice: e.target.value })
                          return next
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label className="label">Original price</label>
                    <input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      value={patch.originalPrice}
                      onChange={(e) =>
                        setEdits((prev) => {
                          const next = new Map(prev)
                          next.set(i.id, { ...patch, originalPrice: e.target.value })
                          return next
                        })
                      }
                    />
                  </div>
                </div>

                {isExpanded ? (
                  <>
                    <div className="field" style={{ marginTop: 10 }}>
                      <label className="label">Duration</label>
                      <input
                        className="input"
                        type="text"
                        value={patch.duration}
                        onChange={(e) =>
                          setEdits((prev) => {
                            const next = new Map(prev)
                            next.set(i.id, { ...patch, duration: e.target.value })
                            return next
                          })
                        }
                      />
                    </div>
                    <div className="field" style={{ marginTop: 10 }}>
                      <label className="label">Description</label>
                      <textarea
                        className="textarea"
                        rows={3}
                        value={patch.description}
                        onChange={(e) =>
                          setEdits((prev) => {
                            const next = new Map(prev)
                            next.set(i.id, { ...patch, description: e.target.value })
                            return next
                          })
                        }
                      />
                    </div>
                    <div className="grid2" style={{ marginTop: 10 }}>
                      <label className="checkboxRow">
                        <input
                          type="checkbox"
                          checked={patch.discount}
                          onChange={(e) =>
                            setEdits((prev) => {
                              const next = new Map(prev)
                              next.set(i.id, { ...patch, discount: e.target.checked })
                              return next
                            })
                          }
                        />
                        <span className="mutedSmall">Discount</span>
                      </label>
                      <label className="checkboxRow">
                        <input
                          type="checkbox"
                          checked={patch.popular}
                          onChange={(e) =>
                            setEdits((prev) => {
                              const next = new Map(prev)
                              next.set(i.id, { ...patch, popular: e.target.checked })
                              return next
                            })
                          }
                        />
                        <span className="mutedSmall">Popular</span>
                      </label>
                    </div>
                    <div className="grid2" style={{ marginTop: 10 }}>
                      <div className="field">
                        <label className="label">Rating</label>
                        <input
                          className="input"
                          type="number"
                          inputMode="decimal"
                          value={patch.rating}
                          onChange={(e) =>
                            setEdits((prev) => {
                              const next = new Map(prev)
                              next.set(i.id, { ...patch, rating: e.target.value })
                              return next
                            })
                          }
                        />
                      </div>
                      <label className="checkboxRow">
                        <input
                          type="checkbox"
                          checked={patch.contactUsForPrice}
                          onChange={(e) =>
                            setEdits((prev) => {
                              const next = new Map(prev)
                              next.set(i.id, { ...patch, contactUsForPrice: e.target.checked })
                              return next
                            })
                          }
                        />
                        <span className="mutedSmall">Contact us for price</span>
                      </label>
                    </div>
                  </>
                ) : null}

                <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
                  <button className="buttonSecondary" type="button" onClick={() => remove(i.id)} disabled={busy !== null}>
                    {busy?.id === i.id && busy.action === 'delete' ? 'Deleting...' : 'Delete'}
                  </button>
                  <button className="buttonPrimary" type="button" onClick={() => save(i.id)} disabled={busy !== null}>
                    {busy?.id === i.id && busy.action === 'save' ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="muted">No services yet.</div>
        )}
      </div>
    </section>
  )
}

export function SettingsPage() {
  const { employees, error: employeesError } = useEmployees()
  const { services, error: servicesError } = useServices()

  return (
    <div className="page">
      <TopBar title="Settings" />
      {employeesError ? <ErrorBanner message={employeesError} /> : null}
      {servicesError ? <ErrorBanner message={servicesError} /> : null}

      <EmployeesSection items={employees} />
      <ServicesSection items={services} />
    </div>
  )
}
