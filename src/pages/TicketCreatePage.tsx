import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TicketForm, type TicketFormValue } from '../components/TicketForm'
import { useEmployees } from '../hooks/useEmployees'
import { useServices } from '../hooks/useServices'
import { createTicket } from '../lib/firestore'

export function TicketCreatePage() {
  const navigate = useNavigate()
  const { employees, error: employeesError } = useEmployees()
  const { services, error: servicesError } = useServices()

  const initialValue = useMemo<TicketFormValue>(
    () => ({
      customerPhone: '',
      customerName: '',
      assignedEmployeeId: '',
      status: 'NEW_CALL',
      overallNote: '',
      serviceItems: [],
      actions: [],
    }),
    [],
  )

  return (
    <TicketForm
      title="New ticket"
      backTo="/"
      employees={employees}
      services={services}
      banners={[employeesError, servicesError].filter(Boolean) as string[]}
      initialValue={initialValue}
      submitLabel="Save ticket"
      onSubmit={async (value) => {
        const id = await createTicket({
          customerPhone: value.customerPhone,
          customerName: value.customerName,
          assignedEmployeeId: value.assignedEmployeeId,
          status: value.status,
          overallNote: value.overallNote,
          serviceItems: value.serviceItems,
          actions: value.actions,
        })
        navigate(`/tickets/${id}`)
      }}
    />
  )
}
