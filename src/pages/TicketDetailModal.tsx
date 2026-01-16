import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ModalShell } from '../components/ModalShell'
import { TicketForm, type TicketFormValue } from '../components/TicketForm'
import { ErrorBanner } from '../components/ErrorBanner'
import { useEmployees } from '../hooks/useEmployees'
import { useServices } from '../hooks/useServices'
import { useTicketDetail } from '../hooks/useTicketDetail'
import { updateTicket } from '../lib/firestore'
import { toDateInputValue } from '../lib/time'

export function TicketDetailModal() {
  const params = useParams()
  const ticketId = params.ticketId ?? ''
  const navigate = useNavigate()

  const { employees, error: employeesError } = useEmployees()
  const { services, error: servicesError } = useServices()
  const { ticket, serviceItems, actions, error, previousActionIds, previousServiceItemIds } = useTicketDetail(ticketId)

  const initialValue = useMemo<TicketFormValue | null>(() => {
    if (!ticket) return null
    return {
      customerPhone: ticket.customerPhone ?? '',
      customerName: ticket.customerName ?? '',
      assignedEmployeeId: ticket.assignedEmployeeId ?? '',
      status: ticket.status,
      overallNote: ticket.overallNote ?? '',
      serviceItems: serviceItems.map((s) => ({
        id: s.id,
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        priceText: s.priceText ?? '',
        serviceNote: s.serviceNote ?? '',
        appointmentDateTimeInput: toDateInputValue(s.appointmentDateTime),
        confirmationLevel: s.confirmationLevel,
        isCompleted: Boolean(s.isCompleted),
        completedAt: s.completedAt ?? null,
        assignedEmployeeId: ticket.assignedEmployeeId,
        customerPhone: ticket.customerPhone,
        customerName: ticket.customerName ?? '',
      })),
      actions: actions.map((a) => ({
        id: a.id,
        description: a.description,
        dueDateTimeInput: toDateInputValue(a.dueDateTime),
        isCompleted: a.isCompleted,
      })),
    }
  }, [actions, serviceItems, ticket])

  return (
    <ModalShell onClose={() => navigate(-1)}>
      {!ticketId ? <ErrorBanner message="Missing ticket id." /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {employeesError ? <ErrorBanner message={employeesError} /> : null}
      {servicesError ? <ErrorBanner message={servicesError} /> : null}

      {ticketId && initialValue ? (
        <TicketForm
          title="Ticket"
          ticketId={ticketId}
          onBack={() => navigate(-1)}
          employees={employees}
          services={services}
          initialValue={initialValue}
          submitLabel="Save changes"
          onSubmit={async (value) => {
            await updateTicket({
              ticketId,
              customerPhone: value.customerPhone,
              customerName: value.customerName,
              assignedEmployeeId: value.assignedEmployeeId,
              status: value.status,
              overallNote: value.overallNote,
              serviceItems: value.serviceItems,
              previousServiceItemIds,
              actions: value.actions,
              previousActionIds,
            })
          }}
        />
      ) : (
        <div className="page">
          <div className="muted">Loading…</div>
        </div>
      )}
    </ModalShell>
  )
}

