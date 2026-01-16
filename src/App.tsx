import { BrowserRouter, Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom'
import { ShellLayout } from './components/ShellLayout'
import { TicketsListPage } from './pages/TicketsListPage'
import { TicketCreatePage } from './pages/TicketCreatePage'
import { TicketDetailPage } from './pages/TicketDetailPage'
import { TicketDetailModal } from './pages/TicketDetailModal'
import { CalendarPage } from './pages/CalendarPage'
import { FinancePage } from './pages/FinancePage'
import { SettingsPage } from './pages/SettingsPage'
import { SetupPage } from './pages/SetupPage'
import { getFirebaseEnv, isFirebaseConfigured } from './lib/firebase'

function AppRoutes() {
  const location = useLocation()
  const state = location.state as { backgroundLocation?: Location } | null
  const backgroundLocation = state?.backgroundLocation

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route element={<ShellLayout />}>
          <Route path="/" element={<TicketsListPage />} />
          <Route path="/tickets/new" element={<TicketCreatePage />} />
          <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      {backgroundLocation ? (
        <Routes>
          <Route path="/tickets/:ticketId" element={<TicketDetailModal />} />
        </Routes>
      ) : null}
    </>
  )
}

export default function App() {
  const configured = isFirebaseConfigured(getFirebaseEnv())

  if (!configured) return <SetupPage />

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
