# Salon Management PWA (React + Firebase)

Mobile-first salon management app for capturing incoming calls as Tickets, tracking status, managing appointments, and recording income/expenses. Data is stored in Firebase Firestore (no auth; everyone can see everything).

## Features

- Tickets list with filters + search + smart sorting (upcoming appointments first)
- Fast “+ Ticket” creation optimized for calls
- Per-ticket services (price/note/appointment datetime/confirmation level)
- Per-service “Complete” button that records income
- Calendar month view; clicking an appointment opens the Ticket in a modal
- Income & Expenses page with monthly totals + entry list
- Quick “+ Add Income / Expense” from the Tickets page
- PWA (installable)

## Local Setup

### 1) Install

```bash
npm install
```

### 2) Create Firebase project + Firestore

1. Firebase Console → create project
2. Build → Firestore Database → Create database
3. Project settings → Your apps → add a Web app
4. Copy the Firebase config values into `.env`

### 3) Configure env vars

```bash
# PowerShell
Copy-Item .env.example .env

# bash
# cp .env.example .env
```

Fill in `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_SALON_NAME`
- `VITE_SALON_PHONE`
- `VITE_SALON_EMAIL`
- `VITE_SALON_WEBSITE`
- `VITE_SALON_ADDRESS`
- `VITE_SALON_LOGO_PATH` (optional; default `/icons/salon-icon.png`)

### 4) Firestore rules (dev-only)

This MVP has no auth. For local dev, you can temporarily use:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Do not ship open rules to production.

### 5) Run

```bash
npm run dev
```

## Seeding (optional)

```bash
npm run seed
```

This seeds employees/services, adds 3 sample tickets, and rebuilds the `appointments` collection from existing ticket service items (so the calendar can show older data).

## PWA

In Chrome/Edge, look for the install icon in the address bar (or "Install app" in the browser menu). On mobile, use "Add to Home Screen".

## Billing (PDF)

On `Income & Expenses`, tick the income rows you want to include, then click `Generate bill (PDF)` (the button is disabled until you select at least 1 income). The PDF uses salon details from env vars and will include a logo if you add `public/icons/salon-icon.png` (or set `VITE_SALON_LOGO_PATH`).

## Firestore Data Model (high level)

- `employees`: `{ name }`
- `services`: `{ name, category, ...optional fields }`
- `tickets`: `{ customerPhone, customerName, status, assignedEmployeeId, overallNote, createdAt, updatedAt, nextAppointment* }`
- `tickets/{ticketId}/serviceItems`: `{ serviceId, serviceName, priceText, serviceNote, appointmentDateTime, confirmationLevel, isCompleted, completedAt, ... }`
- `tickets/{ticketId}/actions`: `{ description, dueDateTime, isCompleted, createdAt }`
- `appointments`: denormalized docs used by Calendar `{ ticketId, serviceId, serviceName, appointmentDateTime, confirmationLevel, isCompleted, assignedEmployeeId, customerName, customerPhone }`
- `ledger`: income/expense entries `{ type, date, amount, serviceName?, reason?, ticketId?, serviceId? }`

## Indexes

If you see “The query requires an index”, open the URL shown in the error message and create the suggested composite index.

Calendar uses the `appointments` collection (not a collection-group query), so no collection-group index is required.
