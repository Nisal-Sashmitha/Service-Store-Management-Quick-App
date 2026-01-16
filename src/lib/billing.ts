import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { getSalonInfo } from './salon'
import type { LedgerEntry } from './types'

async function fetchImageDataUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Failed to read image.'))
      reader.onload = () => resolve(String(reader.result))
      reader.readAsDataURL(blob)
    })
    return dataUrl
  } catch {
    return null
  }
}

export async function downloadIncomeBillPdf(input: { entries: LedgerEntry[]; filenameBase?: string; title?: string }) {
  const onlyIncome = input.entries.filter((e) => e.type === 'INCOME')
  if (!onlyIncome.length) throw new Error('No income entries selected.')

  const issuedAt = new Date()
  const title = input.title ?? 'Bill'
  const salon = getSalonInfo()

  type Line = { key: string; name: string; qty: number; amount: number }
  const linesMap = new Map<string, Line>()
  for (const e of onlyIncome) {
    const name = (e.serviceName ?? '').trim() || 'Income'
    const key = `${e.serviceId ?? ''}__${name}`
    const amount = Number(e.amount ?? 0)
    const prev = linesMap.get(key)
    if (prev) {
      prev.qty += 1
      prev.amount += amount
    } else {
      linesMap.set(key, { key, name, qty: 1, amount })
    }
  }

  const lines = [...linesMap.values()].sort((a, b) => a.name.localeCompare(b.name))
  const total = lines.reduce((sum, l) => sum + l.amount, 0)

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40

  const logo =
    (salon.logoPath ? await fetchImageDataUrl(salon.logoPath) : null) ??
    (await fetchImageDataUrl('/icons/salon-icon.png')) ??
    (await fetchImageDataUrl('/icons/icon-192.png'))
  const logoSize = 44
  const logoTopPadding = 16
  const headerTop = 50
  const leftTextX = logo ? margin + logoSize + 12 : margin
  let leftY = headerTop

  if (logo) {
    doc.addImage(logo, 'PNG', margin, headerTop - logoSize + 12 + logoTopPadding, logoSize, logoSize)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(salon.name, leftTextX, leftY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  leftY += 14
  const contactLine = [salon.phone, salon.email, salon.website].filter(Boolean).join(' • ')
  if (contactLine) {
    doc.text(contactLine, leftTextX, leftY)
    leftY += 12
  }
  if (salon.address) {
    const maxWidth = pageWidth - margin - leftTextX
    const addrLines = doc.splitTextToSize(salon.address, maxWidth)
    doc.text(addrLines, leftTextX, leftY)
    leftY += addrLines.length * 12
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, pageWidth - margin, headerTop, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(format(issuedAt, 'yyyy-MM-dd HH:mm'), pageWidth - margin, headerTop + 14, { align: 'right' })
  doc.text(`Items: ${onlyIncome.length}`, pageWidth - margin, headerTop + 26, { align: 'right' })

  let y = Math.max(leftY, headerTop + 40) + 12
  doc.setDrawColor(180)
  doc.line(margin, y, pageWidth - margin, y)
  y += 18

  doc.setFont('helvetica', 'bold')
  doc.text('Service', margin, y)
  doc.text('Qty', pageWidth - margin - 120, y, { align: 'right' })
  doc.text('Amount', pageWidth - margin, y, { align: 'right' })

  y += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)

  for (const line of lines) {
    y += 14
    const maxNameWidth = pageWidth - margin * 2 - 160
    const nameLines = doc.splitTextToSize(line.name, maxNameWidth)
    const neededHeight = nameLines.length * 14

    if (y + neededHeight + 60 > doc.internal.pageSize.getHeight()) {
      doc.addPage()
      y = 46
    }

    doc.text(nameLines, margin, y)
    doc.text(String(line.qty), pageWidth - margin - 120, y, { align: 'right' })
    doc.text(line.amount.toFixed(0), pageWidth - margin, y, { align: 'right' })
    y += (nameLines.length - 1) * 14
  }

  y += 18
  doc.line(margin, y, pageWidth - margin, y)
  y += 20
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Total', pageWidth - margin - 120, y, { align: 'right' })
  doc.text(total.toFixed(0), pageWidth - margin, y, { align: 'right' })

  const filenameBase = input.filenameBase ?? `bill-${format(issuedAt, 'yyyy-MM-dd')}`
  doc.save(`${filenameBase}.pdf`)
}
