import 'dotenv/config'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { Timestamp, collection, doc, getDocs, limit, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { getFirestore } from 'firebase/firestore'

type ServiceSeedItem = {
  id: string
  name: string
  category: 'hair' | 'beauty' | 'nails'
  description?: string
  duration?: string
  originalPrice?: number
  currentPrice?: number
  discount?: boolean
  rating?: number
  popular?: boolean
  contactUsForPrice?: boolean
}

type EmployeeDoc = { id: string; name: string }

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var ${name}. Did you create a .env file?`)
  return value
}

function getFirebaseConfig() {
  return {
    apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
    authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: requireEnv('VITE_FIREBASE_APP_ID'),
  }
}

function getDb() {
  const app = getApps().length ? getApp() : initializeApp(getFirebaseConfig())
  return getFirestore(app)
}

async function seedEmployees(names: string[]): Promise<number> {
  const db = getDb()
  const snap = await getDocs(query(collection(db, 'employees'), limit(500)))
  const existing = new Set(snap.docs.map((d) => String((d.data() as { name?: string }).name ?? '').toLowerCase()))

  const batch = writeBatch(db)
  let added = 0
  for (const name of names) {
    const trimmed = name.trim()
    if (!trimmed) continue
    if (existing.has(trimmed.toLowerCase())) continue
    batch.set(doc(collection(db, 'employees')), { name: trimmed })
    added += 1
  }

  if (added) await batch.commit()
  return added
}

async function seedServices(items: ServiceSeedItem[]): Promise<{ added: number; updated: number }> {
  const db = getDb()
  const snap = await getDocs(query(collection(db, 'services'), limit(2000)))
  const existingIds = new Set(snap.docs.map((d) => d.id))

  const batch = writeBatch(db)
  let added = 0
  let updated = 0
  for (const item of items) {
    const name = item.name.trim()
    if (!name) continue

    const wasExisting = existingIds.has(item.id)
    batch.set(
      doc(db, 'services', item.id),
      {
        name,
        category: item.category,
        description: item.description?.trim() ? item.description.trim() : null,
        duration: item.duration?.trim() ? item.duration.trim() : null,
        originalPrice: item.originalPrice ?? null,
        currentPrice: item.currentPrice ?? null,
        discount: item.discount ?? null,
        rating: item.rating ?? null,
        popular: item.popular ?? null,
        contactUsForPrice: item.contactUsForPrice ?? null,
      },
      { merge: true },
    )
    if (wasExisting) updated += 1
    else added += 1
  }

  if (added || updated) await batch.commit()
  return { added, updated }
}

async function getEmployeesByNames(names: string[]): Promise<EmployeeDoc[]> {
  const db = getDb()
  const snap = await getDocs(query(collection(db, 'employees'), where('name', 'in', names)))
  const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as { name: string }) }))
  const byName = new Map(docs.map((d) => [d.name, d]))
  return names.map((n) => byName.get(n)).filter(Boolean) as EmployeeDoc[]
}

function atLocalTime(base: Date, plusDays: number, hour: number, minute: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + plusDays)
  d.setHours(hour, minute, 0, 0)
  return d
}

async function seedSampleTickets(employees: EmployeeDoc[]) {
  const db = getDb()
  const now = new Date()

  const sampleTickets = [
    {
      ticketId: `sample_${employees[0]?.id ?? 'emp1'}`,
      customerPhone: '0770000001',
      customerName: 'Customer One',
      status: 'NEW_CALL' as const,
      assignedEmployeeId: employees[0]?.id ?? '',
      overallNote: 'Sample ticket created by seeder.',
      serviceItems: [
        {
          serviceId: 'svc_1',
          serviceName: 'Aroma Magic Gold facial',
          confirmationLevel: 'FULLY_CONFIRMED' as const,
          appointmentDateTime: Timestamp.fromDate(atLocalTime(now, 1, 10, 0)),
          priceText: '3500',
          serviceNote: 'Prefers morning.',
          isCompleted: false,
        },
        {
          serviceId: 'svc_11',
          serviceName: 'Eyebrow Shaping',
          confirmationLevel: 'NONE' as const,
          appointmentDateTime: null,
          priceText: '200',
          serviceNote: '',
          isCompleted: false,
        },
      ],
      actions: [
        {
          actionId: 'followup_1',
          description: 'Call back to confirm details',
          dueDateTime: Timestamp.fromDate(atLocalTime(now, 0, 18, 0)),
          isCompleted: false,
        },
      ],
    },
    {
      ticketId: `sample_${employees[1]?.id ?? 'emp2'}`,
      customerPhone: '0770000002',
      customerName: 'Customer Two',
      status: 'APPOINTMENT_TENTATIVE' as const,
      assignedEmployeeId: employees[1]?.id ?? '',
      overallNote: 'Wants to confirm after checking schedule.',
      serviceItems: [
        {
          serviceId: 'svc_9',
          serviceName: 'Hair Style',
          confirmationLevel: 'PARTIALLY_CONFIRMED' as const,
          appointmentDateTime: Timestamp.fromDate(atLocalTime(now, 2, 15, 30)),
          priceText: '1000',
          serviceNote: 'Bring reference photo.',
          isCompleted: false,
        },
      ],
      actions: [],
    },
    {
      ticketId: `sample_${employees[2]?.id ?? 'emp3'}`,
      customerPhone: '0770000003',
      customerName: 'Customer Three',
      status: 'PRICE_DISCUSSION_PENDING' as const,
      assignedEmployeeId: employees[2]?.id ?? '',
      overallNote: 'Customer will visit later for price discussion.',
      serviceItems: [
        {
          serviceId: 'svc_4',
          serviceName: 'Ume Care Hydra Facial',
          confirmationLevel: 'NONE' as const,
          appointmentDateTime: null,
          priceText: '7000',
          serviceNote: '',
          isCompleted: false,
        },
      ],
      actions: [
        {
          actionId: 'followup_1',
          description: 'Send price details via WhatsApp',
          dueDateTime: Timestamp.fromDate(atLocalTime(now, 1, 12, 0)),
          isCompleted: false,
        },
      ],
    },
  ]

  const batch = writeBatch(db)
  let ticketsUpserted = 0
  let serviceItemsUpserted = 0
  let actionsUpserted = 0
  let appointmentsUpserted = 0

  for (const t of sampleTickets) {
    if (!t.assignedEmployeeId) continue

    const next = t.serviceItems
      .filter((s) => s.appointmentDateTime)
      .sort((a, b) => (a.appointmentDateTime?.toMillis() ?? 0) - (b.appointmentDateTime?.toMillis() ?? 0))[0]

    batch.set(
      doc(db, 'tickets', t.ticketId),
      {
        customerPhone: t.customerPhone,
        customerName: t.customerName,
        status: t.status,
        assignedEmployeeId: t.assignedEmployeeId,
        overallNote: t.overallNote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        nextAppointmentDateTime: next?.appointmentDateTime ?? null,
        nextAppointmentServiceName: next?.serviceName ?? null,
        nextAppointmentConfirmationLevel: next?.confirmationLevel ?? null,
      },
      { merge: true },
    )
    ticketsUpserted += 1

    for (const s of t.serviceItems) {
      batch.set(
        doc(db, 'tickets', t.ticketId, 'serviceItems', s.serviceId),
        {
          ticketId: t.ticketId,
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          priceText: s.priceText,
          serviceNote: s.serviceNote,
          appointmentDateTime: s.appointmentDateTime,
          confirmationLevel: s.confirmationLevel,
          isCompleted: Boolean(s.isCompleted),
          completedAt: null,
          assignedEmployeeId: t.assignedEmployeeId,
          customerPhone: t.customerPhone,
          customerName: t.customerName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      serviceItemsUpserted += 1

      const appointmentRef = doc(db, 'appointments', `${t.ticketId}__${s.serviceId}`)
      if (s.appointmentDateTime) {
        batch.set(
          appointmentRef,
          {
            ticketId: t.ticketId,
            serviceId: s.serviceId,
            serviceName: s.serviceName,
            appointmentDateTime: s.appointmentDateTime,
            confirmationLevel: s.confirmationLevel,
            isCompleted: Boolean(s.isCompleted),
            assignedEmployeeId: t.assignedEmployeeId,
            customerPhone: t.customerPhone,
            customerName: t.customerName,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true },
        )
        appointmentsUpserted += 1
      } else {
        batch.delete(appointmentRef)
      }
    }

    for (const a of t.actions) {
      batch.set(
        doc(db, 'tickets', t.ticketId, 'actions', a.actionId),
        {
          description: a.description,
          dueDateTime: a.dueDateTime,
          isCompleted: a.isCompleted,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      )
      actionsUpserted += 1
    }
  }

  if (ticketsUpserted) await batch.commit()
  return { ticketsUpserted, serviceItemsUpserted, actionsUpserted, appointmentsUpserted }
}

async function rebuildAppointmentsFromTickets(maxTickets = 200): Promise<{
  ticketsScanned: number
  appointmentsUpserted: number
  appointmentsDeleted: number
}> {
  const db = getDb()
  const ticketsSnap = await getDocs(query(collection(db, 'tickets'), limit(maxTickets)))

  let batch = writeBatch(db)
  let ops = 0
  let appointmentsUpserted = 0
  let appointmentsDeleted = 0

  async function commitIfNeeded(force = false) {
    if (!ops) return
    if (!force && ops < 450) return
    await batch.commit()
    batch = writeBatch(db)
    ops = 0
  }

  for (const ticketDoc of ticketsSnap.docs) {
    const ticketId = ticketDoc.id
    const ticket = ticketDoc.data() as { assignedEmployeeId?: string; customerPhone?: string; customerName?: string | null }

    const itemsSnap = await getDocs(query(collection(db, 'tickets', ticketId, 'serviceItems'), limit(200)))
    for (const itemDoc of itemsSnap.docs) {
      const item = itemDoc.data() as {
        serviceId?: string
        serviceName?: string
        appointmentDateTime?: Timestamp | null
        confirmationLevel?: string
        isCompleted?: boolean
        assignedEmployeeId?: string
        customerPhone?: string
        customerName?: string | null
      }

      const serviceId = item.serviceId ?? itemDoc.id
      const appointmentRef = doc(db, 'appointments', `${ticketId}__${serviceId}`)

      if (item.appointmentDateTime) {
        batch.set(
          appointmentRef,
          {
            ticketId,
            serviceId,
            serviceName: item.serviceName ?? '',
            appointmentDateTime: item.appointmentDateTime,
            confirmationLevel: item.confirmationLevel ?? 'NONE',
            isCompleted: Boolean(item.isCompleted),
            assignedEmployeeId: item.assignedEmployeeId ?? ticket.assignedEmployeeId ?? '',
            customerPhone: item.customerPhone ?? ticket.customerPhone ?? '',
            customerName: item.customerName ?? ticket.customerName ?? null,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
        appointmentsUpserted += 1
      } else {
        batch.delete(appointmentRef)
        appointmentsDeleted += 1
      }

      ops += 1
      await commitIfNeeded()
    }
  }

  await commitIfNeeded(true)
  return { ticketsScanned: ticketsSnap.size, appointmentsUpserted, appointmentsDeleted }
}

async function main() {
  const employees = ['Pavi Jayathissa', 'Nisal Sashmitha', 'Gagani']
  const services: ServiceSeedItem[] = [
    {
      id: 'svc_1',
      name: 'Aroma Magic Gold facial',
      category: 'beauty',
      description:
        'A luxurious facial with natural gold extracts to brighten, rejuvenate, and give your skin a radiant glow',
      duration: '75 min',
      originalPrice: 5000,
      currentPrice: 3500,
      discount: true,
      rating: 5.0,
      popular: true,
    },
    {
      id: 'svc_2',
      name: 'Aroma Magic Pearl Facial (Pimple Care)',
      category: 'beauty',
      description:
        'Ideal for pimple-prone skin; calms, clears, and brightens with a natural pearl glow.',
      duration: '75 min',
      originalPrice: 5500,
      currentPrice: 3700,
      discount: true,
      rating: 4.8,
    },
    {
      id: 'svc_3',
      name: 'Ume Care Cleanup',
      category: 'beauty',
      description:
        'Deep pore cleansing facial using premium Ume Care products and high frequency technology to purify skin, reduce bacteria, and promote healthy cell renewal for a radiant complexion.',
      duration: '60 min',
      originalPrice: 5000,
      currentPrice: 5000,
      discount: false,
      rating: 4.9,
      popular: false,
    },
    {
      id: 'svc_4',
      name: 'Ume Care Hydra Facial',
      category: 'beauty',
      description:
        'Comprehensive hydrating treatment using Ume Care products with hydradermabrasion, galvanic therapy, high frequency, proton light therapy, and rejuvenating jelly mask for ultimate skin renewal.',
      duration: '90 min',
      originalPrice: 10000,
      currentPrice: 7000,
      discount: true,
      rating: 4.7,
      popular: true,
    },
    {
      id: 'svc_5',
      name: 'Derma pro cleanup',
      category: 'beauty',
      description:
        'Essential basic facial cleansing treatment to remove impurities, unclog pores, and refresh skin using professional techniques and derma pro products.',
      duration: '45 min',
      originalPrice: 1500,
      currentPrice: 1500,
      discount: false,
      rating: 4.7,
      popular: false,
    },
    {
      id: 'svc_6',
      name: 'Derma pro facial',
      category: 'beauty',
      description:
        'Facial treatment targeting deep cleansing, exfoliation, and nourishment using professional techniques and derma pro products for rejuvenated, healthy-looking skin.',
      duration: '60 min',
      originalPrice: 2000,
      currentPrice: 2000,
      discount: false,
      rating: 4.7,
      popular: false,
    },
    {
      id: 'svc_7',
      name: 'Full Dressing',
      category: 'beauty',
      description:
        'Complete bridal/event styling including professional saree draping, expert hair styling, and flawless MAC makeup application.',
      duration: '90 min',
      originalPrice: 3700,
      currentPrice: 3000,
      discount: true,
      rating: 4.8,
    },
    {
      id: 'svc_8',
      name: 'Make Up',
      category: 'beauty',
      description:
        'Professional makeup application using premium MAC cosmetics for flawless, long-lasting coverage.',
      duration: '25 min',
      originalPrice: 2200,
      currentPrice: 1500,
      discount: true,
      popular: true,
    },
    {
      id: 'svc_9',
      name: 'Hair Style',
      category: 'hair',
      description:
        'Professional hair styling using expert techniques and quality products to create beautiful, long-lasting looks.',
      duration: '20 min',
      originalPrice: 1000,
      currentPrice: 1000,
      discount: false,
      rating: 4.8,
    },
    {
      id: 'svc_10',
      name: 'Saree Drapping',
      category: 'beauty',
      description: 'Kandyan and indian saree drapping for all occasions',
      duration: '10 min',
      originalPrice: 500,
      currentPrice: 500,
      discount: false,
      rating: 4.8,
    },
    {
      id: 'svc_11',
      name: 'Eyebrow Shaping',
      category: 'beauty',
      description: 'Professional eyebrow threading and shaping',
      duration: '7 min',
      originalPrice: 250,
      currentPrice: 200,
      discount: true,
      rating: 4.6,
    },
    {
      id: 'svc_12',
      name: 'Upperlip',
      category: 'beauty',
      description: '',
      duration: '5 min',
      originalPrice: 100,
      currentPrice: 100,
      discount: false,
      rating: 4.7,
    },
    {
      id: 'svc_13',
      name: 'Eyebrow shaping and Upperlip',
      category: 'beauty',
      description: '',
      duration: '90 min',
      originalPrice: 400,
      currentPrice: 300,
      discount: true,
      rating: 4.9,
    },
    {
      id: 'svc_14',
      name: 'Relaxing/ Rebonding',
      category: 'hair',
      description: "Professional hair straightening services using L'Oréal products for smooth, manageable hair.",
      duration: '4 hours (depending on the hair)',
      originalPrice: 2000,
      currentPrice: 1500,
      discount: false,
      contactUsForPrice: true,
      popular: true,
    },
    {
      id: 'svc_15',
      name: 'Keratin Treatment',
      category: 'hair',
      description:
        'Smoothing treatment using Hannalee keratin products to reduce frizz, add shine, and improve manageability.',
      duration: '5 hours (depending on the hair)',
      originalPrice: 2000,
      currentPrice: 1500,
      discount: false,
      contactUsForPrice: true,
      popular: true,
    },
    {
      id: 'svc_16',
      name: 'Hair Botox Treatment',
      category: 'hair',
      description:
        'An anti-frizz hair treatment that seals the cuticles, balances moisture and pH levels, and restores shine.',
      duration: '2 - 4 hours (depending on the hair)',
      originalPrice: 2500,
      currentPrice: 1800,
      discount: true,
      rating: 4.9,
      contactUsForPrice: true,
    },
    {
      id: 'svc_17',
      name: 'Condition Treatment',
      category: 'hair',
      description: "Deep conditioning therapy using L'Oréal products with hair steaming and vitamin infusion.",
      duration: '45 - 60 min (depending on the hair)',
      originalPrice: 2000,
      currentPrice: 2000,
      discount: false,
      contactUsForPrice: false,
      popular: false,
    },
    {
      id: 'svc_18',
      name: 'Blowdry',
      category: 'hair',
      description: 'Professional blowdry styling. Pricing may vary by hair length and thickness.',
      duration: '2 hours (depending on the hair)',
      originalPrice: 1000,
      discount: false,
      rating: 4.9,
      contactUsForPrice: false,
    },
    {
      id: 'svc_19',
      name: 'Iron',
      category: 'hair',
      description: 'Hair ironing/straight styling. Pricing may vary by hair length and thickness.',
      duration: '2 hours (depending on the hair)',
      originalPrice: 1500,
      currentPrice: 1000,
      discount: true,
      rating: 4.9,
      contactUsForPrice: false,
    },
    {
      id: 'svc_20',
      name: 'Full hair fashion color',
      category: 'hair',
      description: "Complete hair color transformation using L'Oréal professional color products.",
      duration: '2 hours (depending on the hair)',
      originalPrice: 2000,
      currentPrice: 1500,
      discount: false,
      rating: 4.9,
      contactUsForPrice: true,
    },
    {
      id: 'svc_21',
      name: 'Full hair lines',
      category: 'hair',
      description: "Professional hair highlighting using L'Oréal products to create dimensional color and brightness.",
      duration: '3 hours (depending on the hair)',
      originalPrice: 2000,
      currentPrice: 1500,
      discount: false,
      rating: 4.9,
      contactUsForPrice: true,
    },
    {
      id: 'svc_22',
      name: 'Balayage',
      category: 'hair',
      description: "Hand-painted highlighting technique using L'Oréal products.",
      duration: '4 hours (depending on the hair)',
      originalPrice: 2000,
      currentPrice: 1500,
      discount: false,
      rating: 4.9,
      contactUsForPrice: true,
    },
    {
      id: 'svc_23',
      name: 'Ombré',
      category: 'hair',
      description: 'Gradient color technique transitioning from dark roots to lighter ends.',
      duration: '3 hours (depending on the hair)',
      originalPrice: 2000,
      currentPrice: 1500,
      discount: false,
      rating: 4.9,
      contactUsForPrice: true,
    },
    {
      id: 'svc_24',
      name: 'Gray Hair Cover',
      category: 'hair',
      description: "Complete gray coverage using L'Oréal professional color products.",
      duration: '1 hour (depending on the hair)',
      originalPrice: 2000,
      currentPrice: 1500,
      discount: false,
      rating: 4.9,
      contactUsForPrice: true,
    },
    {
      id: 'svc_25',
      name: 'Hand wax (full hand)',
      category: 'beauty',
      description: 'Gentle hair removal for hands using normal waxing products for smooth, long-lasting results.',
      duration: '20 min',
      originalPrice: 2500,
      currentPrice: 1900,
      discount: true,
      rating: 4.9,
    },
    {
      id: 'svc_26',
      name: 'Leg wax - Half leg',
      category: 'beauty',
      description: 'Professional leg hair removal using normal waxing products for smooth, long-lasting results.',
      duration: '20 min',
      originalPrice: 2500,
      currentPrice: 1800,
      discount: true,
      rating: 4.9,
    },
    {
      id: 'svc_27',
      name: 'Leg wax - Full leg',
      category: 'beauty',
      description: 'Professional leg hair removal using normal waxing products for smooth, long-lasting results.',
      duration: '20 min',
      originalPrice: 4200,
      currentPrice: 2500,
      discount: true,
      rating: 4.9,
    },
  ]

  const employeesAdded = await seedEmployees(employees)
  const servicesResult = await seedServices(services)
  const employeeDocs = await getEmployeesByNames(employees)
  const sampleResult = await seedSampleTickets(employeeDocs)
  const rebuildResult = await rebuildAppointmentsFromTickets(200)

  console.log(
    `Seed complete. Employees added: ${employeesAdded}. Services added: ${servicesResult.added}, updated: ${servicesResult.updated}. Sample tickets upserted: ${sampleResult.ticketsUpserted}. Appointments upserted: ${sampleResult.appointmentsUpserted}. Rebuild scanned tickets: ${rebuildResult.ticketsScanned}, upserted: ${rebuildResult.appointmentsUpserted}, deleted: ${rebuildResult.appointmentsDeleted}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

