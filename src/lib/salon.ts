export type SalonInfo = {
  name: string
  phone?: string
  email?: string
  website?: string
  address?: string
  logoPath?: string
}

function clean(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export function getSalonInfo(): SalonInfo {
  const name = clean(import.meta.env.VITE_SALON_NAME) || 'Salon'
  const phone = clean(import.meta.env.VITE_SALON_PHONE)
  const email = clean(import.meta.env.VITE_SALON_EMAIL)
  const website = clean(import.meta.env.VITE_SALON_WEBSITE)
  const address = clean(import.meta.env.VITE_SALON_ADDRESS)
  const logoPath = clean(import.meta.env.VITE_SALON_LOGO_PATH)
  return {
    name,
    phone: phone || undefined,
    email: email || undefined,
    website: website || undefined,
    address: address || undefined,
    logoPath: logoPath || undefined,
  }
}
