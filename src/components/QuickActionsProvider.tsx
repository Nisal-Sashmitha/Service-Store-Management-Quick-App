import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useServices } from '../hooks/useServices'
import { CreateBillModal } from './CreateBillModal'
import { FinanceEntryModal, type FinanceModalMode } from './FinanceEntryModal'
import { QuickActionsContext, type QuickActionsApi } from './quickActionsContext'

export function QuickActionsProvider(props: { children: ReactNode }) {
  const navigate = useNavigate()
  const { services, error: servicesError } = useServices()

  const [fabOpen, setFabOpen] = useState(false)

  const [showFinanceModal, setShowFinanceModal] = useState(false)
  const [financeMode, setFinanceMode] = useState<FinanceModalMode>('choose')

  const [showBillModal, setShowBillModal] = useState(false)

  const api = useMemo<QuickActionsApi>(() => {
    return {
      openFinance: (mode = 'choose') => {
        if (servicesError) {
          alert(servicesError)
          return
        }
        setFabOpen(false)
        setFinanceMode(mode)
        setShowFinanceModal(true)
      },
      openBill: () => {
        if (servicesError) {
          alert(servicesError)
          return
        }
        setFabOpen(false)
        setShowBillModal(true)
      },
    }
  }, [servicesError])

  return (
    <QuickActionsContext.Provider value={api}>
      {props.children}

      <div className="fabGroup" aria-label="Quick actions">
        <div className={fabOpen ? 'fabActions' : 'fabActions fabActionsClosed'}>
          <button
            className="fabAction"
            type="button"
            onClick={() => {
              setFabOpen(false)
              navigate('/tickets/new')
            }}
          >
            <span className="fabText">Ticket</span>
            <span className="fabMini">+</span>
          </button>
          <button className="fabAction" type="button" onClick={() => api.openBill()}>
            <span className="fabText">Bill</span>
            <span className="fabMini">B</span>
          </button>
          <button className="fabAction" type="button" onClick={() => api.openFinance('choose')}>
            <span className="fabText">Income/Expense</span>
            <span className="fabMini">₨</span>
          </button>
        </div>

        <button className="fabMain" type="button" aria-label="Open quick actions" onClick={() => setFabOpen((v) => !v)}>
          {fabOpen ? '×' : '+'}
        </button>
      </div>

      {showFinanceModal ? (
        <FinanceEntryModal
          mode={financeMode}
          services={services}
          onModeChange={setFinanceMode}
          onClose={() => setShowFinanceModal(false)}
        />
      ) : null}

      {showBillModal ? <CreateBillModal services={services} onClose={() => setShowBillModal(false)} /> : null}
    </QuickActionsContext.Provider>
  )
}

